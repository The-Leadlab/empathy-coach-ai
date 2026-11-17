/**
 * Client mirror of skills/coachProtocolStates.cjs — keep in sync.
 * Hot Cross Bun map order + Miro 6-state machine.
 */

export const PHASE_ONE_ELEMENTS = [
  "situation",
  "trigger",
  "coping",
  "rule",
  "belief",
  "strength",
] as const;

export type PhaseOneMapElement = (typeof PHASE_ONE_ELEMENTS)[number];

export const PROTOCOL_STATES = {
  SCENARIO_EXTRACTION: "SCENARIO_EXTRACTION",
  MAP_CORE_COMPONENTS: "MAP_CORE_COMPONENTS",
  FORMULATION_SUMMARY_CONFIRMATION: "FORMULATION_SUMMARY_CONFIRMATION",
  GOAL_SETTING: "GOAL_SETTING",
  MICRO_STEPPING_AND_CONFIDENCE_CHECK: "MICRO_STEPPING_AND_CONFIDENCE_CHECK",
  PHASE_2_GATE_LOCKED: "PHASE_2_GATE_LOCKED",
} as const;

export type ProtocolState = (typeof PROTOCOL_STATES)[keyof typeof PROTOCOL_STATES];

export type ProtocolJourneyLike = {
  platformPhase?: number;
  platform_phase?: number;
  phaseOneStep?: number;
  phase_one_step?: number;
  phaseOneConfirmed?: boolean;
  phase_one_confirmed?: boolean;
  presentingChallenge?: string | null;
  presenting_challenge?: string | null;
  targetOutcome?: string | null;
  target_outcome?: string | null;
  activeMicroGoal?: string | null;
  active_micro_goal?: string | null;
  microGoalConfidence?: number | null;
  micro_goal_confidence?: number | null;
  sustainabilityPivotActive?: boolean;
  sustainability_pivot_active?: boolean;
  architecturalBacktrackActive?: boolean;
  architectural_backtrack_active?: boolean;
  phaseOneState?: { asking?: string | null } | null;
};

export function resolveProtocolState(ctx: ProtocolJourneyLike | null | undefined): ProtocolState {
  if (!ctx) return PROTOCOL_STATES.SCENARIO_EXTRACTION;

  const conf = ctx.microGoalConfidence ?? ctx.micro_goal_confidence;
  const micro = ctx.activeMicroGoal ?? ctx.active_micro_goal;
  const target = ctx.targetOutcome ?? ctx.target_outcome;
  const confirmed = !!(ctx.phaseOneConfirmed ?? ctx.phase_one_confirmed);
  const phase = ctx.platformPhase ?? ctx.platform_phase ?? 1;
  const step = ctx.phaseOneStep ?? ctx.phase_one_step ?? 1;
  const asking = ctx.phaseOneState?.asking ?? null;
  const pivot = !!(ctx.sustainabilityPivotActive ?? ctx.sustainability_pivot_active);
  const backtrack = !!(ctx.architecturalBacktrackActive ?? ctx.architectural_backtrack_active);

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
