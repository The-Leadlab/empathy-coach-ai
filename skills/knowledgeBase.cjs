/**
 * Rule-based knowledge-base retrieval (Simon's skill router Layer 4).
 * Loads knowledge-base/index.json — does NOT dump full docs into the system prompt.
 * Inject only a compact top-N summary for the current turn.
 */

const path = require("path");
const fs = require("fs");

let cachedIndex = null;

function loadIndex() {
  if (cachedIndex) return cachedIndex;
  const candidates = [
    path.join(__dirname, "..", "knowledge-base", "index.json"),
    path.join(__dirname, "knowledge-base-index.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      cachedIndex = JSON.parse(fs.readFileSync(p, "utf8"));
      return cachedIndex;
    }
  }
  cachedIndex = { docs: [] };
  return cachedIndex;
}

/** Crisis / self-harm markers — protocol wins over coaching skills. */
const CRISIS_PATTERNS =
  /\b(suicid(?:e|al)|kill myself|end (?:it|my life)|self[-\s]?harm|cut myself|want to die|no reason to live|better off dead)\b/i;

/**
 * Detect coarse intent buckets from user text (rule-based).
 * @param {string} text
 * @returns {string[]}
 */
function detectIntents(text) {
  const t = String(text || "").toLowerCase();
  const intents = [];
  if (CRISIS_PATTERNS.test(t)) intents.push("crisis");
  if (/\b(panick?y|can't breathe|racing heart|5-4-3-2-1|ground|overwhelm(?:ed)?)\b/.test(t)) {
    intents.push("grounding");
  }
  if (/\b(scroll(?:ing)?|procrastinat|no motivation|avoiding|3:30|instagram|phone)\b/.test(t)) {
    intents.push("activation");
  }
  if (/\b(worried|worry|what if|anxious|anxiety)\b/.test(t)) intents.push("worry");
  if (/\b(thought|catastrophis|mind read|always|never|useless|i'm a failure)\b/.test(t)) {
    intents.push("thoughts");
  }
  if (/\b(boundary|say no|always available|after hours)\b/.test(t)) intents.push("boundaries");
  if (/\b(burnout|stressed|window of tolerance|wired)\b/.test(t)) intents.push("stress");
  if (/\b(grief|bereav|lost (?:my|someone)|funeral|mourning)\b/.test(t)) intents.push("grief");
  if (/\b(values?|purpose|what matters|meaning)\b/.test(t)) intents.push("values");
  if (/\b(strengths?|good at)\b/.test(t)) intents.push("strengths");
  if (/\b(feedback|difficult conversation|conflict at work|manager)\b/.test(t)) {
    intents.push("feedback");
  }
  if (
    /\b(performance (?:review|evaluation|appraisal)|freeze up|feel like a (?:total )?fraud|imposter|putting off|can't find the right words)\b/.test(
      t
    )
  ) {
    intents.push("conceptualise");
    intents.push("feedback");
  }
  if (/\b(problem list|where do i start|so many problems)\b/.test(t)) intents.push("conceptualise");
  if (/\b(grateful|gratitude|savour|savor|flow)\b/.test(t)) intents.push("gratitude");
  if (/\b(self[-\s]?critic|hard on myself|don't deserve)\b/.test(t)) intents.push("self_compassion");
  if (/\b(growth mindset|not good at|fixed)\b/.test(t)) intents.push("growth");
  if (/\b(experiment|test (?:my )?prediction)\b/.test(t)) intents.push("experiment");
  if (/\b(problem[-\s]?solv|options|don't know what to do)\b/.test(t)) intents.push("problem_solve");
  return intents;
}

/**
 * Detect coarse emotion cues.
 * @param {string} text
 * @returns {string[]}
 */
function detectEmotions(text) {
  const t = String(text || "").toLowerCase();
  const emotions = [];
  const map = [
    [/panic|panick/, "panic"],
    [/overwhelm|flooded|spiral/, "overwhelm"],
    [/anxi|nervous|uneasy/, "anxiety"],
    [/shame|embarrass/, "shame"],
    [/guilt/, "guilt"],
    [/sad|low mood|depress/, "sadness"],
    [/anger|furious|irritat/, "anger"],
    [/hopeless|despair/, "hopelessness"],
    [/grief|bereav/, "grief"],
    [/stress|burn(?:ed|t) out/, "stress"],
    [/envy|jealous/, "envy"],
    [/bored|numb|flat/, "numbness"],
  ];
  for (const [re, label] of map) {
    if (re.test(t)) emotions.push(label);
  }
  return emotions;
}

/** Map intents → preferred skill ids (library ids). */
const INTENT_TO_SKILLS = {
  crisis: [], // protocol only
  grounding: ["grounding_and_breathing", "distancing"],
  activation: ["behavioral_activation", "micro_goals"],
  worry: ["worry_time", "grounding_and_breathing", "hcpr_thought_challenge"],
  thoughts: ["hcpr_thought_challenge", "thinking_error_tracking", "dtr", "abcd_model"],
  boundaries: ["boundary_communication"],
  stress: ["stress_regulation", "circles_of_control", "sustainability_path"],
  grief: ["grief_and_loss", "self_compassion"],
  values: ["values_clarification", "micro_goals"],
  strengths: ["strengths_spotting"],
  feedback: ["feedback_conversation", "conversation_skill", "growth_mindset"],
  conceptualise: ["conversation_skill", "problem_list_conceptualisation", "distancing"],
  gratitude: ["gratitude_and_savouring"],
  self_compassion: ["self_compassion"],
  growth: ["growth_mindset"],
  experiment: ["behavioural_experiment"],
  problem_solve: ["structured_problem_solving", "micro_goals"],
};

/**
 * Score a KB doc against text + detected intents/emotions.
 */
function scoreDoc(doc, text, intents, emotions) {
  const t = String(text || "").toLowerCase();
  let score = 0;
  for (const trig of doc.intentTriggers || []) {
    if (t.includes(String(trig).toLowerCase())) score += 3;
  }
  for (const em of doc.emotionTriggers || []) {
    if (emotions.includes(String(em).toLowerCase()) || t.includes(String(em).toLowerCase())) {
      score += 2;
    }
  }
  // Intent bucket boost
  if (intents.includes("crisis") && doc.layer === "protocol" && /crisis/.test(doc.id)) score += 20;
  if (intents.includes("grounding") && (doc.skillIds || []).includes("grounding_and_breathing")) score += 5;
  if (intents.includes("activation") && (doc.skillIds || []).includes("behavioral_activation")) score += 5;
  if (intents.includes("worry") && (doc.skillIds || []).includes("worry_time")) score += 4;
  if (intents.includes("thoughts") && /hcpr|distort|thought/.test(doc.id)) score += 3;
  if (intents.includes("grief") && /grief/.test(doc.id)) score += 5;
  if (intents.includes("stress") && /stress|burnout|window/.test(doc.id + doc.path)) score += 4;
  return score;
}

/**
 * Route user text → skill ids (max 2) + optional protocol id.
 * @param {string} userText
 * @returns {{ skillIds: string[], protocolId: string|null, intents: string[], emotions: string[] }}
 */
function routeSkills(userText) {
  const intents = detectIntents(userText);
  const emotions = detectEmotions(userText);

  if (intents.includes("crisis")) {
    return {
      skillIds: [],
      protocolId: "protocol-crisis-response",
      intents,
      emotions,
    };
  }

  const ranked = [];
  for (const intent of intents) {
    for (const id of INTENT_TO_SKILLS[intent] || []) {
      const existing = ranked.find((r) => r.id === id);
      if (existing) existing.score += 2;
      else ranked.push({ id, score: 3 });
    }
  }

  // gapSignal-ish fallback from raw text
  const t = String(userText || "").toLowerCase();
  const fallbacks = [
    [/can't stop scrolling|3:30/, "behavioral_activation"],
    [/overwhelm(?:ed)? and panick?y|panick?y/, "grounding_and_breathing"],
    [/say no|boundary/, "boundary_communication"],
    [/burnout/, "stress_regulation"],
  ];
  for (const [re, id] of fallbacks) {
    if (re.test(t) && !ranked.some((r) => r.id === id)) ranked.push({ id, score: 2 });
  }

  ranked.sort((a, b) => b.score - a.score);
  return {
    skillIds: ranked.slice(0, 2).map((r) => r.id),
    protocolId: null,
    intents,
    emotions,
  };
}

/**
 * Retrieve top-N KB docs for a turn.
 * @param {string} userText
 * @param {{ limit?: number }} [opts]
 */
function retrieveKnowledge(userText, opts = {}) {
  const limit = opts.limit ?? 2;
  const index = loadIndex();
  const intents = detectIntents(userText);
  const emotions = detectEmotions(userText);

  if (intents.includes("crisis")) {
    const crisis = (index.docs || []).filter((d) => d.id === "protocol-crisis-response");
    return { docs: crisis.slice(0, 1), intents, emotions, route: routeSkills(userText) };
  }

  const scored = (index.docs || [])
    .map((d) => ({ d, score: scoreDoc(d, userText, intents, emotions) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.d);

  return { docs: scored, intents, emotions, route: routeSkills(userText) };
}

/**
 * Compact block for system prompt (token-safe).
 * @param {string} userText
 * @param {{ condensed?: boolean, limit?: number }} [opts]
 */
function formatKnowledgeForPrompt(userText, opts = {}) {
  if (!userText || !String(userText).trim()) return "";
  const condensed = !!opts.condensed;
  const limit = opts.limit ?? (condensed ? 1 : 2);
  const { docs, route } = retrieveKnowledge(userText, { limit });

  if (route.protocolId) {
    const line = condensed
      ? "KB: CRISIS PROTOCOL active — triage first; signpost UK lines; no coaching skill until safe."
      : [
          "# Retrieved knowledge (this turn)",
          "Protocol: crisis-response — clarify intent, assess risk across turns, signpost UK helplines.",
          "Do not run clinical safety planning. Do not deploy coaching skills until triage allows.",
          "PAPYRUS HOPELINE247 0800 068 4141 may be offered for under-35s / concern about a young person.",
        ].join("\n");
    return line;
  }

  if (!docs.length && !route.skillIds.length) return "";

  const skillHint = route.skillIds.length
    ? `Suggested skill id(s): ${route.skillIds.join(", ")} (deploy at most one).`
    : "";

  if (condensed) {
    const docHint = docs[0] ? `Doc: ${docs[0].id} — ${String(docs[0].summary).slice(0, 120)}` : "";
    return ["# KB retrieve (compact)", skillHint, docHint].filter(Boolean).join("\n");
  }

  const docLines = docs.map(
    (d) => `- [${d.layer}] ${d.id}: ${String(d.summary).slice(0, 160)} (source: ${d.source || "n/a"})`,
  );
  return ["# Retrieved knowledge (this turn — do not dump full worksheets)", skillHint, ...docLines]
    .filter(Boolean)
    .join("\n");
}

module.exports = {
  loadIndex,
  detectIntents,
  detectEmotions,
  routeSkills,
  retrieveKnowledge,
  formatKnowledgeForPrompt,
  CRISIS_PATTERNS,
  INTENT_TO_SKILLS,
};
