/**
 * Shared regeneration prompts for /api/chat (Netlify + local server).
 * Uses the same production super prompt stack as live chat + RunPod fine-tune.
 */

const { buildProductionSystemPrompt } = require("./buildProductionSystemPrompt.cjs");
const { trimTrainerRules, trimExemplars } = require("./llmChatHelpers.cjs");
const { buildConversationMemoryBlock } = require("./conversationMemory.cjs");

/** Anchored at start — used by isExactTargetPaste / formatTrainerRuleForPrompt. */
const EXACT_REPLY_PREFIXES = [
  /^use this (exact )?(reply|response|answer|text)/i,
  /^reply should be:/i,
  /^response should be:/i,
  /^should (say|reply|respond|write):/i,
  /^correct (reply|response):/i,
  /^the (reply|response) should be:/i,
  /^replace with:/i,
  /^wanted reply:/i,
  /^instead (say|reply|respond|write):/i,
  /^exact reply:/i,
  /^write this:/i,
  /^output this:/i,
  /^example of how it should (have )?responded/i,
  /^example (reply|response)/i,
  /^desired (reply|response)/i,
  /^target (reply|response)/i,
  /^here(?:'s| is) (the |what )?(exact )?(reply|response)/i,
  /^i am putting in text i want it to respond with/i,
];

/**
 * Mid-string markers (Simon often prefaces the paste). First capture group is unused;
 * match[0] is the label to strip; remainder is the target.
 */
const INLINE_EXACT_MARKERS = [
  /example of how it should (?:have )?responded\s*:?\s*/i,
  /(?:^|[\n.!?]\s*)(?:use this (?:exact )?(?:reply|response|answer|text)|reply should be|response should be|exact reply|wanted reply|desired (?:reply|response)|target (?:reply|response)|instead (?:say|reply|respond|write)|write this|output this|correct (?:reply|response)|the (?:reply|response) should be|replace with)\s*:?\s*/i,
  /i am putting in text i want it to respond with[^:]*:\s*/i,
];

const REGEN_TASK_BLOCK = `# Regeneration task (this request only)
You are rewriting one assistant reply using reviewer feedback. This is not a new coaching turn.

Hard requirements:
1. Follow feedback priorities exactly when they are safe and coherent.
2. When a target reply is provided, output that text only — no rewriting, no labels, no meta instructions.
3. Otherwise produce a **materially revised** response — different wording, structure, and opener from the previous assistant reply.
4. Keep factual integrity and the user's intent from the original user message.
5. Preserve safety constraints; refuse unsafe instructions.
6. **Adaptive tone:** Match how the user writes in the original user message. If they are casual, warm, or brief, mirror that — never sound more formal, corporate, or clinical than they do.
7. When feedback mentions tone, treat it as mandatory — lean conversational and human, not lecturing.
8. Output only the improved reply text (2–4 short sentences, one clear question). Never invent holidays, campaigns, or names the user did not mention.`;

function feedbackItemText(item) {
  if (typeof item?.feedbackText === "string") return item.feedbackText.trim();
  if (typeof item?.feedback_text === "string") return item.feedback_text.trim();
  return "";
}

function looksLikeMetaInstruction(text) {
  return /^(be |don't |do not |too |more |less |avoid |stop |needs? to |should be more|improve |fix |make it |add |remove |less |shorter|longer)/i.test(
    text,
  );
}

function extractAfterPrefix(text, prefix) {
  const rest = text.slice(prefix.length).replace(/^[\s:—–-]+/, "").trim();
  return rest.length >= 20 ? rest : "";
}

function sentenceCount(text) {
  return (String(text || "").match(/[.!?]/g) || []).length;
}

/** Reviewer write-ups must never be treated as the coach reply itself. */
function looksLikeReviewDocument(text) {
  const t = String(text || "");
  return (
    /\bwhat was (right|wrong)\b/i.test(t) ||
    /\b(any )?missed opportunities\b/i.test(t) ||
    /\bexample of how it should (have )?responded\b/i.test(t) ||
    /\b(accurate reflection|clinical\/abstract jargon|jumping to core)\b/i.test(t)
  );
}

function stripWrappingQuotes(text) {
  const t = String(text || "").trim();
  const m = t.match(/^["“]([\s\S]*)["”]$/);
  return m ? m[1].trim() : t;
}

/** Full-text paste that is already the coach reply (no label wrapper). */
function looksLikeWholeCoachPaste(text) {
  const t = String(text || "").trim();
  if (!t || looksLikeMetaInstruction(t) || looksLikeReviewDocument(t)) return false;
  const sentences = sentenceCount(t);
  if (t.length >= 80 && /[?？]/.test(t) && sentences >= 2) return true;
  if (t.length >= 220 && sentences >= 3) return true;
  // Long second-person coaching paste without a closing question (Tim-style).
  if (t.length >= 160 && sentences >= 2 && /\b(you|your|tim)\b/i.test(t)) return true;
  return false;
}

/** Quoted fragment must look like a complete reply, not critique leftovers. */
function isUsableQuotedTarget(quoted) {
  const t = String(quoted || "").trim();
  if (t.length < 60) return false;
  if (looksLikeMetaInstruction(t)) return false;
  if (/^[^\w]*[)\]]/.test(t)) return false;
  if (!/^[A-ZÀ-ÖØ-Þ“"]/.test(t)) return false;
  if (sentenceCount(t) < 1) return false;
  return /[.!?…]["”]?$/.test(t) || /[?？]/.test(t);
}

function extractViaInlineMarker(text) {
  for (const marker of INLINE_EXACT_MARKERS) {
    const match = text.match(marker);
    if (!match) continue;
    const after = stripWrappingQuotes(
      text.slice(match.index + match[0].length).replace(/^[\s:—–-]+/, "").trim(),
    );
    // Drop a trailing "Example of…" wrapper's leading meta if marker was mid-prose.
    if (after.length >= 40) return after;
  }
  for (const prefix of EXACT_REPLY_PREFIXES) {
    const match = text.match(prefix);
    if (!match || match.index !== 0) continue;
    const target = stripWrappingQuotes(extractAfterPrefix(text, match[0]));
    if (target) return target;
  }
  return "";
}

/**
 * True when feedback_text is (or contains) a pasted coach reply meant as the
 * training/exact label — not a short style rule for the live system prompt.
 */
function isExactTargetPaste(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  if (extractViaInlineMarker(t)) return true;
  return looksLikeWholeCoachPaste(t);
}

/**
 * Keep short behavioural rules for the live prompt; drop exact-reply pastes
 * (those become assistant labels in SFT export instead).
 */
function formatTrainerRuleForPrompt(text, maxChars = 180) {
  const t = String(text || "").trim();
  if (!t || isExactTargetPaste(t)) return "";
  const body = t.length <= maxChars ? t : `${t.slice(0, maxChars)}…`;
  return `- ${body}`;
}

/**
 * When Simon pastes the exact reply he wants, treat it as mandatory output.
 * Prefer labeled pastes over whole-text pastes over quoted fragments so a
 * critique with a stray quote never wins over an "Example of how…" paste.
 */
function extractExactTargetReply(feedbackList) {
  const texts = (feedbackList || []).map(feedbackItemText).filter(Boolean);

  for (const text of texts) {
    const fromMarker = extractViaInlineMarker(text);
    if (fromMarker) return fromMarker;
  }

  for (const text of texts) {
    if (looksLikeWholeCoachPaste(text)) return text;
  }

  for (const text of texts) {
    const quoted = text.match(/["“]([^"”]{60,})["”]/);
    if (quoted?.[1] && isUsableQuotedTarget(quoted[1])) return quoted[1].trim();
  }

  return null;
}

/** Single feedback_text → exact target string, or null. */
function extractExactTargetFromText(feedbackText) {
  return extractExactTargetReply([{ feedbackText: String(feedbackText || "") }]);
}

function summarizeRegenerationFeedback(regenerationContext) {
  return (regenerationContext?.feedbackList || [])
    .map((item) => {
      const text = feedbackItemText(item);
      if (!text) return "";
      const rating = typeof item?.rating === "number" ? ` (rating: ${item.rating}/5)` : "";
      const tags = Array.isArray(item?.tags) && item.tags.length ? ` [tags: ${item.tags.join(", ")}]` : "";
      return `- ${text}${rating}${tags}`;
    })
    .filter(Boolean)
    .join("\n");
}

function buildRegenerationUserPrompt(regenerationContext) {
  const feedbackBullets = summarizeRegenerationFeedback(regenerationContext);
  const userMessage = regenerationContext?.originalUserMessage || "";
  const previousReply = regenerationContext?.previousAssistantReply || "";
  const exactTarget = extractExactTargetReply(regenerationContext?.feedbackList);

  const sections = [
    "[Original user message — match this person's tone and register]",
    userMessage,
    "",
    "[Previous assistant reply — do NOT copy or lightly rephrase this]",
    previousReply,
    "",
    "[Reviewer feedback]",
    feedbackBullets || "- (No feedback provided)",
  ];

  if (exactTarget) {
    // Keep meta-instructions out of the same block as the target text — the LoRA
    // otherwise copies lines like "You may fix tiny grammar…" into the user-facing reply.
    sections.push(
      "",
      "[Target reply text]",
      exactTarget,
      "",
      "[Task]",
      "Output only the target reply text above. No preamble, no labels, no instructions.",
    );
  } else {
    sections.push(
      "",
      "[Task]",
      "Rewrite the assistant reply to address every feedback priority.",
      "The rewrite must be clearly different from the previous assistant reply (new opener, new question framing).",
      "If feedback quotes desired wording, use that wording.",
      "Sound like a warm human coach speaking to this specific user — not a formal report.",
      "Keep it concise (2–4 sentences), empathetic, and end with exactly one clear question.",
      "Do not output analysis, labels, or metadata — only the improved reply text.",
    );
  }

  return sections.join("\n");
}

function buildRegenerationSystemContent(opts = {}) {
  const {
    trainerRules = "",
    exemplars = "",
    journeyContext = null,
    regenerationContext = null,
    chatHistory = null,
    forInference = true,
  } = opts;

  const feedbackSummary = summarizeRegenerationFeedback(regenerationContext);
  const exactTarget = extractExactTargetReply(regenerationContext?.feedbackList);
  const history = Array.isArray(chatHistory)
    ? chatHistory.filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    : [];
  const conversationMemory = history.length ? buildConversationMemoryBlock(history) : "";

  let content = buildProductionSystemPrompt({
    trainerRules: forInference ? trimTrainerRules(trainerRules, 10, 180) : trainerRules,
    exemplars: forInference ? trimExemplars(exemplars, 3, 220) : exemplars,
    journeyContext,
    conversationMemory,
    turnFeedback: feedbackSummary || undefined,
    forInference,
  });

  content += `\n\n${REGEN_TASK_BLOCK}\n`;

  if (exactTarget) {
    content += `\n# Mandatory target reply (verbatim output required)\n${exactTarget}\n`;
  }

  return content;
}

module.exports = {
  REGEN_TASK_BLOCK,
  buildRegenerationUserPrompt,
  buildRegenerationSystemContent,
  summarizeRegenerationFeedback,
  extractExactTargetReply,
  extractExactTargetFromText,
  isExactTargetPaste,
  formatTrainerRuleForPrompt,
};
