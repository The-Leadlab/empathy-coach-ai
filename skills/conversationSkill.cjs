/**
 * Conversation skill — Phase 1/2 dialogue craft from Tim CBT case-formulation guide.
 * Runtime Layer-2 only (does not require a retrain). Source:
 * docs/tim-cbt-case-formulation-v2.pdf (CBT Case Formulation & Goal Architecture).
 */

const CONVERSATION_SKILL_PROMPT_BLOCK = `# Conversation skill (mandatory — Phase 1 & 2 dialogue craft)

## North Star (why Phase One exists)
Conceptualisation is not endless chat about the latest sentence. It maps **one** presenting problem (Two Pillars + maintenance loop) so you can lock a **Goal** after Reflective Handshake, then keep returning to that Goal in Phase Two/Three. Every map question should enrich that problem — not chase a tangent or re-ask what they already answered (including answers given in their own informal way).

## Turn template (all phases — Simon)
1. **Sentence 1:** validate feelings and reflect their language.
2. **Sentence 2:** connect to the map / maintenance loop / locked Goal.
3. Exactly **one** clear question.

## Every Phase One reply (order)
1. **Lead with their words** — short acknowledgment that reuses the user's own phrasing (stuck, freeze, fraud, scrolling…). Never swap in clinical labels they did not use (e.g. "spike in stress", "experiential avoidance", "hot cross bun").
2. **Normalise briefly** when shame or imposter feelings show up — one plain sentence that lowers pressure, then continue. Do not lecture.
3. **Two Pillars map (Phase 1.2):** Pillar A Cognitive Driver — feared trigger, hot thought, demanding rule/assumption, belief 0–100%. Pillar B Response Outcome — primary emotion, avoidance/safety behaviour, somatic sensation, distress 0–100%. Reflect what they already disclosed before asking anything new.
4. **Downward-arrow first** — deepen meaning/evidence of the hot thought (2–3 levels) before body probes. Do not jump from a surface thought straight to bodily feelings.
5. **One Socratic question** that targets the next missing pillar piece. Briefly say *why* that moment (socialise the link).
6. Stay in conceptualisation of the **single presenting problem** — no goals, ladders, or techniques until Reflective Handshake. After both pillars: one turn socialising the **maintenance loop** (rule → surge → coping → short-term relief that keeps the belief locked).
7. **When the map is full:** close with Reflective Handshake (summary + fit?) — do **not** keep probing the last message. After they confirm, lock Goal and stay loyal to it.

## Phase Two goal architecture (when handshake is done) — Simon 26 Nov
- Affirm the confirmed map. Ask what goal would help them get past the problem. Ask what reaching it would mean for them. Take a dedication rating **0–100**, then **lock** the short-term objective in writing.
- When they give a goal, lock it — do not re-ask them to invent the goal again.
- Ladder: **maximum 5 sequential steps**, each with **2–4 concrete micro-actions**, written in chat as Step 1 / Step 2…
- When scrolling/avoidance is in the loop, include plain setup actions (phone in another room, timer) — do not say "stimulus control" to the client.
- Confidence 1–10 before practice lock; if &lt;7 ask why, what makes it that, and what to change — then shrink. On "deal" lock when/where they will run it.
- **HCPR/DTR** belong on the Sustainability Path (Phase Three) when they cannot activate a step — not dumped during ladder build.
- **Return to Goal:** check-ins, pivots, and retries always refer back to this Goal.

## Anti-hallucination inside this skill
- Never invent workplace facts, named people (including "Tim"), motives, or a second scenario.
- Never paste this skill's labels, "systems", or step numbers to the user.
- If the user already answered an element (even informally), acknowledge and move to the next — do not re-ask.`;

const CONVERSATION_SKILL_INFERENCE_BLOCK = `# Conversation skill (condensed)
North Star: Two-Pillar map one problem → maintenance loop → Handshake → Goal (meaning + dedication 0–100) → every later turn serves that Goal (never chase only the last message; never re-ask after they answered in their own way).
Turn: validate + reflect → connect to map/Goal → one question.
Phase One: Pillar A (trigger/thought/rule/belief%) + Pillar B (emotion/avoidance/body/distress%); downward-arrow before body; socialise maintenance loop; Handshake when full.
Phase Two: affirm → meaning → dedication → lock Goal → Step N with 2–4 micros (phone away/timer in plain words) → confidence ≥7 or ask why/what to change. HCPR/DTR = Phase Three when stuck activating. Stay loyal to Goal.
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
    /\b(stuck|stressed|anxious|anxiety|dread|freeze|frozen|overwhelm|guilty|guilt|shame|afraid|fear|tension|tight|heart|breath|foggy|exhausted|paralyz|crushing|heavy)\b/i.test(
      lower
    )
  ) {
    found.push("feelings / body cues present — do not re-ask how they feel");
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
