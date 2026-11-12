import type { JourneyState } from "@/types/journey";
import { detectPhaseOneFocusFromAssistant } from "@/lib/phaseOneRouting";
import { withBeliefStrengthBeforeLocked } from "@/lib/beliefRatings";

const HANDSHAKE_CONFIRM =
  /\b(yes|yeah|yep|yup|that's right|that is right|accurate|correct|sounds right|you've got it|spot on|that's me|that describes|operating right now|that's it|fits|makes sense|it does|move on|capture[sd]?)\b/i;

const HANDSHAKE_REJECT =
  /\b(not quite|not really|no|nope|missing|wrong|incorrect|doesn't fit|does not fit|not accurate)\b/i;

const FAILURE_STRESS =
  /\b(failed|didn't|did not|couldn't|could not|too anxious|too stressed|panicked|avoided|skipped|froze|overwhelmed|couldn't do it)\b/i;

const SUCCESS_EXEC =
  /\b(did it|completed|managed to|went well|success|i did|got it done|followed through|made progress)\b/i;

const STEADIER =
  /\b(clearer|calmer|steadier|better now|less anxious|can think|more grounded|ok now|okay now)\b/i;

const ASSUMPTION_SHIFT =
  /\b(new fear|new rule|different assumption|assumption changed|didn't expect|surprised me|realised|realized)\b/i;

const CONFIDENCE_ONLY = /^(\d{1,2})(?:\s*\/\s*10|\s+out\s+of\s+10)?\.?$/i;
const BELIEF_PCT = /^(\d{1,3})\s*%?$/;

function looksLikeSummary(text: string) {
  const t = text.toLowerCase();
  if (text.length < 80) return false;
  return (
    t.includes("in summary") ||
    t.includes("what i'm hearing") ||
    t.includes("sounds like") ||
    t.includes("you're saying") ||
    t.includes("you are saying") ||
    t.includes("operating right now") ||
    t.includes("does that capture") ||
    t.includes("does that sound") ||
    t.includes("does that fit") ||
    t.includes("does this capture") ||
    (t.includes("when you") && t.includes("you tend to"))
  );
}

function looksLikeBeliefQuestion(text: string) {
  return /0\s*to\s*100|0-100|how strongly|believe.*%|strength of belief/i.test(text);
}

function looksLikeBacktrackQuestion(text: string) {
  return /assumption|rule|fear.*change|did.*change|new.*(rule|fear|belief)/i.test(text);
}

function extractMicroGoal(assistantText: string): string | null {
  const patterns = [
    /your (?:next )?(?:small )?step(?: is)?:?\s*([^.?\n]{8,120})/i,
    /try (?:to )?([^.?\n]{8,100}) tomorrow/i,
    /micro[- ]?goal:?\s*([^.?\n]{8,120})/i,
  ];
  for (const p of patterns) {
    const m = assistantText.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function extractTargetOutcome(assistantText: string): string | null {
  const m = assistantText.match(
    /(?:successful resolution|target outcome|success looks like):?\s*([^.?\n]{8,160})/i,
  );
  return m?.[1]?.trim() ?? null;
}

function extractPresentingChallenge(userText: string): string | null {
  if (userText.length < 25) return null;
  return userText.slice(0, 400);
}

function appendBreakdownNote(current: string | null, label: string, value: string): string {
  const line = `${label}: ${value.trim().slice(0, 200)}`;
  if (!current?.trim()) return line;
  if (current.toLowerCase().includes(`${label.toLowerCase()}:`)) return current;
  return `${current.trim()}\n${line}`.slice(0, 600);
}

function breakdownLineCount(summary: string | null): number {
  if (!summary?.trim()) return 0;
  return summary.split("\n").filter((line) => line.trim().includes(":")).length;
}

export function inferJourneyUpdates(
  userMessage: string,
  previousAssistantMessage: string,
  currentAssistantMessage: string,
  current: JourneyState,
): Partial<JourneyState> {
  const updates: Partial<JourneyState> = {};
  const user = userMessage.trim();
  const previousAssistant = previousAssistantMessage.trim();
  const currentAssistant = currentAssistantMessage.trim();

  // --- Phase One ---
  if (!current.phase_one_confirmed) {
    const challenge = extractPresentingChallenge(user);
    if (challenge && current.phase_one_step === 1) {
      updates.presenting_challenge = challenge;
      updates.phase_one_step = 2;
    }

    if (current.phase_one_step === 2 || updates.phase_one_step === 2) {
      const focus = detectPhaseOneFocusFromAssistant(previousAssistant);
      if (focus && user.length > 8) {
        const label =
          focus === "trigger"
            ? "Trigger"
            : focus === "rule"
              ? "Rule"
              : focus === "belief"
                ? "Belief"
                : focus === "coping"
                  ? "Coping"
                  : null;
        if (label) {
          updates.conceptualisation_summary = appendBreakdownNote(
            current.conceptualisation_summary,
            label,
            user,
          );
        }
      }
    }

    if (looksLikeBeliefQuestion(previousAssistant)) {
      const pctMatch = user.match(BELIEF_PCT);
      if (pctMatch) {
        const n = parseInt(pctMatch[1], 10);
        if (n >= 0 && n <= 100) {
          updates.belief_strength_pct = n;
          // Lock "before" on first rating so later re-rates show before → now comparison.
          let summaryBase = updates.conceptualisation_summary ?? current.conceptualisation_summary;
          if (current.belief_strength_pct == null) {
            summaryBase = withBeliefStrengthBeforeLocked(summaryBase, n);
          }
          updates.conceptualisation_summary = appendBreakdownNote(summaryBase, "Belief strength", `${n}%`);
        }
      }
    }

    const summarySoFar = updates.conceptualisation_summary ?? current.conceptualisation_summary;
    const breakdownLines = breakdownLineCount(summarySoFar);
    const hasBeliefPct = typeof (updates.belief_strength_pct ?? current.belief_strength_pct) === "number";

    if (
      (current.phase_one_step === 2 || updates.phase_one_step === 2) &&
      (breakdownLines >= 3 || hasBeliefPct)
    ) {
      updates.phase_one_step = 3;
    }

    if (looksLikeSummary(currentAssistant)) {
      updates.phase_one_step = 3;
      updates.conceptualisation_summary = currentAssistant.slice(0, 600);
    }

    if (HANDSHAKE_CONFIRM.test(user) && looksLikeSummary(previousAssistant)) {
      updates.phase_one_confirmed = true;
      updates.platform_phase = 2;
      updates.phase_one_step = 3;
      updates.conceptualisation_summary = previousAssistant.slice(0, 600);
      updates.sustainability_pivot_active = false;
      updates.architectural_backtrack_active = false;
    }

    if (HANDSHAKE_REJECT.test(user) && looksLikeSummary(previousAssistant)) {
      updates.phase_one_step = 2;
      updates.phase_one_confirmed = false;
      updates.platform_phase = 1;
    }
  }

  // --- Phase Two ---
  const confMatch = user.match(CONFIDENCE_ONLY);
  if (confMatch && current.phase_one_confirmed) {
    const n = parseInt(confMatch[1], 10);
    if (n >= 1 && n <= 10) {
      updates.micro_goal_confidence = n;
      if (n >= 7 && (current.active_micro_goal || updates.active_micro_goal)) {
        updates.platform_phase = 3;
        updates.sustainability_pivot_active = false;
      } else if (n < 7) {
        updates.platform_phase = 2;
      }
    }
  }

  const microGoal = extractMicroGoal(currentAssistant);
  if (microGoal && current.phase_one_confirmed) {
    updates.active_micro_goal = microGoal;
    if (!updates.platform_phase) updates.platform_phase = 2;
  }

  const target = extractTargetOutcome(currentAssistant);
  if (target && current.phase_one_confirmed) updates.target_outcome = target;

  // --- Phase Three ---
  if (FAILURE_STRESS.test(user)) {
    updates.sustainability_pivot_active = true;
    updates.platform_phase = 3;
    updates.architectural_backtrack_active = false;
    updates.micro_goal_confidence = null;
  }

  if (SUCCESS_EXEC.test(user) && !FAILURE_STRESS.test(user)) {
    updates.sustainability_pivot_active = false;
    updates.architectural_backtrack_active = false;
    updates.last_check_in_at = new Date().toISOString();
  }

  if (current.sustainability_pivot_active && STEADIER.test(user)) {
    updates.architectural_backtrack_active = true;
  }

  if (
    (current.architectural_backtrack_active || updates.architectural_backtrack_active) &&
    (looksLikeBacktrackQuestion(currentAssistant) || ASSUMPTION_SHIFT.test(user))
  ) {
    if (looksLikeSummary(currentAssistant)) {
      updates.conceptualisation_summary = currentAssistant.slice(0, 600);
    }
    if (HANDSHAKE_CONFIRM.test(user) || ASSUMPTION_SHIFT.test(user)) {
      updates.architectural_backtrack_active = false;
      updates.sustainability_pivot_active = false;
      updates.platform_phase = 2;
    }
  }

  if (
    current.phase_one_confirmed &&
    !updates.platform_phase &&
    current.active_micro_goal &&
    current.platform_phase === 2 &&
    (current.micro_goal_confidence ?? 0) >= 7
  ) {
    updates.platform_phase = 3;
  }

  return updates;
}
