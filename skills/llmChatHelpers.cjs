/**
 * Shared LLM request helpers for netlify/functions/chat.js and server/server.js.
 * Keeps RunPod/vLLM context inside model limits and retries cold starts.
 */

const { STOP_SEQUENCES } = require("./coachReply.cjs");

/** Conservative estimate — prefer over-counting so we trim before the API rejects. */
function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 3);
}

function estimateMessagesTokens(messages) {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0);
}

function trimTrainerRules(rules, maxLines = 10, maxLineChars = 180) {
  if (!rules?.trim()) return "";
  const lines = rules
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxLines)
    .map((line) => {
      const body = line.replace(/^-\s*/, "");
      if (body.length <= maxLineChars) return `- ${body}`;
      return `- ${body.slice(0, maxLineChars)}…`;
    });
  return lines.join("\n");
}

function trimExemplars(exemplars, maxItems = 3, maxItemChars = 220) {
  if (!exemplars?.trim()) return "";
  return exemplars
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((line) => {
      const body = line.replace(/^\d+\.\s*/, "");
      if (body.length <= maxItemChars) return body;
      return `${body.slice(0, maxItemChars)}…`;
    })
    .map((line, i) => `${i + 1}. ${line}`)
    .join("\n");
}

function truncateToTokenBudget(text, maxTokens) {
  const raw = String(text || "");
  if (estimateTokens(raw) <= maxTokens) return raw;
  const maxChars = Math.max(80, Math.floor(maxTokens * 2.8));
  if (raw.length <= maxChars) return raw;
  // Keep head + tail so long documents (uploads) don't lose endings/conclusions.
  const head = Math.max(40, Math.floor(maxChars * 0.72));
  const tail = Math.max(24, Math.floor(maxChars * 0.22));
  if (head + tail + 80 < raw.length) {
    return `${raw.slice(0, head)}\n\n[…middle omitted to fit the model window — ${raw.length} characters total…]\n\n${raw.slice(-tail)}`;
  }
  return `${raw.slice(0, maxChars)}\n\n[…trimmed to fit the model window…]`;
}

/**
 * Drop oldest history until messages fit token budget (always keeps system + latest user).
 * Also truncates an oversized latest user turn (e.g. uploaded PDF) so it cannot blow the window.
 */
function trimMessagesForContext(messages, opts = {}) {
  if (!Array.isArray(messages) || messages.length < 2) return messages;

  const maxContextTokens =
    Number(opts.maxContextTokens) || Number(process.env.VLLM_MAX_CONTEXT_TOKENS) || 4096;
  const reserveOutputTokens =
    Number(opts.reserveOutputTokens) || Number(process.env.VLLM_MAX_TOKENS) || 500;
  const safetyMargin = Number(opts.safetyMarginTokens) || 192;
  const aggressive = !!opts.aggressive;

  const budget = Math.max(900, maxContextTokens - reserveOutputTokens - safetyMargin);
  const system = messages[0];
  let last = messages[messages.length - 1];
  const history = messages.slice(1, -1);

  const lastTokens = estimateTokens(last.content);
  const looksLikeUpload = /\[Uploaded document for analysis:/i.test(String(last.content || ""));
  // Prefer the latest turn (especially uploads); drop older history rather than cutting the doc early.
  let minHistoryMessages = Number(opts.minHistoryMessages);
  if (!Number.isFinite(minHistoryMessages)) {
    if (looksLikeUpload || lastTokens > 1200) minHistoryMessages = 0;
    else if (lastTokens > 600) minHistoryMessages = 2;
    else minHistoryMessages = 8;
  }
  if (aggressive) minHistoryMessages = Math.min(minHistoryMessages, 0);

  // Note: Array#slice(-0) returns the full array — treat 0 as “drop all history”.
  let kept =
    minHistoryMessages <= 0
      ? []
      : history.length > minHistoryMessages
        ? history.slice(-minHistoryMessages)
        : [...history];

  const packTokens = (sysContent, lastContent, hist) =>
    estimateTokens(sysContent) + estimateTokens(lastContent) + estimateMessagesTokens(hist);

  // Give uploads as much of the window as possible; only shrink when still over budget.
  const maxLastShare = Math.floor(
    budget * (looksLikeUpload ? (aggressive ? 0.78 : 0.85) : aggressive ? 0.4 : 0.55),
  );
  if (estimateTokens(last.content) > maxLastShare) {
    last = { ...last, content: truncateToTokenBudget(last.content, maxLastShare) };
  }

  while (kept.length > 0 && packTokens(system.content, last.content, kept) > budget) {
    kept.shift();
  }

  // Shorten remaining oldest history turns
  while (kept.length > 0 && packTokens(system.content, last.content, kept) > budget) {
    const head = kept[0];
    const allowed = Math.max(
      40,
      budget - estimateTokens(system.content) - estimateTokens(last.content) - estimateMessagesTokens(kept.slice(1)) - 8,
    );
    const shorter = truncateToTokenBudget(head.content, allowed);
    if (shorter === head.content || shorter.length < 48) {
      kept.shift();
      continue;
    }
    kept[0] = { ...head, content: shorter };
    if (packTokens(system.content, last.content, kept) > budget) kept.shift();
    else break;
  }

  let systemMsg = system;
  while (packTokens(systemMsg.content, last.content, kept) > budget && systemMsg?.content) {
    const room =
      budget - estimateTokens(last.content) - estimateMessagesTokens(kept) - 32;
    const trimmed = trimSystemContent(systemMsg.content, Math.max(400, room));
    if (trimmed === systemMsg.content) break;
    systemMsg = { ...systemMsg, content: trimmed };
  }

  // Final hard guarantee: shrink last message until we fit.
  while (packTokens(systemMsg.content, last.content, kept) > budget) {
    const room = budget - estimateTokens(systemMsg.content) - estimateMessagesTokens(kept) - 16;
    if (room < 80) {
      // Drop all history if still impossible
      if (kept.length > 0) {
        kept = [];
        continue;
      }
      last = { ...last, content: truncateToTokenBudget(last.content, Math.max(60, room)) };
      break;
    }
    const next = truncateToTokenBudget(last.content, room);
    if (next === last.content) break;
    last = { ...last, content: next };
  }

  return [systemMsg, ...kept, last];
}

/** Shrink system prompt sections when still over the model context window. */
function trimSystemContent(content, maxTokens) {
  let text = String(content || "");
  if (estimateTokens(text) <= maxTokens) return text;

  const dropSections = [
    /# Admin-starred exemplar replies[\s\S]*/i,
    /# Trainer global standards[\s\S]*/i,
    /# Conversation memory[\s\S]*/i,
    /## Sequential stage lock[\s\S]*?(?=## |\n# |$)/i,
  ];
  for (const pattern of dropSections) {
    text = text.replace(pattern, "").trim();
    if (estimateTokens(text) <= maxTokens) return text;
  }

  return truncateToTokenBudget(text, maxTokens);
}

function isContextLengthError(errText) {
  const t = String(errText || "");
  return /maximum context length|context length is|input_tokens|too many tokens|context window|token limit/i.test(
    t,
  );
}

function parseLlmErrorMessage(errText, status) {
  const raw = String(errText || "").trim();
  if (!raw) return userFacingLlmError(status);

  if (isContextLengthError(raw)) {
    return "That message was too large for the coach model — please send it again (we’ll pack more tightly).";
  }

  try {
    const parsed = JSON.parse(raw);
    const msg =
      parsed?.error?.message ||
      parsed?.message ||
      (typeof parsed?.error === "string" ? parsed.error : null);
    if (msg && isContextLengthError(msg)) {
      return "That message was too large for the coach model — please send it again (we’ll pack more tightly).";
    }
    if (typeof msg === "string" && msg.length > 0 && msg.length < 200) {
      return msg;
    }
  } catch {
    // not JSON
  }

  if (raw.length < 200 && !raw.includes("{")) return raw;
  return userFacingLlmError(status);
}

/**
 * @param {string} mode - chat | regenerate | name_journey
 * @param {{ summaryTurn?: boolean }} [opts] - the Phase One summary needs a little more room
 */
function buildSamplingParams(mode, opts = {}) {
  // Slightly higher default so the LoRA is less locked into stock closings.
  const temperature = Number(process.env.VLLM_TEMPERATURE) || 0.72;
  const chatMaxTokens = Number(process.env.VLLM_MAX_TOKENS) || (opts.summaryTurn ? 350 : 250);
  const base = {
    temperature:
      mode === "regenerate" ? Math.max(temperature, 0.78) : mode === "name_journey" ? 0.3 : temperature,
    max_tokens: mode === "name_journey" ? 32 : chatMaxTokens,
    repetition_penalty: Number(process.env.VLLM_REPETITION_PENALTY) || 1.1,
    presence_penalty: Number(process.env.VLLM_PRESENCE_PENALTY) || 0.25,
    frequency_penalty: Number(process.env.VLLM_FREQUENCY_PENALTY) || 0.15,
    stop: STOP_SEQUENCES,
  };
  return base;
}

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504, 524]);

async function fetchLlmWithRetries(doRequest, opts = {}) {
  const maxAttempts = Number(opts.maxAttempts) || (opts.isRunPod ? 3 : 2);
  const baseDelayMs = Number(opts.baseDelayMs) || (opts.isRunPod ? 4000 : 2000);
  let lastRes = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    lastRes = await doRequest();
    if (lastRes.ok || !RETRYABLE_STATUSES.has(lastRes.status)) {
      return { res: lastRes, attempts: attempt };
    }
    if (attempt < maxAttempts) {
      const waitMs = baseDelayMs * attempt;
      console.warn(`LLM ${lastRes.status}, retry ${attempt}/${maxAttempts - 1} in ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  return { res: lastRes, attempts: maxAttempts };
}

function userFacingLlmError(status) {
  if (status === 400) return "The coach could not process that message — please try again.";
  if (status === 429) return "The AI is in high demand. Please try again in a moment.";
  if (status === 503 || status === 504 || status === 524) {
    return "The coach is warming up — please send your message again in a few seconds.";
  }
  return "Avatar is currently unavailable. (LLM provider error.)";
}

module.exports = {
  estimateTokens,
  estimateMessagesTokens,
  trimTrainerRules,
  trimExemplars,
  trimMessagesForContext,
  trimSystemContent,
  truncateToTokenBudget,
  isContextLengthError,
  parseLlmErrorMessage,
  buildSamplingParams,
  fetchLlmWithRetries,
  userFacingLlmError,
  RETRYABLE_STATUSES,
};
