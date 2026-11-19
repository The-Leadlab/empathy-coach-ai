/**
 * RunPod Serverless async /run + /status — avoids long-held Netlify connections during cold start.
 */

const { stripThinking, contentFromChoice, withNoThink } = require("./coachReply.cjs");

function parseRunPodEndpointId(vllmApiUrl) {
  const match = String(vllmApiUrl || "").match(/api\.runpod\.ai\/v2\/([^/]+)/i);
  return match?.[1] || null;
}

function runPodApiBase(endpointId) {
  return `https://api.runpod.ai/v2/${endpointId}`;
}

function toRunPodSamplingParams(sampling) {
  return {
    temperature: sampling.temperature,
    max_tokens: sampling.max_tokens,
    presence_penalty: sampling.presence_penalty,
    frequency_penalty: sampling.frequency_penalty,
    repetition_penalty: sampling.repetition_penalty,
    stop: sampling.stop,
  };
}

function buildRunPodInput(messages, sampling) {
  return {
    input: {
      messages: withNoThink(messages).map((m) => ({ role: m.role, content: m.content || "" })),
      sampling_params: toRunPodSamplingParams(sampling),
      chat_template_kwargs: { enable_thinking: false },
    },
  };
}

/** Raw text only (reasoning fields are ignored); callers run it through finalizeCoachReply. */
function extractReplyFromRunPodOutput(output) {
  if (!output) return "";

  if (typeof output === "string") return stripThinking(output);

  if (typeof output.text === "string") return stripThinking(output.text);

  const choices = output.choices || output.output?.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0];
    const content = contentFromChoice(first);
    if (content) return stripThinking(content);
    if (Array.isArray(first.tokens)) return stripThinking(first.tokens.join(""));
    if (typeof first.tokens === "string") return stripThinking(first.tokens);
  }

  if (Array.isArray(output) && output.length > 0) {
    return extractReplyFromRunPodOutput(output[0]);
  }

  return "";
}

async function submitRunPodJob(endpointId, apiKey, messages, sampling, timeoutMs = 30000) {
  const url = `${runPodApiBase(endpointId)}/run`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(buildRunPodInput(messages, sampling)),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`RunPod /run invalid JSON (${res.status}): ${text.slice(0, 400)}`);
  }

  if (!res.ok) {
    throw new Error(`RunPod /run ${res.status}: ${text.slice(0, 400)}`);
  }

  const jobId = data.id;
  if (!jobId) {
    throw new Error("RunPod /run returned no job id");
  }

  return jobId;
}

async function pollRunPodJob(endpointId, apiKey, jobId, timeoutMs = 20000) {
  const url = `${runPodApiBase(endpointId)}/status/${jobId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey.trim()}` },
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`RunPod /status invalid JSON (${res.status})`);
  }

  if (!res.ok) {
    throw new Error(`RunPod /status ${res.status}: ${text.slice(0, 400)}`);
  }

  return data;
}

async function cancelRunPodJob(endpointId, apiKey, jobId, timeoutMs = 15000) {
  if (!endpointId || !apiKey?.trim() || !jobId) return false;
  const url = `${runPodApiBase(endpointId)}/cancel/${jobId}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch (err) {
    console.warn("RunPod cancel failed:", err.message);
    return false;
  }
}

/** Terminal failure statuses from RunPod (plus unknown after client timeout). */
function isRunPodTerminalFailure(status) {
  const s = String(status || "").toUpperCase();
  return s === "FAILED" || s === "CANCELLED" || s === "CANCELED" || s === "TIMED_OUT" || s === "TIMEOUT";
}

function useRunPodAsync(vllmApiUrl) {
  if (process.env.RUNPOD_ASYNC === "false") return false;
  return String(vllmApiUrl || "").includes("runpod.ai");
}

/** Snapshot of queue + workers for cold-start decisions. */
async function getRunPodHealth(endpointId, apiKey, timeoutMs = 4000) {
  const res = await fetch(`${runPodApiBase(endpointId)}/health`, {
    headers: { Authorization: `Bearer ${apiKey.trim()}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`RunPod /health invalid JSON (${res.status})`);
  }
  if (!res.ok) throw new Error(`RunPod /health ${res.status}: ${text.slice(0, 200)}`);
  return data;
}

function countLiveWorkers(health) {
  const w = health?.workers || {};
  return (w.ready || 0) + (w.idle || 0) + (w.running || 0) + (w.initializing || 0);
}

/**
 * Tiny job that only exists to scale a min=0 worker. Skips if already warm or queued.
 * @returns {Promise<string|null>} job id or null when no kick needed
 */
async function ensureRunPodWarm(endpointId, apiKey) {
  if (!endpointId || !apiKey?.trim()) return null;
  let health;
  try {
    health = await getRunPodHealth(endpointId, apiKey);
  } catch (err) {
    console.warn("RunPod health check failed:", err.message);
    health = null;
  }
  if (health && (countLiveWorkers(health) > 0 || (health.jobs?.inQueue || 0) > 0)) {
    return null;
  }
  return submitRunPodJob(
    endpointId,
    apiKey,
    [{ role: "user", content: "ok" }],
    { temperature: 0, max_tokens: 1 },
    15000,
  );
}

module.exports = {
  parseRunPodEndpointId,
  runPodApiBase,
  buildRunPodInput,
  extractReplyFromRunPodOutput,
  submitRunPodJob,
  pollRunPodJob,
  cancelRunPodJob,
  isRunPodTerminalFailure,
  useRunPodAsync,
  getRunPodHealth,
  countLiveWorkers,
  ensureRunPodWarm,
};
