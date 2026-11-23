/**
 * Single source of truth for the Miro 6-state coach machine + Hot Cross Bun map order.
 * Used by coachReply, llmEnginePhases, journeyContext, and (mirrored) client routers.
 */

/** Hot Cross Bun first, then light rule/belief — Simon CBT + Miro gates. */
const PHASE_ONE_ELEMENTS = ["situation", "trigger", "coping", "rule", "belief", "strength"];

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
Only use facts from this journey. One short reflection + exactly one question.`;

    case PROTOCOL_STATES.MAP_CORE_COMPONENTS:
      return `# Protocol state: MAP_CORE_COMPONENTS (STATE 2)
Map Hot Cross Bun order — one missing element per turn only, locked to the single presenting problem:
situation → trigger/thought → deepen the thought (what it means / evidence) → emotion/body/behaviour (coping) → light if…then rule → belief → 0–100 strength.
After the first thought, go one step deeper before leaving thoughts (downward-arrow or evidence) — do not skim and skip.
New thoughts about the *same* situation deepen meaning/evidence; do not restart Hot Cross Bun feelings/body once coping is known (brief \"still feel the same?\" OK).
Do not jump to core beliefs before coping is on the table. Do not re-ask known elements.
HARD BAN this state: goals, shared goals, "goal when giving feedback", ladders, techniques, Tasks.`;

    case PROTOCOL_STATES.FORMULATION_SUMMARY_CONFIRMATION:
      return `# Protocol state: FORMULATION_SUMMARY_CONFIRMATION (STATE 3 — hard gate)
Present a short plain-language summary using ONLY what this user said in this journey (situation, thought, feelings/body, behaviour, any rule/belief/strength). Never invent a training scenario or workplace story they did not share.
Ask if it fits (verification). Do NOT ask about goals, shared goals, ladders, or feedback goals until they explicitly confirm. If they correct one part, update that part only.`;

    case PROTOCOL_STATES.GOAL_SETTING:
      return `# Protocol state: GOAL_SETTING (STATE 4) — July Simon lock style
Handshake is done. Affirm first, then co-create a **short-term objective** they control (process, not others' reactions).
When they state a goal in their words, **lock it**: restate it clearly as the journey objective, notice the contrast vs the old loop, then move to ladder steps — do NOT keep asking them to restate the goal.
Ladder: at most 5 steps, ≤2 micro-actions each; include stimulus control (phone away, timer) when scrolling/avoidance is part of the loop.
Write Step wording in chat when they propose/accept a step. Do NOT emit [[PROGRESS]] until they explicitly agree. End with one comfort/commit question.`;

    case PROTOCOL_STATES.MICRO_STEPPING_AND_CONFIDENCE_CHECK: {
      const micro = ctx.activeMicroGoal || ctx.active_micro_goal || "the active step";
      const conf = ctx.microGoalConfidence ?? ctx.micro_goal_confidence;
      const confNote =
        typeof conf === "number" && conf < 7
          ? `Last confidence was ${conf}/10 — shrink the step in writing, then re-ask 1–10.`
          : `Ask 1–10 confidence on the locked step: ${micro}. Lock practice only at ≥7.`;
      return `# Protocol state: MICRO_STEPPING_AND_CONFIDENCE_CHECK (STATE 5 — hard gate)
When they propose a step, **write it as Step N** with 1–2 micro-actions (July style), then one comfort question — do not only interrogate.
Coach only the active sub-step. ${confNote}
Do not advance to Phase Three practice until confidence ≥ 7.`;
    }

    case PROTOCOL_STATES.PHASE_2_GATE_LOCKED: {
      if (ctx.sustainabilityPivotActive || ctx.sustainability_pivot_active) {
        return `# Protocol state: PHASE_2_GATE_LOCKED + Sustainability Pivot
Halt new tasks. One Core skill (Distancing/HCPR as fits). Then update assumptions if needed before a smaller retry.
Do not invent a new Goal.`;
      }
      return `# Protocol state: PHASE_2_GATE_LOCKED (STATE 6)
Ladder is locked (confidence ≥7). On "deal"/confirm: set the expectation firmly (when they run it, when they check in), celebrate briefly, one short wrap question — do not reopen Phase One.
On success: validate specifically, then next sequential micro-step.
On failure/stress: mini conceptualisation → HCPR (or Distancing if flooded) → retry same/smaller step — do not skip ahead.`;
    }

    default:
      return "";
  }
}

/** Map-order line for prompts (condensed + full). */
const MAP_ORDER_LINE =
  "situation → trigger/thought → coping (emotion/body/behaviour) → rule → belief → 0–100% strength → Reflective Handshake";

module.exports = {
  PHASE_ONE_ELEMENTS,
  PROTOCOL_STATES,
  STATE_ORDER,
  MAP_ORDER_LINE,
  resolveProtocolState,
  protocolStateTurnInstruction,
};
