/**
 * OpenAI-compatible fallback chat (e.g. Groq) when RunPod is queued/failed.
 * Env names only — keys live in Netlify / Vercel.
 */

function fallbackConfigured() {
  const key = (process.env.FALLBACK_LLM_API_KEY || process.env.GROQ_API_KEY || "").trim();
  return Boolean(key);
}

function fallbackConfig() {
  const apiKey = (process.env.FALLBACK_LLM_API_KEY || process.env.GROQ_API_KEY || "").trim();
  const hasGroq = Boolean((process.env.GROQ_API_KEY || "").trim());
  const apiUrl = (
    process.env.FALLBACK_LLM_API_URL ||
    (hasGroq ? "https://api.groq.com/openai/v1/chat/completions" : "")
  ).trim();
  // Prefer a reliable chat model; gpt-oss often returns empty content for long coach prompts.
  const model = (process.env.FALLBACK_LLM_MODEL || "llama-3.1-8b-instant").trim();
  const fallbackAfterMs = Number(process.env.RUNPOD_FALLBACK_AFTER_MS) || 75000;
  return { apiKey, apiUrl, model, fallbackAfterMs };
}

const PREFERRED_MODELS = [
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "qwen/qwen3-32b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
];
const NON_CHAT_MODEL = /whisper|guard|tts|playai|orpheus|distil|prompt-guard|safeguard|compound/i;

let resolvedModel = null;

function isModelUnavailable(status, msg) {
  return (
    status === 404 ||
    /model.*(not exist|not found|decommissioned|does not have access|unavailable)/i.test(String(msg))
  );
}

function extractReply(data) {
  const choice = data?.choices?.[0];
  const msg = choice?.message || {};
  const parts = [msg.content, msg.reasoning, choice?.text];
  for (const part of parts) {
    if (typeof part === "string" && part.trim()) return part.trim();
  }
  return "";
}

async function pickAvailableModel(apiUrl, apiKey, exclude = []) {
  const skip = new Set(exclude.filter(Boolean));
  const modelsUrl = apiUrl.replace(/\/chat\/completions\/?$/, "/models");
  const res = await fetch(modelsUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const ids = (data?.data || [])
    .filter((m) => m && m.id && m.active !== false)
    .map((m) => m.id)
    .filter((id) => !skip.has(id) && !NON_CHAT_MODEL.test(id));
  const preferred = [(process.env.GROQ_MODEL || "").trim(), ...PREFERRED_MODELS].filter(Boolean);
  return preferred.find((id) => ids.includes(id)) || ids[0] || null;
}

async function postChat(apiUrl, apiKey, payload, timeoutMs) {
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Fallback LLM invalid JSON (${res.status}): ${text.slice(0, 300)}`);
  }
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || text.slice(0, 300);
    const err = new Error(`Fallback LLM ${res.status}: ${msg}`);
    err.modelUnavailable = isModelUnavailable(res.status, msg);
    throw err;
  }
  return extractReply(data);
}

/**
 * Synchronous OpenAI-compatible chat completion. If the configured model is missing
 * or returns empty content, tries the next available model on the key.
 * @returns {Promise<string>} assistant text
 */
async function callFallbackChat(messages, sampling = {}, timeoutMs = 55000) {
  const { apiKey, apiUrl, model: configuredModel } = fallbackConfig();
  if (!apiKey || !apiUrl) {
    throw new Error("Fallback LLM is not configured.");
  }

  const tried = [];
  let model = resolvedModel || configuredModel;
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (!model || tried.includes(model)) {
      model = await pickAvailableModel(apiUrl, apiKey, tried);
    }
    if (!model) break;
    tried.push(model);

    const payload = {
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content || "" })),
      temperature: sampling.temperature ?? 0.7,
      max_tokens: sampling.max_tokens ?? 800,
    };
    if (typeof sampling.presence_penalty === "number") {
      payload.presence_penalty = sampling.presence_penalty;
    }
    if (typeof sampling.frequency_penalty === "number") {
      payload.frequency_penalty = sampling.frequency_penalty;
    }

    try {
      const reply = await postChat(apiUrl, apiKey, payload, timeoutMs);
      if (reply) {
        resolvedModel = model;
        return reply;
      }
      console.warn(`Fallback model "${model}" returned empty content, trying another`);
      lastError = new Error(`Fallback LLM returned empty content (${model})`);
      model = null;
    } catch (err) {
      lastError = err;
      if (!err.modelUnavailable) throw err;
      console.warn(`Fallback model "${model}" unavailable, trying another`);
      model = null;
    }
  }

  throw lastError || new Error("Fallback LLM returned empty content.");
}

function currentFallbackModel() {
  return resolvedModel || fallbackConfig().model;
}

module.exports = {
  fallbackConfigured,
  fallbackConfig,
  callFallbackChat,
  currentFallbackModel,
};
