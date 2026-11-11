/**
 * ShiftED skills library — Core (engine) vs Development/Activation (modules).
 * Injected into live LLM system prompt for all users.
 * Source: training playbook + May 2026 weekly meeting + ShiftedAI Resources (2026-10).
 *
 * CommonJS (.cjs) because package.json has "type": "module".
 */

/** @typedef {"core" | "development_activation"} SkillCategory */
/** @typedef {1 | 2 | 3} PlatformPhase */

const SKILLS = [
  {
    id: "distancing",
    name: "Distancing",
    category: "core",
    platformPhase: 1,
    acronym: null,
    description:
      "Create psychological distance from automatic stress responses so the user can observe thoughts and feelings without fusing with them. Self-distanced language ('what would you notice if advising a colleague?') helps perspective.",
    gapSignals: [
      "overwhelmed",
      "can't think straight",
      "spiralling",
      "everything feels urgent",
      "fused with the thought",
    ],
    whenToUse: "User is flooded or fused with distress; needs space before problem-solving.",
  },
  {
    id: "hcpr_thought_challenge",
    name: "Helpful Constructive Positive Real (HCPR) thought check",
    category: "core",
    platformPhase: 2,
    acronym: "HCPR",
    description:
      "Challenge unhelpful thoughts using Helpful, Constructive, Positive, and Real criteria — ShiftED's primary thought tool (HCPR Tool Kit). One lens per turn; then a balanced alternative in the user's words.",
    gapSignals: [
      "negative automatic thought",
      "they always",
      "i'm useless",
      "catastrophising",
      "mind reading",
      "stuck on one thought",
    ],
    whenToUse: "A specific thought is blocking progress; user can name the thought.",
  },
  {
    id: "dtr",
    name: "Daily Thought Record (thought on trial)",
    category: "core",
    platformPhase: 2,
    acronym: "DTR",
    description:
      "Examine evidence for and against a hot thought (thought diaries / thought-on-trial) when simpler HCPR checks are not enough.",
    gapSignals: [
      "same thought keeps returning",
      "need evidence",
      "not sure if it's true",
      "ruminating",
    ],
    whenToUse: "User needs structured evidence weighing for a recurring thought.",
  },
  {
    id: "cost_benefit",
    name: "Cost-benefit check",
    category: "core",
    platformPhase: 2,
    acronym: null,
    description:
      "Weigh short- and longer-term costs and benefits of an action, belief, or avoidance — including costs of unhelpful coping (e.g. endless scrolling).",
    gapSignals: [
      "won't try",
      "what's the point",
      "avoiding because",
      "stuck choosing",
    ],
    whenToUse: "User is resistant or ambivalent; needs a concrete decision frame.",
  },
  {
    id: "circles_of_control",
    name: "Circles of control",
    category: "core",
    platformPhase: 3,
    acronym: null,
    description:
      "Sort what is within control, influence, or outside control (spheres of personal control). Creates distance from overwhelm and focuses effort — often with sustainability path.",
    gapSignals: [
      "can't control anything",
      "everything depends on others",
      "overwhelmed by uncertainty",
      "stuck worrying",
    ],
    whenToUse: "User is flooded by uncontrollable factors; Sustainability Pivot distancing tool.",
  },
  {
    id: "thinking_error_tracking",
    name: "Thinking error tracking",
    category: "core",
    platformPhase: 2,
    acronym: null,
    description:
      "Notice unhelpful thinking styles (mind reading, catastrophising, all-or-nothing, discounting positives) without lecturing — light structured awareness before HCPR/DTR.",
    gapSignals: [
      "always happens",
      "they never",
      "worst case",
      "everyone thinks",
      "black and white",
    ],
    whenToUse: "Recurring distorted thoughts; pair with HCPR or DTR when needed.",
  },
  {
    id: "abcd_model",
    name: "ABCD model",
    category: "core",
    platformPhase: 2,
    acronym: "ABCD",
    description:
      "Map Activating event → Beliefs → Consequences → Disputation when users need a fuller thought–feeling–behaviour sketch alongside HCPR.",
    gapSignals: ["activating event", "beliefs and consequences", "ABC", "why did I react"],
    whenToUse: "User can describe a trigger episode and needs a structured map before disputation.",
  },
  {
    id: "grounding_and_breathing",
    name: "Grounding and breathing",
    category: "core",
    platformPhase: 1,
    acronym: "SOBER",
    description:
      "In-the-moment regulation: 5-4-3-2-1, diaphragmatic/box breathing, Dropping Anchor, S.O.B.E.R., brief PMR or imagery. Use before problem-solving when flooded. Guided audio titles exist; URLs pending hosting.",
    gapSignals: [
      "panicky",
      "can't breathe",
      "racing heart",
      "overwhelmed right now",
      "can't think",
      "need to ground",
    ],
    whenToUse: "Acute arousal, panic, or dissociation — regulate first.",
  },
  {
    id: "boundary_communication",
    name: "Boundary communication",
    category: "development_activation",
    platformPhase: 2,
    acronym: null,
    description:
      "Plan how to communicate a boundary clearly (time, workload, emotional, digital, etc.) — what to say, when, and what need it protects. Includes learning to say no and assertiveness framing.",
    gapSignals: [
      "can't say no",
      "need to set a boundary",
      "always available",
      "they expect me to",
      "afraid to push back",
    ],
    whenToUse: "Phase Two micro-stepping for emotional intelligence and workplace boundaries.",
  },
  {
    id: "behavioral_activation",
    name: "Behavioural Activation",
    category: "development_activation",
    platformPhase: 2,
    acronym: "BA",
    description:
      "Plan valued activities and small approach steps using pleasure vs mastery and activity scheduling. Treat scrolling/avoidance of monotonous tasks as a common workplace loop.",
    gapSignals: [
      "not doing anything",
      "no motivation",
      "avoiding activities",
      "stuck at home",
      "procrastinating tasks",
      "scrolling instead",
    ],
    whenToUse: "Low activity, avoidance of valued tasks, need structured activation.",
  },
  {
    id: "micro_goals",
    name: "Micro goals",
    category: "development_activation",
    platformPhase: 2,
    acronym: null,
    description:
      "Break goals into very small, observable steps; values-based goals; solution-focused scaling (1–10 confidence). Plain language — not clinical scales with users.",
    gapSignals: [
      "goal too big",
      "don't know where to start",
      "overwhelmed by task",
      "can't begin",
    ],
    whenToUse: "User has a goal but cannot start; needs granular next step.",
  },
  {
    id: "sustainability_path",
    name: "Sustainability path skill",
    category: "development_activation",
    platformPhase: 3,
    acronym: null,
    description:
      "Long-term habit and emotional regulation along the Self-Sustaining Path: problem list, coping plan, burnout beliefs, recovery habits after initial progress.",
    gapSignals: [
      "keep slipping back",
      "can't maintain",
      "started well then stopped",
      "burnout",
    ],
    whenToUse: "User needs habituation after initial progress; sustainability focus.",
  },
  {
    id: "feedback_conversation",
    name: "Constructive feedback practice",
    category: "development_activation",
    platformPhase: 3,
    acronym: null,
    description:
      "Workplace scenario practice: situation, behaviour, impact, empathy — aligns with constructive feedback and conflict-navigation coaching.",
    gapSignals: [
      "difficult conversation",
      "feedback to team",
      "manager",
      "conflict at work",
    ],
    whenToUse: "User scenario is delivering or preparing difficult workplace feedback.",
  },
  {
    id: "stress_regulation",
    name: "Stress regulation (window of tolerance)",
    category: "development_activation",
    platformPhase: 2,
    acronym: "WoT",
    description:
      "Notice hyper- vs hypo-arousal relative to a usable window of tolerance; pair regulation with load reduction and recovery habits. Links circles_of_control and sustainability_path.",
    gapSignals: [
      "too stressed",
      "wired then crash",
      "window of tolerance",
      "can't cope with load",
      "burned out",
    ],
    whenToUse: "Chronic stress/burnout framing once acute panic is settled.",
  },
  {
    id: "behavioural_experiment",
    name: "Behavioural experiment",
    category: "development_activation",
    platformPhase: 2,
    acronym: null,
    description:
      "Design a small real-world test of a negative prediction; compare expected vs actual outcome. Workplace-safe only — not clinical phobia exposure.",
    gapSignals: [
      "test my prediction",
      "what if I'm wrong",
      "they'll think",
      "safety behaviour",
    ],
    whenToUse: "User holds a testable interpersonal or performance prediction.",
  },
  {
    id: "structured_problem_solving",
    name: "Structured problem solving",
    category: "development_activation",
    platformPhase: 2,
    acronym: "SPS",
    description:
      "Define the problem, brainstorm options, weigh, choose, plan, review — one step per turn.",
    gapSignals: [
      "don't know what to do",
      "too many options",
      "problem solve",
      "stuck choosing next step",
    ],
    whenToUse: "Clear external problem with multiple workable options.",
  },
  {
    id: "worry_time",
    name: "Worry time",
    category: "development_activation",
    platformPhase: 2,
    acronym: null,
    description:
      "Contain free-floating worry to a short daily window; park daytime what-ifs; problem-solve only actionable items inside the window.",
    gapSignals: [
      "can't stop worrying",
      "what if all day",
      "worry spiral",
      "generalised worry",
    ],
    whenToUse: "Repetitive what-if chains without a single hot thought to challenge yet.",
  },
  {
    id: "values_clarification",
    name: "Values clarification",
    category: "development_activation",
    platformPhase: 3,
    acronym: null,
    description:
      "Clarify life/work directions that matter (people, principles, contribution) and align micro-actions — ACT-informed, coaching scope.",
    gapSignals: [
      "what matters",
      "lost purpose",
      "values",
      "why am I doing this",
    ],
    whenToUse: "Motivation/meaning gap; linking goals to values.",
  },
  {
    id: "strengths_spotting",
    name: "Strengths spotting",
    category: "development_activation",
    platformPhase: 3,
    acronym: null,
    description:
      "Identify character strengths in self and others and apply one strength to the current stuck point.",
    gapSignals: [
      "my strengths",
      "what I'm good at",
      "only see weaknesses",
      "signature strengths",
    ],
    whenToUse: "Deficit-focused self-view; need resource activation.",
  },
  {
    id: "gratitude_and_savouring",
    name: "Gratitude and savouring",
    category: "development_activation",
    platformPhase: 3,
    acronym: null,
    description:
      "Deliberately notice and linger on positive moments, kindness, awe, or flow — small workplace-safe doses. Avoid forcing positivity in crisis.",
    gapSignals: [
      "nothing good",
      "grey day",
      "grateful",
      "savour",
      "flow",
    ],
    whenToUse: "Flat affect or negativity bias when safety is not the issue.",
  },
  {
    id: "resilience_reframing",
    name: "Resilience reframing",
    category: "development_activation",
    platformPhase: 2,
    acronym: null,
    description:
      "Positive-CBT style reframe: workable alternative thoughts and past coping evidence without toxic positivity. Often pairs with HCPR.",
    gapSignals: [
      "can't bounce back",
      "always goes wrong",
      "I'm finished",
      "no silver lining",
    ],
    whenToUse: "After a setback when a balanced alternative thought would help.",
  },
  {
    id: "growth_mindset",
    name: "Growth mindset",
    category: "development_activation",
    platformPhase: 3,
    acronym: null,
    description:
      "Treat skills as improvable; use feedback as data; stretch into the growth zone without leaping into panic zone.",
    gapSignals: [
      "I'm just not good at",
      "feedback hurts",
      "fixed about",
      "prove myself",
    ],
    whenToUse: "Identity fused with performance feedback.",
  },
  {
    id: "self_compassion",
    name: "Self-compassion",
    category: "development_activation",
    platformPhase: 2,
    acronym: null,
    description:
      "Soften harsh self-attack; speak as you would to a respected colleague; common-humanity framing.",
    gapSignals: [
      "hard on myself",
      "I don't deserve",
      "self-criticism",
      "hate myself for",
    ],
    whenToUse: "Shame-driven self-attack blocking learning.",
  },
  {
    id: "grief_and_loss",
    name: "Grief and loss",
    category: "development_activation",
    platformPhase: 3,
    acronym: null,
    description:
      "Supportive coaching around bereavement and transition — normalise varied grief, map supports, gentle continuing bonds if wanted. Signpost NHS/specialist care; not bereavement therapy.",
    gapSignals: [
      "grief",
      "bereaved",
      "lost someone",
      "funeral",
      "anniversary of",
    ],
    whenToUse: "Loss is central; stay in coaching scope and signpost.",
  },
  {
    id: "problem_list_conceptualisation",
    name: "Problem list and conceptualisation",
    category: "core",
    platformPhase: 1,
    acronym: null,
    description:
      "Opening-phase skill: build a plain problem list and conceptualise the priority item (situation, trigger, beliefs, response) — one element per turn.",
    gapSignals: [
      "so many problems",
      "where do I start",
      "everything is a mess",
      "problem list",
    ],
    whenToUse: "Early session overload; need a structured opening map.",
  },
  {
    id: "conversation_skill",
    name: "Conversation skill (CBT dialogue craft)",
    category: "core",
    platformPhase: 1,
    acronym: null,
    description:
      "Phase One dialogue craft: reuse their words, normalise shame/imposter briefly, reflect situation/thoughts/feelings-body/avoidance already shared, then one Socratic question with a plain reason. Phase Two: process goals, ≤5 steps × ≤2 micro-actions, stimulus control when scrolling/avoidance appears.",
    gapSignals: [
      "freeze up",
      "feel like a fraud",
      "imposter",
      "performance review",
      "performance evaluation",
      "putting off",
      "scrolling instead",
      "can't find the right words",
    ],
    whenToUse: "Opening conceptualisation or feedback/procrastination loops — always prefer this craft over cold clinical questioning.",
  },
];

const ACRONYM_KEY = [
  { term: "BA", meaning: "Behavioural Activation (Development/Activation skill)" },
  { term: "HCPR", meaning: "Helpful, Constructive, Positive, Real — thought challenging toolkit" },
  { term: "DTR", meaning: "Daily Thought Record / thought on trial" },
  { term: "ABCD", meaning: "Activating event, Beliefs, Consequences, Disputation" },
  { term: "SOBER", meaning: "Stop, Observe, Breath, Expand, Respond — stress interruption" },
  { term: "WoT", meaning: "Window of Tolerance — usable arousal range for learning" },
  { term: "SPS", meaning: "Structured Problem Solving" },
  { term: "Core Skills", meaning: "Engine skills that run with conceptualisation (e.g. distancing, thought tools, grounding)" },
  {
    term: "Development/Activation Skills",
    meaning: "External modules applied in Phase 2–3 (e.g. BA, micro goals, values, strengths)",
  },
  { term: "Phase 1", meaning: "Person-centred conceptualisation (situation, trigger, beliefs, response)" },
  { term: "Phase 2", meaning: "Goal setting and planning" },
  { term: "Phase 3", meaning: "Skill application and practice" },
];

const SKILL_GAP_SUPER_PROMPT = `# Skills library — deploy with Adaptive Escalation Loop (all users)

## Skill categories
- **Core Skills:** conversation skill (dialogue craft), distancing, grounding & breathing, problem-list conceptualisation, HCPR, DTR, ABCD, cost-benefit, thinking-error tracking, circles of control. Deploy in Phase One conceptualisation, Phase Two when stuck, or in the **Sustainability Pivot Loop** when stress or failure blocks action.
- **Development/Activation Skills:** BA, micro goals, boundaries, behavioural experiments, SPS, worry time, stress regulation, values, strengths, gratitude/savouring, resilience reframing, growth mindset, self-compassion, grief & loss, sustainability path, constructive feedback. Deploy in Phase Two micro-stepping and Phase Three — **not** when the user is flooded (pivot to Core/grounding first).

## Detecting a skill gap (one skill per turn when appropriate)
Look for: avoidance, procrastination, fused distress, panic, repeating negative thoughts, cannot start a goal, resistance to practice, execution failure since last login, loss of momentum/habit, unbounded worry, boundary collapse, grief, meaning gap.
Map to **one** best-matching skill below. Name it in plain language once, then one question.
A retrieved knowledge-base hint (if present) may suggest a skill id — still deploy at most one skill.

## Sustainability Pivot Loop — which skill to deploy
When Phase Three detects failure on a **ladder step**: mini conceptualisation first (what failed, trigger, blocking thought) — one question per turn.
Then:
- **Flooded / panicky:** Grounding & breathing or Distancing first.
- **Default after mini conceptualisation:** **HCPR thought check** when a hot thought blocked the step.
- **Flooded by uncontrollables:** Circles of control — then HCPR if a thought remains.
- Then **retry the same sub-step** (or smaller) — do not advance major steps until current one is done.

## Avoidance and learning preferences (critical)
- Do **not** let preferred modality become an excuse to skip difficult practice.
- Develop weak modalities; do not only reinforce strengths.
- Personalised learning-style matching is **not** active.

## When recommending a skill
- One skill; one sentence why it fits; one clear question.
- Never dump toolkits or acronym lists unless the user asks.
- ShiftED is **not therapy**. Clinical-only topics (needle phobia protocols, trauma writing, clinician safety planning) are signposting only.`;

function formatSkillsForPrompt(opts = {}) {
  if (opts.condensed) {
    return [
      "# Skills (deploy one per turn when a gap is clear)",
      "Core: Conversation craft, Distancing / grounding (flooded), problem-list, HCPR, DTR, ABCD, cost-benefit, circles of control, thinking-error tracking.",
      "Development: BA, micro-goals, boundaries, experiments, SPS, worry-time, stress/WoT, values, strengths, gratitude, resilience, growth mindset, self-compassion, grief (signpost), sustainability, feedback.",
    ].join("\n");
  }

  const core = SKILLS.filter((s) => s.category === "core");
  const dev = SKILLS.filter((s) => s.category === "development_activation");

  const formatSkill = (s) => {
    const signals = s.gapSignals.slice(0, 5).join("; ");
    return `- **${s.name}**${s.acronym ? ` (${s.acronym})` : ""} [${s.category}, Phase ${s.platformPhase}]: ${s.description} Gap cues: ${signals}.`;
  };

  return [
    SKILL_GAP_SUPER_PROMPT,
    "",
    "### Core Skills",
    ...core.map(formatSkill),
    "",
    "### Development/Activation Skills",
    ...dev.map(formatSkill),
    "",
    "### Acronym key (internal clarity; do not recite to user)",
    ...ACRONYM_KEY.map((a) => `- ${a.term}: ${a.meaning}`),
  ].join("\n");
}

module.exports = {
  SKILLS,
  ACRONYM_KEY,
  SKILL_GAP_SUPER_PROMPT,
  formatSkillsForPrompt,
};
