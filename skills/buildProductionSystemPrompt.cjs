/**
 * Builds the full live system prompt (coach + phases + skills + journey + trainer + stars).
 * Used by /api/chat and training export — keep assembly order in sync.
 */

const { COACH_SYSTEM_PROMPT_TEXT, COACH_INFERENCE_SYSTEM_PROMPT_TEXT } = require("./coachSystemPrompt.cjs");
const { formatSkillsForPrompt } = require("./skillsLibrary.cjs");
const { formatLlmEnginePhasesForPrompt } = require("./llmEnginePhases.cjs");
const { formatJourneyContextForPrompt } = require("./journeyContext.cjs");
const { formatProgressDashboardForPrompt } = require("./progressDashboard.cjs");
const {
  formatWorkbooksForPrompt,
  formatUserWorkbookStateForPrompt,
} = require("./workbooksLibrary.cjs");
const { formatKnowledgeForPrompt } = require("./knowledgeBase.cjs");
const {
  retrievePhase3Context,
  formatPhase3ForPrompt,
  isPhase3RagEnabled,
} = require("./phase3Rag.cjs");

function sessionRowToJourneyContext(sessionRow, messageCount = 0) {
  if (!sessionRow) return null;
  return {
    platformPhase: sessionRow.platform_phase ?? 1,
    phaseOneStep: sessionRow.phase_one_step ?? 1,
    phaseOneConfirmed: !!sessionRow.phase_one_confirmed,
    presentingChallenge: sessionRow.presenting_challenge ?? null,
    beliefStrengthPct: sessionRow.belief_strength_pct ?? null,
    conceptualisationSummary: sessionRow.conceptualisation_summary ?? null,
    targetOutcome: sessionRow.target_outcome ?? null,
    activeMicroGoal: sessionRow.active_micro_goal ?? null,
    microGoalConfidence: sessionRow.micro_goal_confidence ?? null,
    sustainabilityPivotActive: !!sessionRow.sustainability_pivot_active,
    architecturalBacktrackActive: !!sessionRow.architectural_backtrack_active,
    isResuming: messageCount > 2,
    messageCount,
    progressSummary: sessionRow.progress_summary ?? null,
    userGoals: Array.isArray(sessionRow.user_goals) ? sessionRow.user_goals : [],
    phaseChecklist: Array.isArray(sessionRow.phase_checklist) ? sessionRow.phase_checklist : [],
  };
}

const INFERENCE_DIRECTIVES = `# Live inference directives (this turn — highest priority after safety)
1. **Conversation memory is mandatory.** The "Conversation memory" block and chat history are authoritative. Recall specific details the user already shared (names, situations, feelings, rules). Never ask them to repeat the main scenario.
2. Read the full chat history: **never repeat** your previous question, opener, or stock empathy phrase — even if reworded.
3. Do **not** loop in Phase One. Each turn must advance exactly one step in the Phase routing block below.
4. When Phase One step is 1.2, ask only the **next** breakdown element listed. Do not re-ask elements marked as already asked.
5. Mirror the user's own words in your first sentence, then ask **one** new question that moves forward.
6. If the user already answered the element you asked last turn, acknowledge it briefly and ask the **next** element — do not ask the same thing again.
7. **Never repeat** action plans, "Task:" lines, or summary bullet lists from your previous reply — especially after the user said yes.
8. **[[PROGRESS]] is invisible to the user.** Put it alone on the very last line, always closed: \`[[PROGRESS]]{...}[[/PROGRESS]]\`. Never omit \`[[/PROGRESS]]\`. No text after the closing tag.`;

/**
 * @param {object} [opts]
 * @param {string} [opts.trainerRules] - global trainer bullets (from chat_feedback)
 * @param {string} [opts.sessionTrainerNotes] - session-specific Simon notes
 * @param {string} [opts.exemplars] - admin-starred reply patterns
 * @param {object|null} [opts.journeyContext] - journey payload for formatJourneyContextForPrompt
 * @param {string} [opts.turnFeedback] - single-turn Simon feedback (training export)
 * @param {boolean} [opts.forInference] - slimmer stack for 4k-context RunPod inference
 * @param {string} [opts.latestUserMessage] - current user turn for KB skill router retrieval
 * @param {string} [opts.turnInstruction] - code-chosen instruction for this turn (Phase One intake)
 */
function buildProductionSystemPrompt(opts = {}) {
  const condensed = !!opts.forInference;
  let content = condensed ? COACH_INFERENCE_SYSTEM_PROMPT_TEXT : COACH_SYSTEM_PROMPT_TEXT;
  content += `\n\n${formatLlmEnginePhasesForPrompt({ condensed })}\n`;

  const journeyBlock = formatJourneyContextForPrompt(opts.journeyContext);
  if (journeyBlock) content += `\n\n${journeyBlock}\n`;

  content += `\n\n${formatSkillsForPrompt({ condensed })}\n`;
  content += `\n\n${formatProgressDashboardForPrompt({ condensed })}\n`;
  content += `\n\n${formatWorkbooksForPrompt({ condensed })}\n`;

  const practiceBlock = formatUserWorkbookStateForPrompt(opts.journeyContext?.practiceState);
  if (practiceBlock) content += `\n\n${practiceBlock}\n`;

  const kbBlock = formatKnowledgeForPrompt(opts.latestUserMessage || "", {
    condensed,
    limit: condensed ? 1 : 2,
  });
  if (kbBlock) content += `\n\n${kbBlock}\n`;

  // Phase 3 RAG sits after crisis-aware KB route; off unless PHASE3_RAG_ENABLED=true.
  if (isPhase3RagEnabled() && opts.latestUserMessage) {
    const hits = retrievePhase3Context(opts.latestUserMessage, {
      limit: condensed ? 2 : 3,
      excludeRedFlagSources: true,
    });
    const ragBlock = formatPhase3ForPrompt(hits, condensed ? 1800 : 2800);
    if (ragBlock) content += `\n\n${ragBlock}\n`;
  }

  if (condensed) {
    content += `\n\n${INFERENCE_DIRECTIVES}\n`;
    content += `\n8b. **[[WORKBOOK]] is invisible.** When recommending a Development Skills workbook, close with \`[[WORKBOOK]]{"id":"<catalogue_id>","reason":"…"}[[/WORKBOOK]]\` using only catalogue ids. At most one per reply. After [[PROGRESS]] if both appear.\n`;
  }

  // Before conversation memory: context trimming drops everything from that header onwards.
  if (opts.turnInstruction?.trim()) {
    content += `\n\n${opts.turnInstruction.trim()}\n`;
  }

  if (opts.conversationMemory?.trim()) {
    content += `\n\n# Conversation memory (authoritative — recall these details; do not re-ask)\n${opts.conversationMemory.trim()}\n`;
  }

  const trainerParts = [];
  if (opts.trainerRules?.trim()) trainerParts.push(opts.trainerRules.trim());
  if (opts.sessionTrainerNotes?.trim()) trainerParts.push(opts.sessionTrainerNotes.trim());
  if (trainerParts.length) {
    content += `\n\n# Trainer global standards (admin feedback — applies to ALL users)\nFollow every bullet below for this reply and all learners. These override generic habits when safe:\n${trainerParts.join("\n")}\n`;
  }

  if (opts.exemplars?.trim()) {
    content += `\n\n# Admin-starred exemplar replies (pattern to emulate)\n${opts.exemplars.trim()}\n`;
  }

  if (opts.turnFeedback?.trim()) {
    content += `\n\n# Simon feedback for this training turn\n- ${opts.turnFeedback.trim()}\n`;
  }

  return content;
}

module.exports = {
  buildProductionSystemPrompt,
  sessionRowToJourneyContext,
  COACH_SYSTEM_PROMPT_TEXT,
};
