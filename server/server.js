const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));

// LLM endpoint: default to OpenRouter (free tier with API key)
const VLLM_API_URL =
  process.env.VLLM_API_URL || "https://openrouter.ai/api/v1/chat/completions";

const { formatJourneyContextForPrompt } = require("../skills/journeyContext.cjs");
const { COACH_SYSTEM_PROMPT_TEXT } = require("../skills/coachSystemPrompt.cjs");
const { buildProductionSystemPrompt } = require("../skills/buildProductionSystemPrompt.cjs");
const {
  stripThinking,
  contentFromChoice,
  prepareCoachTurn,
  runGuarded,
  mergeStateUpdate,
  templatedReply,
  withNoThink,
  withRegenerateReminder,
} = require("../skills/coachReply.cjs");
const { coachLlmProvider } = require("../skills/llmProvider.cjs");
const {
  trimTrainerRules,
  trimExemplars,
  trimMessagesForContext,
  buildSamplingParams,
  estimateMessagesTokens,
  parseLlmErrorMessage,
} = require("../skills/llmChatHelpers.cjs");
const {
  normalizeLang,
  buildTranslationMessages,
  extractTranslationFromLlm,
  SUPPORTED_TARGET_LANGS,
  SUPPORTED_SOURCE_LANGS,
} = require("../skills/adminTranslate.cjs");


const SYSTEM_PROMPT = {
  role: "system",
  content: COACH_SYSTEM_PROMPT_TEXT,
};

const {
  buildRegenerationUserPrompt,
  buildRegenerationSystemContent,
} = require("../skills/regenerationHelpers.cjs");
const {
  normalizeChatHistory,
  buildConversationMemoryBlock,
} = require("../skills/conversationMemory.cjs");

const NAME_JOURNEY_SYSTEM_PROMPT = {
  role: "system",
  content: `You generate short titles for coaching conversations (like ChatGPT chat titles).
Given excerpts from a user's messages, output ONLY a concise title: 3 to 7 words, sentence case, no quotes, no trailing punctuation, no explanation.
Capture the main topic or situation (work conflict, feedback anxiety, burnout, etc.).`,
};

const TRAINER_FEEDBACK_LIMIT = 25;
const INFERENCE_TRAINER_LIMIT = 6;
const INFERENCE_EXEMPLAR_LIMIT = 2;

async function fetchTrainerGlobalInstructions(limit = TRAINER_FEEDBACK_LIMIT) {
  const baseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) {
    console.warn(
      "Trainer global standards skipped: set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL on the chat host.",
    );
    return "";
  }
  try {
    const url = `${baseUrl}/rest/v1/chat_feedback?select=feedback_text,created_at,apply_to_global_instructions&order=created_at.desc&limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key.trim()}`,
      },
    });
    if (!res.ok) {
      console.warn("Supabase chat_feedback fetch failed:", res.status);
      return "";
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return "";
    const seen = new Set();
    const lines = [];
    for (const r of rows) {
      if (r.apply_to_global_instructions === false) continue;
      const text = typeof r.feedback_text === "string" ? r.feedback_text.trim() : "";
      if (!text || seen.has(text)) continue;
      seen.add(text);
      lines.push(`- ${text}`);
    }
    return lines.length ? lines.join("\n") : "";
  } catch (err) {
    console.warn("fetchTrainerGlobalInstructions:", err.message);
    return "";
  }
}

async function fetchStarredAssistantExemplars(limit = 8, truncateMax = 480) {
  const baseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) return "";
  try {
    const url = `${baseUrl}/rest/v1/chat_messages?admin_quality_star=eq.true&role=eq.assistant&select=content,admin_starred_at&order=admin_starred_at.desc&limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key.trim()}`,
      },
    });
    if (!res.ok) {
      console.warn("Supabase starred messages fetch failed:", res.status);
      return "";
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return "";
    const truncate = (s, max = truncateMax) => {
      const t = String(s || "")
        .trim()
        .replace(/\s+/g, " ");
      if (t.length <= max) return t;
      return `${t.slice(0, max)}…`;
    };
    return rows
      .map((r, i) => (typeof r.content === "string" && r.content.trim() ? `${i + 1}. ${truncate(r.content)}` : ""))
      .filter(Boolean)
      .join("\n");
  } catch (err) {
    console.warn("fetchStarredAssistantExemplars:", err.message);
    return "";
  }
}

async function buildChatSystemContent(
  possibleCrisisLanguage,
  journeyContext,
  history,
  forInference = true,
  latestUserMessage = "",
  turnInstruction = "",
) {
  const [rawTrainerRules, rawExemplars] = await Promise.all([
    fetchTrainerGlobalInstructions(forInference ? INFERENCE_TRAINER_LIMIT : TRAINER_FEEDBACK_LIMIT),
    fetchStarredAssistantExemplars(forInference ? INFERENCE_EXEMPLAR_LIMIT : 8, forInference ? 280 : 480),
  ]);
  const trainerRules = forInference ? trimTrainerRules(rawTrainerRules, 6, 120) : rawTrainerRules;
  const exemplars = forInference ? trimExemplars(rawExemplars, 2, 160) : rawExemplars;
  const conversationMemory = buildConversationMemoryBlock(history, forInference ? 1000 : 2200);
  let content = buildProductionSystemPrompt({
    trainerRules,
    exemplars,
    journeyContext,
    conversationMemory,
    forInference,
    latestUserMessage,
    turnInstruction,
  });
  if (possibleCrisisLanguage) {
    content += `\n# Context for this turn\nThe user's latest message may mention suicide, dying, or self-harm (sometimes as a figure of speech). Follow the crisis language protocol above with extra care.\n`;
  }
  return content;
}

app.post("/api/chat", async (req, res) => {
  const {
    userMessage,
    chatHistory,
    mode,
    regenerationContext,
    possibleCrisisLanguage,
    journeyContext,
    conversationSnippet,
  } = req.body;

  let messages = [];
  let turn = null;
  const isNameJourneyMode = mode === "name_journey";
  const isRegenerationMode = mode === "regenerate";
  if (isNameJourneyMode) {
    const snippet = typeof conversationSnippet === "string" ? conversationSnippet.trim() : "";
    if (!snippet) {
      return res.status(400).json({ error: "conversationSnippet is required for name_journey mode." });
    }
    messages = [NAME_JOURNEY_SYSTEM_PROMPT, { role: "user", content: snippet }];
  } else if (isRegenerationMode) {
    if (!regenerationContext?.originalUserMessage || !regenerationContext?.previousAssistantReply) {
      return res.status(400).json({
        error: "regenerationContext.originalUserMessage and previousAssistantReply are required.",
      });
    }
    const [rawTrainerRules, rawExemplars] = await Promise.all([
      fetchTrainerGlobalInstructions(12),
      fetchStarredAssistantExemplars(4, 280),
    ]);
    const regenContent = buildRegenerationSystemContent({
      trainerRules: rawTrainerRules,
      exemplars: rawExemplars,
      journeyContext,
      regenerationContext,
      chatHistory: regenerationContext?.chatHistory,
      forInference: true,
    });
    messages = [
      { role: "system", content: regenContent },
      { role: "user", content: buildRegenerationUserPrompt(regenerationContext) },
    ];
    messages = trimMessagesForContext(messages, { reserveOutputTokens: 450 });
  } else {
    if (!userMessage || typeof userMessage !== "string") {
      return res.status(400).json({ error: "userMessage is required and must be a string." });
    }
    const history = normalizeChatHistory(chatHistory, userMessage);
    turn = prepareCoachTurn({ mode: "chat", journeyContext, possibleCrisisLanguage, history, userMessage });
    const systemContent = await buildChatSystemContent(
      !!possibleCrisisLanguage,
      turn.phaseOne ? { ...journeyContext, phaseOneNextElement: null, askedPhaseOneElements: null } : journeyContext,
      history,
      true,
      userMessage,
      turn.turnInstruction,
    );
    messages = [{ role: "system", content: systemContent }, ...history, { role: "user", content: userMessage }];
    messages = trimMessagesForContext(messages, { reserveOutputTokens: 450 });
  }
  if (isRegenerationMode) turn = prepareCoachTurn({ mode: "regenerate", possibleCrisisLanguage });
  const guard = turn?.guard ?? null;

  const apiKey = process.env.LLM_API_KEY;
  const isRunPod = VLLM_API_URL.includes("runpod.ai");
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  try {
    const mode = isRegenerationMode ? "regenerate" : isNameJourneyMode ? "name_journey" : "chat";
    if (mode === "chat") {
      console.log("LLM chat request estTokens=", estimateMessagesTokens(messages));
    }
    const sampling = buildSamplingParams(mode, { summaryTurn: turn?.phaseOne?.asking === "summary" });
    const generate = async (isRetry) => {
      const response = await axios.post(
        VLLM_API_URL,
        {
          model: process.env.VLLM_MODEL || "meta-llama/llama-3.2-3b-instruct:free",
          messages: withNoThink(isRetry ? withRegenerateReminder(messages) : messages),
          ...sampling,
          ...(coachLlmProvider() === "runpod" ? { chat_template_kwargs: { enable_thinking: false } } : {}),
        },
        {
          headers,
          timeout: Number(process.env.VLLM_TIMEOUT_MS) || (isRunPod ? 180000 : 60000),
        }
      );
      return contentFromChoice(response.data.choices?.[0]);
    };

    if (!guard) return res.json({ reply: stripThinking(await generate(false)) });
    const out =
      (await runGuarded(generate, guard)) ??
      { reply: templatedReply({ element: guard.element, crisis: guard.crisis }), stateUpdate: null };
    res.json({
      reply: out.reply,
      stateUpdate: out.stateUpdate ?? null,
      phaseOne: turn.phaseOne ? mergeStateUpdate(turn.phaseOne, out.stateUpdate) : null,
    });
  } catch (error) {
    console.error("Error connecting to vLLM:", error.message);
    if (error.response) {
      console.error("vLLM response status:", error.response.status);
      console.error("vLLM response data:", error.response.data);
    }
    res.status(500).json({
      error: "Avatar is currently unavailable.",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

app.post("/api/translate", async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    return res.status(400).json({ error: "text is required" });
  }

  const targetLang = normalizeLang(req.body?.targetLang, SUPPORTED_TARGET_LANGS, "en");
  const sourceLang = normalizeLang(req.body?.sourceLang, SUPPORTED_SOURCE_LANGS, "auto");

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey?.trim()) {
    return res.status(503).json({ error: "Translation unavailable (LLM_API_KEY not configured)." });
  }

  const isRunPod = VLLM_API_URL.includes("runpod.ai");
  const model = process.env.VLLM_MODEL || "meta-llama/llama-3.2-3b-instruct:free";
  const messages = buildTranslationMessages(text, sourceLang, targetLang);

  try {
    const response = await axios.post(
      VLLM_API_URL,
      { model, messages, temperature: 0.2, max_tokens: 900 },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        timeout: Number(process.env.VLLM_TIMEOUT_MS) || 60000,
      },
    );
    const translation = extractTranslationFromLlm(response.data);
    if (!translation) {
      return res.status(502).json({ error: "Translation returned empty." });
    }
    return res.json({ translation, targetLang, sourceLang });
  } catch (error) {
    console.error("Translate error:", error.message);
    return res.status(502).json({ error: "Translation failed. Please try again." });
  }
});

app.post("/api/transcribe", async (req, res) => {
  const { audioBase64, mimeType } = req.body || {};
  if (!audioBase64 || typeof audioBase64 !== "string") {
    return res.status(400).json({ error: "audioBase64 is required." });
  }

  const preferOpenAI = (process.env.TRANSCRIBE_PROVIDER || "").toLowerCase() === "openai";
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const useOpenAI = preferOpenAI ? !!openaiKey : !groqKey && !!openaiKey;
  const url = useOpenAI
    ? "https://api.openai.com/v1/audio/transcriptions"
    : "https://api.groq.com/openai/v1/audio/transcriptions";
  const apiKey = useOpenAI ? openaiKey : groqKey;
  const model = useOpenAI
    ? (process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1")
    : (process.env.GROQ_TRANSCRIBE_MODEL || "whisper-large-v3-turbo");

  if (!apiKey) {
    return res.status(503).json({
      error: "Transcription is unavailable. Configure GROQ_API_KEY or OPENAI_API_KEY.",
    });
  }

  try {
    const bytes = Buffer.from(audioBase64, "base64");
    const blob = new Blob([bytes], { type: mimeType || "audio/webm" });
    const form = new FormData();
    form.append("file", blob, "voice-message.webm");
    form.append("model", model);
    form.append("language", "en");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Transcribe provider error:", response.status, errText);
      return res.status(502).json({ error: "Transcription provider error." });
    }

    const data = await response.json();
    return res.json({ text: (data.text || "").trim() });
  } catch (error) {
    console.error("Transcription failed:", error);
    return res.status(500).json({ error: "Transcription failed." });
  }
});

app.post("/api/workbook-author", async (req, res) => {
  try {
    const { createClient } = require("@supabase/supabase-js");
    const { runAuthorAction } = require("../skills/workbookAuthorService.cjs");
    const authHeader = req.headers.authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "").trim();
    if (!token) return res.status(401).json({ error: "Missing authorization." });

    const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
    const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anon) return res.status(500).json({ error: "Supabase is not configured." });

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: "Invalid session." });

    const namedAdmins = ["kara@admin.com", "josh@admin.com", "simon@admin.com", "louise@admin.com"];
    if (!namedAdmins.includes((userData.user.email || "").toLowerCase())) {
      const roleClient = service ? createClient(url, service) : userClient;
      const { data: roles, error: roleErr } = await roleClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .limit(1);
      if (roleErr || !roles?.length) return res.status(403).json({ error: "Admin role required." });
    }

    const result = await runAuthorAction(req.body || {});
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("workbook-author:", err);
    return res.status(500).json({ error: err.message || "Workbook author failed." });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
