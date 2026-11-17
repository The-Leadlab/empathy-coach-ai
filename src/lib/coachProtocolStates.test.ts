import { describe, expect, it } from "vitest";
import {
  PHASE_ONE_ELEMENTS,
  PROTOCOL_STATES,
  resolveProtocolState,
} from "@/lib/coachProtocolStates";

describe("coachProtocolStates", () => {
  it("uses Hot Cross Bun map order", () => {
    expect(PHASE_ONE_ELEMENTS).toEqual([
      "situation",
      "trigger",
      "coping",
      "rule",
      "belief",
      "strength",
    ]);
  });

  it("starts at SCENARIO_EXTRACTION", () => {
    expect(resolveProtocolState(null)).toBe(PROTOCOL_STATES.SCENARIO_EXTRACTION);
    expect(resolveProtocolState({ platformPhase: 1, phaseOneStep: 1 })).toBe(
      PROTOCOL_STATES.SCENARIO_EXTRACTION,
    );
  });

  it("maps presenting challenge to MAP_CORE_COMPONENTS", () => {
    expect(
      resolveProtocolState({
        platformPhase: 1,
        phaseOneStep: 2,
        presentingChallenge: "Late emails from manager",
      }),
    ).toBe(PROTOCOL_STATES.MAP_CORE_COMPONENTS);
  });

  it("maps summary asking to FORMULATION_SUMMARY_CONFIRMATION", () => {
    expect(
      resolveProtocolState({
        platformPhase: 1,
        phaseOneStep: 3,
        phaseOneState: { asking: "summary" },
      }),
    ).toBe(PROTOCOL_STATES.FORMULATION_SUMMARY_CONFIRMATION);
  });

  it("maps confirmed handshake to GOAL_SETTING", () => {
    expect(
      resolveProtocolState({
        phaseOneConfirmed: true,
        platformPhase: 2,
      }),
    ).toBe(PROTOCOL_STATES.GOAL_SETTING);
  });

  it("maps active micro without lock to MICRO_STEPPING_AND_CONFIDENCE_CHECK", () => {
    expect(
      resolveProtocolState({
        phaseOneConfirmed: true,
        platformPhase: 2,
        activeMicroGoal: "Send one email",
        microGoalConfidence: 5,
      }),
    ).toBe(PROTOCOL_STATES.MICRO_STEPPING_AND_CONFIDENCE_CHECK);
  });

  it("locks at PHASE_2_GATE_LOCKED when confidence ≥7", () => {
    expect(
      resolveProtocolState({
        phaseOneConfirmed: true,
        platformPhase: 3,
        activeMicroGoal: "Send one email",
        microGoalConfidence: 8,
      }),
    ).toBe(PROTOCOL_STATES.PHASE_2_GATE_LOCKED);
  });
});
