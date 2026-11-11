/**
 * Natural coach voice — sits beside the LoRA, not a retrain.
 * Principles adapted for coaching from conversational "human presence" skills
 * (e.g. iamhumans Mode A): vary shape, lead with acknowledgment, ban stock closings.
 */

/** Exact / near-exact closings the fine-tune overuses. */
const STOCK_CLOSING_PATTERNS = [
  /what feels most pressing about that for you right now\??\s*$/i,
  /what feels most pressing (about|for) you right now\??\s*$/i,
  /you are noticing something real( about .{1,60})?\.\s*$/i,
  /^you(?:'re| are) noticing something real\b/i,
  /^you(?:'re| are) facing a challenge today\b/i,
];

/** Internal regeneration / system lines that must never appear in user-facing text. */
const INSTRUCTION_LEAK_PATTERNS = [
  /you may fix tiny grammar or punctuation only/i,
  /do not rewrite, shorten, or revert to the previous reply/i,
  /mandatory target reply/i,
  /\[reviewer feedback\]/i,
  /\[previous assistant reply/i,
  /\[original user message/i,
  /regeneration task \(this request only\)/i,
  /output only the improved reply text/i,
  /return the mandatory target reply exactly/i,
];

/** Prompt block appended into the live coach system prompt. */
const NATURAL_VOICE_PROMPT_BLOCK = `# Natural voice (mandatory — overrides LoRA stock habits)
You are a real coaching partner in conversation, not a script reader.
- Lead with a short, specific acknowledgment of *this* message — reuse their words, not a generic opener.
- Ask exactly one new question that fits *this* turn of the protocol. Vary wording every time.
- Never use these collapsed phrases (or close paraphrases): "What feels most pressing about that for you right now?", "You are noticing something real…", "You're facing a challenge today…".
- Do not end every turn with the same question shape. Prefer concrete asks (what happened, what they tried, how strong a thought feels, what they fear would happen).
- Keep 1–3 short sentences. Contractions are fine. Sound like a skilled colleague, not a worksheet.
- If your draft repeats your previous closing question, rewrite it before sending.

# Anti-hallucination (mandatory)
- Stay inside the user's stated situation only. Do not invent a second professional context, holiday, campaign, news story, or named person they did not mention.
- Do not mention World Mental Health Day, awareness campaigns, or calendar events unless the user brought them up.
- Do not invent names (e.g. "Tim"), job titles, deadlines, or goals/steps the user did not agree.
- Do not impose clinical/analytical labels the user did not use (e.g. "spike in stress", "experiential avoidance", "catastrophic prediction") — reuse their words instead.
- Never paste instructions, feedback labels, or "fix tiny grammar" meta-text into the reply.
- If the user already disclosed situation, thoughts, feelings/body, and avoidance, reflect that map back before asking anything new — do not pretend you need the whole story again.`;

function hasStockClosing(text) {
  const visible = String(text ?? "").trim();
  if (!visible) return false;
  return STOCK_CLOSING_PATTERNS.some((re) => re.test(visible));
}

/**
 * Catches LoRA truncation / mid-word glue like "real. ccessing" or "progression. f you want".
 * Avoids flagging normal "Hard. What happened?" continuations.
 */
function hasGarbledTruncation(text) {
  const visible = String(text ?? "").trim();
  if (!visible) return false;
  if (/\.\s+[bcdfghjklmnpqrstvwxz]{2,}[a-z]{3,}\b/i.test(visible)) return true;
  if (/\.\s+[a-z]\s+you\b/i.test(visible)) return true;
  return false;
}

function hasInstructionLeak(text) {
  const visible = String(text ?? "").trim();
  if (!visible) return false;
  return INSTRUCTION_LEAK_PATTERNS.some((re) => re.test(visible));
}

/** Walls of text / leaked goal ladders that break the 1–3 sentence coach contract. */
function hasWallOfText(text) {
  const visible = String(text ?? "").trim();
  if (!visible) return false;
  if (visible.length > 700) return true;
  if ((visible.match(/\n/g) || []).length >= 5) return true;
  if (/\bDay\s*#?\s*\d+\s*Goal\b/i.test(visible) && visible.length > 280) return true;
  if (/\bStep\s*1\s*[:.-]/i.test(visible) && visible.length > 350) return true;
  return false;
}

/**
 * Drop leading meta/instruction lines the model echoed, keep the real coach text if any.
 */
function stripInstructionLeakPrefix(text) {
  let out = String(text ?? "").trim();
  // Cut everything up to the first line that looks like coach speech after a leak marker.
  for (const re of INSTRUCTION_LEAK_PATTERNS) {
    const m = out.match(re);
    if (!m || m.index === undefined) continue;
    // If leak is at the start, try to find a later sentence that looks user-facing.
    if (m.index < 80) {
      const after = out.slice(m.index + m[0].length).replace(/^[\s—–-]+/, "");
      const sentence = after.match(/[A-Z][\s\S]{20,}/);
      if (sentence) out = sentence[0].trim();
    }
  }
  return out.trim();
}

function naturalVoiceRejectReason(text) {
  if (hasInstructionLeak(text)) return "instruction_leak";
  if (hasWallOfText(text)) return "wall_of_text";
  if (hasStockClosing(text)) return "stock_closing";
  if (hasGarbledTruncation(text)) return "garbled";
  return null;
}

module.exports = {
  NATURAL_VOICE_PROMPT_BLOCK,
  STOCK_CLOSING_PATTERNS,
  INSTRUCTION_LEAK_PATTERNS,
  hasStockClosing,
  hasGarbledTruncation,
  hasInstructionLeak,
  hasWallOfText,
  stripInstructionLeakPrefix,
  naturalVoiceRejectReason,
};
