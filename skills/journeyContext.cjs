/**
 * Formats persisted journey state for LLM system context (Phase 1, 2 & 3).
 */

const { formatPhaseOneNextElementInstruction } = require("./conversationMemory.cjs");
const { resolveProtocolState, MAP_ORDER_LINE } = require("./coachProtocolStates.cjs");

/** @typedef {1 | 2 | 3} PlatformPhase */

const PHASE_ONE_STEP_LABELS = {
  1: "1.1 scenario extraction",
  2: "1.2 component breakdown",
  3: "1.3 reflective handshake pending",
};

/**
 * @param {object} ctx
 * @param {PlatformPhase} [ctx.platformPhase]
 * @param {number} [ctx.phaseOneStep]
 * @param {boolean} [ctx.phaseOneConfirmed]
 * @param {string|null} [ctx.presentingChallenge]
 * @param {number|null} [ctx.beliefStrengthPct]
 * @param {string|null} [ctx.conceptualisationSummary]
 * @param {string|null} [ctx.targetOutcome]
 * @param {string|null} [ctx.activeMicroGoal]
 * @param {number|null} [ctx.microGoalConfidence]
 * @param {boolean} [ctx.sustainabilityPivotActive]
 * @param {boolean} [ctx.architecturalBacktrackActive]
 * @param {boolean} [ctx.isResuming]
 * @param {string|null} [ctx.phaseOneNextElement] - next 1.2 element to ask (trigger|rule|...)
 * @param {string|null} [ctx.askedPhaseOneElements] - comma-separated elements already asked
 */
function formatJourneyContextForPrompt(ctx) {
  if (!ctx || typeof ctx !== "object") return "";

  const phase = ctx.platformPhase ?? 1;
  const step = ctx.phaseOneStep ?? 1;
  const protocolState = ctx.protocolState || resolveProtocolState(ctx);
  const lines = [
    "# Journey state for this conversation thread (internal — do not recite labels to user)",
    `Protocol state (Miro machine, internal): ${protocolState}`,
    `Current platform phase (internal): ${phase}`,
    `Phase One step (internal): ${PHASE_ONE_STEP_LABELS[step] || step}`,
    `Phase One Reflective Handshake confirmed: ${ctx.phaseOneConfirmed ? "yes" : "no"}`,
    `Map order (STATE 2): ${MAP_ORDER_LINE}`,
    `Sustainability Pivot active: ${ctx.sustainabilityPivotActive ? "yes — Core distancing skills only, halt BA" : "no"}`,
    `Architectural Backtrack active: ${ctx.architecturalBacktrackActive ? "yes — update Phase One assumptions before re-activation" : "no"}`,
    `Resuming existing thread: ${ctx.isResuming ? "yes" : "no"}`,
  ];
  if (protocolState === "PHASE_2_GATE_LOCKED") {
    lines.push("PHASE_2_GATE_LOCKED: confidence ≥7 — do not reopen Goal/ladder; check in on active sub-step only.");
  }
  if (protocolState === "MICRO_STEPPING_AND_CONFIDENCE_CHECK") {
    lines.push("Hard gate: do not enter Phase Three practice until confidence ≥7 on the active sub-step.");
  }

  if (ctx.presentingChallenge) {
    lines.push(`Presenting challenge on file: ${ctx.presentingChallenge}`);
  }
  if (typeof ctx.beliefStrengthPct === "number") {
    lines.push(`Belief strength recorded (0–100%): ${ctx.beliefStrengthPct}`);
  }
  if (ctx.conceptualisationSummary) {
    lines.push(`Conceptualisation on file: ${ctx.conceptualisationSummary}`);
  }
  if (ctx.targetOutcome) {
    lines.push(`Target outcome (Phase Two): ${ctx.targetOutcome}`);
  }
  if (ctx.activeMicroGoal) {
    lines.push(`Active micro-goal (Phase Two/Three): ${ctx.activeMicroGoal}`);
  }
  if (typeof ctx.microGoalConfidence === "number") {
    lines.push(`Last confidence rating for micro-goal (1–10): ${ctx.microGoalConfidence}`);
    if (ctx.microGoalConfidence < 7) {
      lines.push("Action required: confidence below 7 — downscale the step before advancing.");
    }
  }

  if (ctx.progressSummary) {
    lines.push(`Progress dashboard summary on file: ${ctx.progressSummary}`);
  }
  const goals = Array.isArray(ctx.userGoals) ? ctx.userGoals : [];
  if (goals.length > 0) {
    const goalLine = goals.find((g) => g?.tier === "goal" || g?.step === "goal");
    if (goalLine?.title) {
      lines.push(`Agreed Goal on file: ${goalLine.title}`);
    }
    const goalLines = goals.map((g) => {
      const title = g?.title ?? "Untitled";
      const done = g?.completed ? "done" : "open";
      const label = g?.step ? `${g.step} ` : "";
      const tier = g?.tier ? ` (${g.tier})` : "";
      return `  [${done}] ${label}${title}${tier}`;
    });
    lines.push("Goal ladder on Tasks page (coach + user — work one active sub-step at a time):");
    lines.push(...goalLines);
    const firstOpenSub = goals.find(
      (g) => !g?.completed && (g?.tier === "sub" || (g?.step && String(g.step).includes("."))),
    );
    const firstOpenMajor = goals.find(
      (g) => !g?.completed && g?.tier === "major",
    );
    const active = firstOpenSub ?? firstOpenMajor;
    if (active) {
      lines.push(`Active ladder focus (internal): step ${active.step ?? "?"} — ${active.title}`);
    }
  }

  const milestones = Array.isArray(ctx.phaseChecklist) ? ctx.phaseChecklist : [];
  if (milestones.length > 0) {
    const msLines = milestones.map((m, i) => {
      const title = m?.title ?? "Milestone";
      const done = m?.completed ? "done" : "open";
      return `  ${i + 1}. [${done}] ${title}`;
    });
    lines.push("Session milestones on file (auto-tracked — personalise titles when you emit [[PROGRESS]]):");
    lines.push(...msLines);
  }

  lines.push("");
  lines.push("## Phase routing from this state (strict priority)");

  if (ctx.sustainabilityPivotActive) {
    lines.push("1) Ladder step failed — mini conceptualisation on what blocked them (one question per turn).");
    lines.push("2) HCPR thought check (default) or Distancing if flooded.");
    lines.push("3) Retry same/smaller sub-step + 1–10 confidence — do not advance major step until done.");
    if (ctx.architecturalBacktrackActive) {
      lines.push("4) Architectural Backtrack — update assumptions from the attempt.");
    }
  } else if (!ctx.phaseOneConfirmed) {
    if (ctx.isResuming && ctx.activeMicroGoal) {
      lines.push("- Thread has history AND an open micro-goal: Phase Three check-in first, then route as needed.");
    } else if (step === 1) {
      lines.push("- Phase One Step 1.1: scenario extraction — one concrete situation.");
    } else if (step === 2) {
      lines.push(`- Phase One Step 1.2: map ${MAP_ORDER_LINE}.`);
      if (ctx.presentingChallenge) {
        lines.push(
          "- Presenting challenge already captured — do NOT re-ask for the main situation. Ask ONE missing 1.2 element in Hot Cross Bun order (trigger, coping, rule, belief, or strength %).",
        );
      }
      if (ctx.askedPhaseOneElements) {
        lines.push(`- Phase 1.2 elements already asked (do NOT rephrase these): ${ctx.askedPhaseOneElements}`);
      }
      if (ctx.phaseOneNextElement) {
        lines.push(`- **This turn — ask next:** ${formatPhaseOneNextElementInstruction(ctx.phaseOneNextElement)}`);
      }
    } else {
      lines.push("- Phase One Step 1.3: present summary; await explicit confirmation before Phase Two.");
    }
  } else if (!ctx.targetOutcome && goals.length === 0) {
    lines.push("- Phase Two: co-create Goal + ladder (Steps 1–5, subs 1.1…) and get explicit agreement before Tasks list.");
  } else if (phase === 2 || !ctx.activeMicroGoal || (ctx.microGoalConfidence ?? 0) < 7) {
    lines.push("- Phase Two: agree Goal + ladder if not on Tasks yet; else coach **active sub-step** only + 1–10 confidence (≥7).");
  } else if (ctx.isResuming) {
    lines.push("- Phase Three: check-in on **active sub-step** from ladder first.");
  } else {
    lines.push("- Phase Three: coach execution; pivot on failure/stress.");
  }

  return lines.join("\n");
}

module.exports = { formatJourneyContextForPrompt, PHASE_ONE_STEP_LABELS };
