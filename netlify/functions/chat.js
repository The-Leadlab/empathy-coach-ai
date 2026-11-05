/**
 * Netlify serverless function: same behavior as server/server.js /api/chat
 * Production: RunPod Serverless vLLM via VLLM_* env vars (see docs/SUPER-PROMPT-RUNPOD-OWN-LLM.md)
 * - LLM_API_KEY = RunPod API key
 * - VLLM_API_URL = https://api.runpod.ai/v2/<endpoint-id>/openai/v1/chat/completions
 * - VLLM_MODEL = OPENAI_SERVED_MODEL_NAME_OVERRIDE (e.g. empathy-coach-qwen)
 */
const DEFAULT_LLM_URL = "https://openrouter.ai/api/v1/chat/completions";

const { COACH_SYSTEM_PROMPT_TEXT } = require("../../skills/coachSystemPrompt.cjs");
const { buildProductionSystemPrompt } = require("../../skills/buildProductionSystemPrompt.cjs");
const {
  trimTrainerRules,
  trimExemplars,
  trimMessagesForContext,
  buildSamplingParams,
  fetchLlmWithRetries,
  userFacingLlmError,
  parseLlmErrorMessage,
  estimateMessagesTokens,
  isContextLengthError,
} = require("../../skills/llmChatHelpers.cjs");
const {
  parseRunPodEndpointId,
  extractReplyFromRunPodOutput,
  submitRunPodJob,
  pollRunPodJob,
  cancelRunPodJob,
  isRunPodTerminalFailure,
  useRunPodAsync,
} = require("../../skills/runpodAsync.cjs");
const {
  fallbackConfigured,
  fallbackConfig,
  callFallbackChat,
  currentFallbackModel,
} = require("../../skills/fallbackLlm.cjs");
const {
  normalizeChatHistory,
  buildConversationMemoryBlock,
} = require("../../skills/conversationMemory.cjs");

const SYSTEM_PROMPT = {
  role: "system",
  content: COACH_SYSTEM_PROMPT_TEXT,
};

const {
  buildRegenerationUserPrompt,
  buildRegenerationSystemContent,
} = require("../../skills/regenerationHelpers.cjs");

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
      "Trainer global standards skipped: set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL on the chat host (Netlify). Without them, only Simon's Regenerate preview differs from other users.",
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
    if (lines.length === 0) {
      console.warn("No trainer feedback rows to inject (empty or all marked trainer-only).");
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
  });
  if (possibleCrisisLanguage) {
    content += `\n# Context for this turn\nThe user's latest message may mention suicide, dying, or self-harm (sometimes as a figure of speech). Follow the crisis language protocol above with extra care.\n`;
  }
  return content;
}

exports.handler = async (event) => {
  const apiKey = process.env.LLM_API_KEY;
  const url = process.env.VLLM_API_URL || DEFAULT_LLM_URL;
  const endpointId = parseRunPodEndpointId(url);

  if (event.httpMethod === "DELETE") {
    const jobId = event.queryStringParameters?.jobId;
    if (!jobId) {
      return { statusCode: 400, body: JSON.stringify({ error: "jobId query parameter is required." }) };
    }
    if (!apiKey?.trim() || !endpointId) {
      return { statusCode: 503, body: JSON.stringify({ error: "RunPod cancel is not configured." }) };
    }
    const cancelled = await cancelRunPodJob(endpointId, apiKey, jobId);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancelled }),
    };
  }

  if (event.httpMethod === "GET") {
    const jobId = event.queryStringParameters?.jobId;
    const waitedMs = Number(event.queryStringParameters?.waitedMs) || 0;
    if (!jobId) {
      return { statusCode: 400, body: JSON.stringify({ error: "jobId query parameter is required." }) };
    }
    if (!apiKey?.trim() || !endpointId) {
      return {
        statusCode: 503,
        body: JSON.stringify({ error: "RunPod polling is not configured." }),
      };
    }
    const { fallbackAfterMs } = fallbackConfig();
    try {
      const data = await pollRunPodJob(endpointId, apiKey, jobId);
      const status = data.status || "UNKNOWN";
      if (status === "COMPLETED") {
        const reply = extractReplyFromRunPodOutput(data.output);
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, reply, provider: "runpod" }),
        };
      }
      if (isRunPodTerminalFailure(status)) {
        const err =
          typeof data.error === "string"
            ? parseLlmErrorMessage(data.error, 400)
            : "The coach could not start. Please try again.";
        const canFallback = fallbackConfigured();
        return {
          statusCode: canFallback ? 200 : 502,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            error: err,
            fallback: canFallback,
          }),
        };
      }
      if (waitedMs >= fallbackAfterMs && fallbackConfigured()) {
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, warming: true, fallback: true }),
        };
      }
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, warming: true }),
      };
    } catch (err) {
      console.error("RunPod poll error:", err.message);
      return {
        statusCode: 502,
        body: JSON.stringify({
          status: "FAILED",
          error: "Still connecting to the coach — keep waiting or try again shortly.",
          retryable: true,
          fallback: fallbackConfigured(),
        }),
      };
    }
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  if (body?.mode === "cancel" && body?.jobId) {
    if (!apiKey?.trim() || !endpointId) {
      return { statusCode: 503, body: JSON.stringify({ error: "RunPod cancel is not configured." }) };
    }
    const cancelled = await cancelRunPodJob(endpointId, apiKey, body.jobId);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancelled }),
    };
  }

  const preferFallback = body?.provider === "fallback";
  const mode =
    body?.mode === "regenerate" ? "regenerate" : body?.mode === "name_journey" ? "name_journey" : "chat";
  const { userMessage, chatHistory, regenerationContext, conversationSnippet } = body;

  let messages = [];
  if (mode === "name_journey") {
    const snippet = typeof conversationSnippet === "string" ? conversationSnippet.trim() : "";
    if (!snippet) {
      return { statusCode: 400, body: JSON.stringify({ error: "conversationSnippet is required for name_journey mode." }) };
    }
    messages = [
      NAME_JOURNEY_SYSTEM_PROMPT,
      { role: "user", content: snippet },
    ];
  } else if (mode === "regenerate") {
    if (!regenerationContext?.originalUserMessage || !regenerationContext?.previousAssistantReply) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "regenerationContext.originalUserMessage and previousAssistantReply are required." }),
      };
    }
    const [rawTrainerRules, rawExemplars] = await Promise.all([
      fetchTrainerGlobalInstructions(INFERENCE_TRAINER_LIMIT),
      fetchStarredAssistantExemplars(INFERENCE_EXEMPLAR_LIMIT, 280),
    ]);
    const regenContent = buildRegenerationSystemContent({
      trainerRules: rawTrainerRules,
      exemplars: rawExemplars,
      journeyContext: body?.journeyContext,
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
      return { statusCode: 400, body: JSON.stringify({ error: "userMessage is required and must be a string." }) };
    }
    const history = normalizeChatHistory(chatHistory, userMessage);
    const systemContent = await buildChatSystemContent(
      !!body?.possibleCrisisLanguage,
      body?.journeyContext,
      history,
      true,
      userMessage,
    );
    messages = [{ role: "system", content: systemContent }, ...history, { role: "user", content: userMessage }];
    messages = trimMessagesForContext(messages, { reserveOutputTokens: 450 });
  }

  const isRunPod = url.includes("runpod.ai");
  const timeoutMs = Number(process.env.VLLM_TIMEOUT_MS) || (isRunPod ? 180000 : 60000);
  const sampling = buildSamplingParams(mode);

  const runFallback = async (cancelJobId) => {
    if (!fallbackConfigured()) {
      return {
        statusCode: 503,
        body: JSON.stringify({
          error: "The coach is unavailable right now. Please try again shortly.",
          retryable: true,
        }),
      };
    }
    if (cancelJobId && endpointId && apiKey?.trim()) {
      await cancelRunPodJob(endpointId, apiKey, cancelJobId);
    }
    try {
      const reply = await callFallbackChat(messages, sampling);
      console.log("Fallback LLM reply, mode=", mode, "chars=", reply.length, "model=", currentFallbackModel());
      if (!reply) {
        return {
          statusCode: 502,
          body: JSON.stringify({
            error: "The coach is unavailable right now. Please try again.",
            retryable: true,
          }),
        };
      }
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply, provider: "fallback" }),
      };
    } catch (err) {
      console.error("Fallback LLM error:", err.message);
      return {
        statusCode: 502,
        body: JSON.stringify({
          error: "The coach is unavailable right now. Please try again.",
          retryable: true,
        }),
      };
    }
  };

  // Client re-POSTs with provider:"fallback" after poll signals fallback:true
  if (preferFallback) {
    return runFallback(typeof body?.cancelJobId === "string" ? body.cancelJobId : null);
  }

  // Skip RunPod while paused / for testing (set COACH_LLM_PROVIDER=fallback on the host)
  if ((process.env.COACH_LLM_PROVIDER || "").trim().toLowerCase() === "fallback" && fallbackConfigured()) {
    return runFallback(null);
  }

  // Journey titles: prefer fast fallback so cold GPUs don't block naming
  if (mode === "name_journey" && fallbackConfigured()) {
    return runFallback(null);
  }

  if (!apiKey || apiKey.trim() === "") {
    if (fallbackConfigured()) {
      return runFallback(null);
    }
    console.error(
      "LLM not connected: LLM_API_KEY is not set in Netlify environment variables (use your RunPod API key). Redeploy after saving.",
    );
    return {
      statusCode: 503,
      body: JSON.stringify({ error: "Avatar is currently unavailable. (API key not configured.)" }),
    };
  }

  const model = process.env.VLLM_MODEL || (isRunPod ? "empathy-coach-qwen" : "meta-llama/llama-3.2-3b-instruct:free");

  if ((mode === "chat" || mode === "regenerate") && useRunPodAsync(url) && endpointId) {
    try {
      // Hard-guarantee fit before async submit (no mid-job retry path).
      if (estimateMessagesTokens(messages) > 3400) {
        messages = trimMessagesForContext(messages, {
          aggressive: true,
          minHistoryMessages: 0,
          reserveOutputTokens: 450,
        });
      }
      const jobId = await submitRunPodJob(endpointId, apiKey, messages, sampling);
      console.log("RunPod async job submitted:", jobId, "estTokens=", estimateMessagesTokens(messages));
      return {
        statusCode: 202,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warming: true,
          jobId,
          provider: "runpod",
        }),
      };
    } catch (err) {
      console.error("RunPod async submit failed, using fallback if configured:", err.message);
      if (fallbackConfigured()) {
        return runFallback(null);
      }
      return {
        statusCode: 502,
        body: JSON.stringify({
          error: "The coach could not start. Please try again.",
          retryable: true,
        }),
      };
    }
  }

  const payload = {
    model,
    messages,
    ...sampling,
  };

  if (mode === "chat" || mode === "regenerate") {
    console.log(
      "LLM request:",
      "mode=",
      mode,
      "model=",
      model,
      "estTokens=",
      estimateMessagesTokens(messages),
    );
  }

  const doRequest = () =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

  try {
    let { res, attempts } = await fetchLlmWithRetries(doRequest, { isRunPod });

    if (!res.ok) {
      let errText = await res.text();
      // One aggressive re-trim + retry when the model rejects for context length.
      if (isContextLengthError(errText) && (mode === "chat" || mode === "regenerate")) {
        console.warn("Context length error — retrying with aggressive trim. est was", estimateMessagesTokens(messages));
        messages = trimMessagesForContext(messages, {
          aggressive: true,
          minHistoryMessages: 0,
          reserveOutputTokens: 450,
        });
        const retryPayload = { model, messages, ...sampling };
        const retryRes = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify(retryPayload),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (retryRes.ok) {
          const data = await retryRes.json();
          const reply = data.choices?.[0]?.message?.content ?? "";
          return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reply, provider: isRunPod ? "runpod" : "direct" }),
          };
        }
        errText = await retryRes.text();
        res = retryRes;
        attempts += 1;
      }

      console.error(
        "LLM error:",
        res.status,
        "attempts:",
        attempts,
        "URL:",
        url,
        "model:",
        model,
        "estTokens:",
        estimateMessagesTokens(messages),
        "body:",
        errText.slice(0, 1200),
      );
      if (fallbackConfigured()) {
        return runFallback(null);
      }
      return {
        statusCode: res.status === 429 ? 429 : 502,
        body: JSON.stringify({
          error: parseLlmErrorMessage(errText, res.status),
          retryable: res.status === 503 || res.status === 504 || res.status === 524,
        }),
      };
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content ?? "";
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply, provider: isRunPod ? "runpod" : "direct" }),
    };
  } catch (err) {
    console.error("Error connecting to LLM:", err.message, "stack:", err.stack);
    if (fallbackConfigured()) {
      return runFallback(null);
    }
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Avatar is currently unavailable. (Network or server error.)" }),
    };
  }
};
