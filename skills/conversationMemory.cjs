/**
 * Conversation memory + Phase One routing for live inference.
 */

const { extractDisclosedCbtMap } = require("./conversationSkill.cjs");

const PHASE_ONE_ELEMENT_ORDER = ["trigger", "rule", "belief", "strength", "coping"];

const ELEMENT_ASK_PATTERNS = {
  trigger: /trigger|sets? it off|right before|what happens when|spike|sets this off|in the moment/i,
  rule: /\bif\b.{0,40}\bthen\b|rule|assumption|inner voice|fear|worry|belief about/i,
  belief: /how strongly|0\s*to\s*100|0-100|believe that|strength of belief|%\s*right now/i,
  strength: /how strongly|0\s*to\s*100|0-100|strength of belief/i,
  coping: /body|emotion|feel in your body|what do you do|cope|avoid|response when/i,
};

function detectAskedPhaseOneElements(assistantMessages) {
  const asked = new Set();
  for (const text of assistantMessages) {
    if (typeof text !== "string") continue;
    for (const [element, pattern] of Object.entries(ELEMENT_ASK_PATTERNS)) {
      if (pattern.test(text)) asked.add(element);
    }
  }
  return asked;
}

function nextPhaseOneElement(assistantMessages) {
  const asked = detectAskedPhaseOneElements(assistantMessages);
  for (const element of PHASE_ONE_ELEMENT_ORDER) {
    if (!asked.has(element)) return element;
  }
  return "summary";
}

function detectPhaseOneFocusFromAssistant(assistantText) {
  if (typeof assistantText !== "string" || !assistantText.trim()) return null;
  for (const [element, pattern] of Object.entries(ELEMENT_ASK_PATTERNS)) {
    if (pattern.test(assistantText)) return element;
  }
  return null;
}

function normalizeChatHistory(chatHistory, userMessage) {
  if (!Array.isArray(chatHistory)) return [];
  let history = chatHistory
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.trim() }))
    .filter((m) => m.content.length > 0);

  const user = typeof userMessage === "string" ? userMessage.trim() : "";
  if (history.length > 0 && history[history.length - 1].role === "user" && user && history[history.length - 1].content === user) {
    history = history.slice(0, -1);
  }
  return history;
}

function buildConversationMemoryBlock(history, maxChars = 2200) {
  if (!Array.isArray(history) || history.length === 0) return "";

  const lines = [];
  const disclosed = extractDisclosedCbtMap(history);
  if (disclosed) lines.push(`- ${disclosed}`);

  for (const m of history.slice(-14)) {
    const label = m.role === "user" ? "User said" : "Coach said";
    const text = String(m.content || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 320);
    if (text) lines.push(`- ${label}: ${text}`);
  }

  return lines.join("\n").slice(0, maxChars);
}

function formatPhaseOneNextElementInstruction(element) {
  const map = {
    trigger: "Ask what triggers or spikes the reaction (one question). Do not re-ask the main scenario.",
    rule: "Ask for the 'if…then' rule or fear driving their behaviour (one question).",
    belief: "Ask what they believe would happen if the rule were broken (one question).",
    strength: "Ask belief strength 0–100% (one question).",
    coping: "Ask what they feel in body/emotions and what they do or avoid (one question).",
    summary: "Present a plain-language summary of situation → trigger → rule → belief → coping and ask if it fits (Reflective Handshake).",
  };
  return map[element] || map.trigger;
}

module.exports = {
  PHASE_ONE_ELEMENT_ORDER,
  detectAskedPhaseOneElements,
  nextPhaseOneElement,
  detectPhaseOneFocusFromAssistant,
  normalizeChatHistory,
  buildConversationMemoryBlock,
  formatPhaseOneNextElementInstruction,
};
