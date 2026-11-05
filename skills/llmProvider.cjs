/**
 * Shared LLM caller for coach and workbook purposes.
 * Workbook drafting should use WORKBOOK_LLM_PROVIDER=fallback with a larger model
 * (e.g. llama-3.3-70b-versatile). Coach traffic can keep using RunPod via chat.js.
 */

const {
  fallbackConfigured,
  fallbackConfig,
  callFallbackChat,
  currentFallbackModel,
} = require("./fallbackLlm.cjs");
const {
  parseRunPodEndpointId,
  submitRunPodJob,
  pollRunPodJob,
  extractReplyFromRunPodOutput,
  useRunPodAsync,
} = require("./runpodAsync.cjs");

/**
 * Coach chat transport. `runpod` (default) uses RunPod Serverless async jobs when VLLM_API_URL is a
 * RunPod URL; `openai_compat` sends synchronous /chat/completions to VLLM_API_URL.
 * Legacy values (openrouter, groq, …) are treated as runpod so existing hosts keep working.
 */
function coachLlmProvider() {
  const value = (process.env.LLM_PROVIDER || "").trim().toLowerCase();
  return value === "openai_compat" ? "openai_compat" : "runpod";
}

function workbookProviderMode() {
  return (process.env.WORKBOOK_LLM_PROVIDER || "auto").trim().toLowerCase();
}

function resolveSyncEndpoint(purpose) {
  const isWorkbook = purpose === "workbook";
  const apiUrl = (
    (isWorkbook && process.env.WORKBOOK_LLM_API_URL) ||
    process.env.VLLM_API_URL ||
    ""
  ).trim();
  const apiKey = (
    (isWorkbook && process.env.WORKBOOK_LLM_API_KEY) ||
    process.env.LLM_API_KEY ||
    ""
  ).trim();
  const isRunPod = /runpod\.ai/i.test(apiUrl);
  const model = (
    (isWorkbook && process.env.WORKBOOK_LLM_MODEL) ||
    process.env.VLLM_MODEL ||
    (isRunPod ? "empathy-coach-qwen" : "meta-llama/llama-3.2-3b-instruct:free")
  ).trim();
  return { apiUrl, apiKey, model, isRunPod };
}

async function callOpenAiCompatible(apiUrl, apiKey, model, messages, sampling, timeoutMs) {
  const payload = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content || "" })),
    temperature: sampling.temperature ?? 0.5,
    max_tokens: sampling.max_tokens ?? 1500,
  };
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
    throw new Error(`LLM invalid JSON (${res.status}): ${text.slice(0, 300)}`);
  }
  if (!res.ok) {
    throw new Error(`LLM ${res.status}: ${data?.error?.message || text.slice(0, 300)}`);
  }
  return String(data.choices?.[0]?.message?.content || "").trim();
}

async function callRunPodPath(messages, sampling, { apiUrl, apiKey, model }) {
  const endpointId = parseRunPodEndpointId(apiUrl);
  if (!endpointId || !apiKey) {
    throw new Error("RunPod endpoint is not configured.");
  }

  if (useRunPodAsync(apiUrl)) {
    const jobId = await submitRunPodJob(endpointId, apiKey, messages, sampling);
    return {
      async: true,
      jobId,
      provider: "runpod",
      model,
      endpointId,
    };
  }

  const syncUrl = apiUrl.includes("/chat/completions")
    ? apiUrl
    : `https://api.runpod.ai/v2/${endpointId}/openai/v1/chat/completions`;
  const text = await callOpenAiCompatible(syncUrl, apiKey, model, messages, sampling, 90000);
  return { text, provider: "runpod", model, async: false };
}

async function callFallbackPath(messages, sampling) {
  if (!fallbackConfigured()) {
    throw new Error("Fallback LLM is not configured.");
  }
  const text = await callFallbackChat(messages, sampling);
  return { text, provider: "fallback", model: currentFallbackModel(), async: false };
}

/**
 * @param {{ messages: Array<{role:string,content:string}>, sampling?: object, purpose?: 'coach'|'workbook' }} opts
 * @returns {Promise<{ text?: string, provider: string, model: string, async?: boolean, jobId?: string }>}
 */
async function callLlm({ messages, sampling = {}, purpose = "coach" }) {
  const mode = purpose === "workbook" ? workbookProviderMode() : "runpod";
  const endpoint = resolveSyncEndpoint(purpose);
  const maxTokens =
    purpose === "workbook"
      ? Number(process.env.WORKBOOK_MAX_TOKENS) || 1500
      : sampling.max_tokens || 800;
  const finalSampling = { ...sampling, max_tokens: maxTokens };

  const tryRunpod = async () => callRunPodPath(messages, finalSampling, endpoint);
  const tryFallback = async () => callFallbackPath(messages, finalSampling);

  if (purpose === "workbook") {
    if (mode === "fallback") return tryFallback();
    if (mode === "runpod") return tryRunpod();
    // auto
    try {
      if (endpoint.apiUrl && endpoint.apiKey) {
        return await tryRunpod();
      }
    } catch (err) {
      if (!fallbackConfigured()) throw err;
      console.warn("workbook LLM RunPod failed, using fallback:", err.message);
    }
    return tryFallback();
  }

  // coach purpose: prefer configured primary endpoint; optional fallback on failure
  try {
    return await tryRunpod();
  } catch (err) {
    if (!fallbackConfigured()) throw err;
    console.warn("coach LLM primary failed, using fallback:", err.message);
    return tryFallback();
  }
}

async function pollRunPodJobResult(jobId, endpointId, apiKey) {
  const status = await pollRunPodJob(endpointId, apiKey, jobId);
  if (status.status === "COMPLETED") {
    return {
      text: extractReplyFromRunPodOutput(status.output),
      provider: "runpod",
      model: process.env.WORKBOOK_LLM_MODEL || process.env.VLLM_MODEL || "empathy-coach-qwen",
      async: false,
    };
  }
  return { status: status.status, provider: "runpod", async: true, jobId };
}

module.exports = {
  callLlm,
  coachLlmProvider,
  pollRunPodJobResult,
  workbookProviderMode,
  resolveSyncEndpoint,
  fallbackConfigured,
  fallbackConfig,
};
