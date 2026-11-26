/**
 * Single source of truth for the Miro 6-state coach machine + Hot Cross Bun map order.
 * Used by coachReply, llmEnginePhases, journeyContext, and (mirrored) client routers.
 */

/**
 * Two Pillars (Simon Phase 1.2) — Cognitive Drivers then Response Engine.
 * Keys stay compatible with coachReply capture; order = Pillar A then Pillar B (coping = emotion/body/avoidance).
 */
const PHASE_ONE_ELEMENTS = ["situation", "trigger", "rule", "belief", "strength", "coping"];

const PROTOCOL_STATES = Object.freeze({
  SCENARIO_EXTRACTION: "SCENARIO_EXTRACTION",
  MAP_CORE_COMPONENTS: "MAP_CORE_COMPONENTS",
  FORMULATION_SUMMARY_CONFIRMATION: "FORMULATION_SUMMARY_CONFIRMATION",
  GOAL_SETTING: "GOAL_SETTING",
  MICRO_STEPPING_AND_CONFIDENCE_CHECK: "MICRO_STEPPING_AND_CONFIDENCE_CHECK",
  PHASE_2_GATE_LOCKED: "PHASE_2_GATE_LOCKED",
});

const STATE_ORDER = [
  PROTOCOL_STATES.SCENARIO_EXTRACTION,
  PROTOCOL_STATES.MAP_CORE_COMPONENTS,
  PROTOCOL_STATES.FORMULATION_SUMMARY_CONFIRMATION,
  PROTOCOL_STATES.GOAL_SETTING,
  PROTOCOL_STATES.MICRO_STEPPING_AND_CONFIDENCE_CHECK,
  PROTOCOL_STATES.PHASE_2_GATE_LOCKED,
];

/**
 * Derive Miro protocol state from journey context (no new DB column required).
 * @param {object|null|undefined} ctx
 */
function resolveProtocolState(ctx) {
  if (!ctx || typeof ctx !== "object") return PROTOCOL_STATES.SCENARIO_EXTRACTION;

  const conf = ctx.microGoalConfidence ?? ctx.micro_goal_confidence;
  const micro = ctx.activeMicroGoal ?? ctx.active_micro_goal;
  const target = ctx.targetOutcome ?? ctx.target_outcome;
  const confirmed = !!(ctx.phaseOneConfirmed ?? ctx.phase_one_confirmed);
  const phase = ctx.platformPhase ?? ctx.platform_phase ?? 1;
  const step = ctx.phaseOneStep ?? ctx.phase_one_step ?? 1;
  const asking = ctx.phaseOneState?.asking ?? null;
  const pivot = !!(ctx.sustainabilityPivotActive ?? ctx.sustainability_pivot_active);
  const backtrack = !!(ctx.architecturalBacktrackActive ?? ctx.architectural_backtrack_active);

  // After lock, Phase Three practice / pivot still sits on PHASE_2_GATE_LOCKED machine
  // (practice is the locked-ladder operating mode).
  if (pivot || backtrack) return PROTOCOL_STATES.PHASE_2_GATE_LOCKED;
  if (phase >= 3 && confirmed) return PROTOCOL_STATES.PHASE_2_GATE_LOCKED;
  if (confirmed && micro && typeof conf === "number" && conf >= 7) {
    return PROTOCOL_STATES.PHASE_2_GATE_LOCKED;
  }

  if (confirmed) {
    if (micro && (conf == null || conf < 7)) {
      return PROTOCOL_STATES.MICRO_STEPPING_AND_CONFIDENCE_CHECK;
    }
    if (target || micro) {
      // Have outcome or micro but not yet confidence-locked
      if (micro) return PROTOCOL_STATES.MICRO_STEPPING_AND_CONFIDENCE_CHECK;
      return PROTOCOL_STATES.GOAL_SETTING;
    }
    return PROTOCOL_STATES.GOAL_SETTING;
  }

  if (asking === "summary" || step >= 3) {
    return PROTOCOL_STATES.FORMULATION_SUMMARY_CONFIRMATION;
  }
  if (step >= 2 || ctx.presentingChallenge || ctx.presenting_challenge) {
    return PROTOCOL_STATES.MAP_CORE_COMPONENTS;
  }
  return PROTOCOL_STATES.SCENARIO_EXTRACTION;
}

function protocolStateTurnInstruction(state, ctx = {}) {
  switch (state) {
    case PROTOCOL_STATES.SCENARIO_EXTRACTION:
      return `# Protocol state: SCENARIO_EXTRACTION (STATE 1)
Ask for one concrete recent situation (who, where, when, what happened). No rules, beliefs, goals, shared goals, feedback goals, ladders, or advice yet.
Only use facts from this journey. One short reflection + exactly one question.
North Star: this situation becomes the problem you will Goal against after Handshake — stay with it.`;

    case PROTOCOL_STATES.MAP_CORE_COMPONENTS:
      return `# Protocol state: MAP_CORE_COMPONENTS (STATE 2) — Phase 1.2 Two Pillars (Simon)
Map **one** presenting problem — one missing element per turn.
Pillar A Cognitive Driver: feared situation/trigger → hot thought → downward-arrow deepen (meaning/evidence, 2–3 levels) → demanding rule/assumption → belief strength 0–100%.
Pillar B Response Outcome: primary emotion → avoidance/safety behaviour → somatic → distress intensity 0–100%.
Do **not** jump from a surface thought straight to body feelings — Socratic deepen first.
After both pillars have content: socialise the maintenance loop (rule → surge → coping → short-term relief that keeps belief locked) before Handshake.
Do not re-ask known elements (accept informal answers). Do not chase a new tangent from the last message.
HARD BAN this state: goals, shared goals, ladders, techniques, Tasks, HCPR/DTR dumps.`;

    case PROTOCOL_STATES.FORMULATION_SUMMARY_CONFIRMATION:
      return `# Protocol state: FORMULATION_SUMMARY_CONFIRMATION (STATE 3 — hard gate / Reflective Handshake)
This is conceptualisation close — NOT another probe on the last message.
Present a short plain-language Two-Pillar + maintenance-loop summary using ONLY what this user said. Never invent a training scenario or workplace story they did not share.
End with ONE verification question ("Does that fit how things are working for you right now?").
HARD BAN: "what happens when…", "what feels most…", goal/ladder asks, new topics, repeating your previous question. If they correct one part, update that part only.
After their yes you MUST enter Goal setting for this same problem — do not keep mapping.`;

    case PROTOCOL_STATES.GOAL_SETTING:
      return `# Protocol state: GOAL_SETTING (STATE 4) — Simon Goal lock (26 Nov)
Handshake is done — Phase Two starts NOW. Affirm the map briefly.
Ask what goal would help them get past the problem; then "If we get to this goal, what would it mean for you?"; then dedication 0–100. Lock the short-term objective in their words (process they control — not others' reactions).
When they state or accept a goal, **lock it** in writing — do NOT keep asking them to restate it; do NOT stay in Phase One questioning.
Ladder: at most 5 steps, **2–4 micro-actions each**; when scrolling/avoidance is in the loop, include plain setup (phone in another room, timer) — never say "stimulus control" to the client.
Write Step wording in chat when they propose/accept a step. Do NOT emit [[PROGRESS]] until they explicitly agree. End with one comfort/commit question.
This Goal is the North Star for the rest of the journey — later turns return to it.`;

    case PROTOCOL_STATES.MICRO_STEPPING_AND_CONFIDENCE_CHECK: {
      const micro = ctx.activeMicroGoal || ctx.active_micro_goal || "the active step";
      const conf = ctx.microGoalConfidence ?? ctx.micro_goal_confidence;
      const confNote =
        typeof conf === "number" && conf < 7
          ? `Last confidence was ${conf}/10 — ask why it is below 7, what makes it that, and what to change (goal/step/micro); then shrink in writing and re-ask 1–10.`
          : `Ask 1–10 confidence on the locked step: ${micro}. Lock practice only at ≥7.`;
      return `# Protocol state: MICRO_STEPPING_AND_CONFIDENCE_CHECK (STATE 5 — hard gate)
When they propose a step, **write it as Step N** with **2–4** micro-actions, then one comfort question — do not only interrogate.
Coach only the active sub-step. ${confNote}
Do not dump HCPR/DTR here — if they cannot activate, move to Sustainability Path (Phase Three).
Do not advance to Phase Three practice until confidence ≥ 7.`;
    }

    case PROTOCOL_STATES.PHASE_2_GATE_LOCKED: {
      if (ctx.sustainabilityPivotActive || ctx.sustainability_pivot_active) {
        return `# Protocol state: PHASE_2_GATE_LOCKED + Sustainability Pivot
Halt new tasks. One Core skill (Distancing/HCPR/DTR as fits) — this is where thought-challenge tools belong when a Phase Two step cannot be activated.
Then update assumptions if needed before a smaller retry on the **same Goal**.
Do not invent a new Goal.`;
      }
      return `# Protocol state: PHASE_2_GATE_LOCKED (STATE 6)
Ladder is locked (confidence ≥7). On "deal"/confirm/lock-it: **restate the locked Steps in writing**, set when they run it / check in, celebrate briefly, ONE short wrap question — do not ask them to invent the first step again, and do not reopen Phase One.
On success: validate specifically, then next sequential micro-step toward the **same Goal**.
On failure/stress/cannot activate: mini conceptualisation → HCPR or DTR (or Distancing if flooded) on Sustainability Path → retry same/smaller step toward the **same Goal** — do not invent a new Goal from the last message.
Never only answer the latest tangent while abandoning the locked Goal.`;
    }

    default:
      return "";
  }
}

/** Map-order line for prompts (condensed + full) — Simon Two Pillars. */
const MAP_ORDER_LINE =
  "Pillar A: situation/trigger → hot thought (downward-arrow) → rule → belief 0–100% | Pillar B: emotion → avoidance → body → distress 0–100% → maintenance loop → Reflective Handshake";

module.exports = {
  PHASE_ONE_ELEMENTS,
  PROTOCOL_STATES,
  STATE_ORDER,
  MAP_ORDER_LINE,
  resolveProtocolState,
  protocolStateTurnInstruction,
};
