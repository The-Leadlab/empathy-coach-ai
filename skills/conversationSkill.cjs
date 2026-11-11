/**
 * Conversation skill — Phase 1/2 dialogue craft from Tim CBT case-formulation guide.
 * Runtime Layer-2 only (does not require a retrain). Source:
 * docs/tim-cbt-case-formulation-v2.pdf (CBT Case Formulation & Goal Architecture).
 */

const CONVERSATION_SKILL_PROMPT_BLOCK = `# Conversation skill (mandatory — Phase 1 & 2 dialogue craft)

## Every Phase One reply (order)
1. **Lead with their words** — short acknowledgment that reuses the user's own phrasing (stuck, freeze, fraud, scrolling…). Never swap in clinical labels they did not use (e.g. "spike in stress", "experiential avoidance", "hot cross bun").
2. **Normalise briefly** when shame or imposter feelings show up — one plain sentence that lowers pressure, then continue. Do not lecture.
3. **Reflect the 4 systems already disclosed** (situation → thoughts → feelings/body → what they do/avoid) in everyday language before asking anything new. Only name what they already said; do not invent missing pieces.
4. **One Socratic question** that targets the next missing link in the map. Briefly say *why* you are asking about that moment (so the cognitive model is socialised, not jumped into).
5. Stay in conceptualisation — no goals, ladders, or techniques until Reflective Handshake is confirmed.

## Phase Two goal architecture (when handshake is done)
- Define success as **process** the user controls (honest, fair, professional delivery) — never as guaranteeing someone else's agreement or emotional reaction.
- Ladder: **maximum 5 sequential steps**, each with **at most 2 concrete micro-actions**.
- Bake in behavioural control where avoidance/phone/scrolling appears (stimulus control, time-boxing, phone out of reach) as part of a step — do not dump a whole toolkit.
- One active micro-action at a time; confidence check before locking Tasks.

## Anti-hallucination inside this skill
- Never invent workplace facts, named people (including "Tim"), motives, or a second scenario.
- Never paste this skill's labels, "systems", or step numbers to the user.
- If the user already answered an element, acknowledge and move to the next — do not re-ask.`;

const CONVERSATION_SKILL_INFERENCE_BLOCK = `# Conversation skill (condensed)
Phase One: reuse their words → brief normalise if shame/imposter → reflect situation/thoughts/feelings-body/avoidance they already gave → one Socratic question on the next missing link (explain why that moment) → no goals yet.
Phase Two: process goals (controllable fairness/professionalism, not others' reactions); ≤5 steps × ≤2 micro-actions; stimulus control inside steps when avoidance shows; one micro-action at a time.
Never invent names/facts; never use clinical jargon they did not use.`;

/**
 * Lightweight extract of Hot-Cross-Bun style elements already present in user text.
 * Used to enrich conversation memory so the model stops re-asking disclosed pieces.
 */
function extractDisclosedCbtMap(history) {
  if (!Array.isArray(history) || history.length === 0) return null;

  const userText = history
    .filter((m) => m && m.role === "user" && typeof m.content === "string")
    .map((m) => m.content)
    .join("\n");
  if (!userText.trim()) return null;

  const lower = userText.toLowerCase();
  const found = [];

  if (
    /\b(open(?:ing|ed)?|when i|at (?:my )?desk|deadline|meeting|review|evaluation|appraisal|email|laptop|document|file)\b/i.test(
      userText
    )
  ) {
    found.push("situation cues present");
  }
  if (
    /\b((?:feel(?:ing)? like (?:a )?|i(?:'m| am) (?:a )?)(?:total )?fraud|who am i to|they(?:'ll| will) think|can(?:'?t|not) find the (?:right )?words|i(?:'m| am) not (?:good |qualified)|they(?:'ll| will) reject|unfair)\b/i.test(
      lower
    ) ||
    /["“][^"”]{8,}["”]/.test(userText)
  ) {
    found.push("automatic thoughts / self-talk present");
  }
  if (
    /\b(stuck|stressed|anxious|anxiety|dread|freeze|frozen|overwhelm|guilty|shame|afraid|fear|tension|tight|heart|breath)\b/i.test(
      lower
    )
  ) {
    found.push("feelings / body cues present");
  }
  if (
    /\b(scroll(?:ing)?|close(?:d)? (?:my )?(?:laptop|doc)|put(?:ting)? off|procrastinat|avoid|delete(?:d|ing)?|rewrit|phone|instagram|social media)\b/i.test(
      lower
    )
  ) {
    found.push("avoidance / coping behaviour present");
  }

  if (!found.length) return null;
  return `Already disclosed by user (do not re-ask; reflect then advance): ${found.join("; ")}.`;
}

function formatConversationSkillForPrompt(opts = {}) {
  return opts.condensed ? CONVERSATION_SKILL_INFERENCE_BLOCK : CONVERSATION_SKILL_PROMPT_BLOCK;
}

module.exports = {
  CONVERSATION_SKILL_PROMPT_BLOCK,
  CONVERSATION_SKILL_INFERENCE_BLOCK,
  formatConversationSkillForPrompt,
  extractDisclosedCbtMap,
};
