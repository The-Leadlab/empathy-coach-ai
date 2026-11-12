import { describe, expect, it } from "vitest";
import { inferJourneyUpdates } from "./journeyInference";
import { DEFAULT_JOURNEY_STATE } from "@/types/journey";

describe("inferJourneyUpdates", () => {
  it("advances Phase One when user describes a challenge", () => {
    const long =
      "My manager keeps piling on work at 5pm and I stay late every night because I fear looking incompetent if I push back.";
    const updates = inferJourneyUpdates(long, "", "Thanks for sharing.", DEFAULT_JOURNEY_STATE);
    expect(updates.presenting_challenge).toBeTruthy();
    expect(updates.phase_one_step).toBe(2);
  });

  it("confirms handshake and moves to Phase Two", () => {
    const summary =
      "In summary, when your manager emails late, you believe they'll think you're incompetent if you don't reply, which leads to anxiety and staying at your desk. Does that fit how you're operating right now?";
    const updates = inferJourneyUpdates(
      "Yes, that's exactly right",
      summary,
      "Great.",
      { ...DEFAULT_JOURNEY_STATE, phase_one_step: 3 },
    );
    expect(updates.phase_one_confirmed).toBe(true);
    expect(updates.platform_phase).toBe(2);
  });

  it("confirms short capture-style summaries used in production", () => {
    const summary =
      "You're saying that when work feels repetitive and unfulfilling, you feel a bit paralyzed and then scroll on your phone for about 40 minutes to find a distraction. Does that capture what you're experiencing?";
    const updates = inferJourneyUpdates("yes", summary, "Great.", {
      ...DEFAULT_JOURNEY_STATE,
      phase_one_step: 3,
    });
    expect(updates.phase_one_confirmed).toBe(true);
    expect(updates.platform_phase).toBe(2);
  });

  it("locks micro-goal confidence and enters Phase Three", () => {
    const updates = inferJourneyUpdates(
      "8",
      "On a scale of 1-10, how confident are you?",
      "Good.",
      {
        ...DEFAULT_JOURNEY_STATE,
        phase_one_confirmed: true,
        platform_phase: 2,
        active_micro_goal: "Send one boundary email by 10am",
      },
    );
    expect(updates.micro_goal_confidence).toBe(8);
    expect(updates.platform_phase).toBe(3);
  });

  it("triggers sustainability pivot on failure language", () => {
    const updates = inferJourneyUpdates(
      "I couldn't do it, I was too anxious",
      "",
      "I hear you.",
      {
        ...DEFAULT_JOURNEY_STATE,
        phase_one_confirmed: true,
        platform_phase: 3,
        active_micro_goal: "Send email",
        micro_goal_confidence: 8,
      },
    );
    expect(updates.sustainability_pivot_active).toBe(true);
  });
});
