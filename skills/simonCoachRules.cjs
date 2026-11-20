/**
 * Layer 2 — Simon coach canon.
 * Always-on behavioural rules distilled from ALL trainer feedback (old + new),
 * plus hard stops from production regressions. Sits beside the LoRA; does not
 * replace exact-target short-circuit or humanCoachVoice rejects.
 */

const fs = require("fs");
const path = require("path");

/** Non-negotiable product rules (WhatsApp failures + Simon standing standards). */
const HARD_CANON = [
  "Reflect and briefly summarise what the user said and feels before asking your one question.",
  "Stay in conceptualisation until evidence, meaning, and the hot thought are clear — do not jump to goals, ladders, or techniques early.",
  "Before Reflective Handshake confirmation: never ask for a Goal, shared goal, goal when giving feedback, target outcome, or ladder steps.",
  "When a thought appears, deepen it at least once (what it means about them, or what evidence supports/challenges it) before moving on — do not skim thoughts and skip to goals.",
  "Summaries and reflections may only restate what this user said in this journey — never paste a stock training scenario (e.g. generic project failure / looking incompetent / avoiding the manager) unless they said those words.",
  "Establish rules and assumptions through Socratic questioning; do not ask for them directly. Ask the user to elaborate on what is frustrating or hard.",
  "Stay locked on the exact person and situation the user named. Do not invent a second context, holiday, campaign, news story, or named person they did not mention.",
  "Never mention World Mental Health Day, awareness campaigns, or calendar events unless the user brought them up.",
  "One clear question per reply. Keep 1–3 short sentences. Break long exercises into smaller turns.",
  "When using HCPR: challenge one hot thought only; do not switch thoughts mid-tool; follow the HCPR question order; summarise the user's HCPR answers when the tool completes.",
  "If the worry is about a future complaint or event, ask what would make it true this time and what that would mean — do not dig only into past complaints.",
  "When the user fears a specific outcome (e.g. a complaint), ask for evidence that supports or challenges that fear.",
  "Never paste instructions, reviewer labels, or meta text (e.g. \"fix tiny grammar\") into the user-facing reply.",
  "Never use stock closings like \"What feels most pressing about that for you right now?\", \"You are noticing something real…\", or \"You're facing a challenge today…\".",
  "Do not diagnose or use clinical jargon. Sound like a warm skilled colleague, not a worksheet.",
  "Never repeat the same question or opener from your previous reply (rephrasing still counts as repetition).",
  "When the user already answered, acknowledge it and move to the next protocol step — do not re-ask.",
  "Sound like a real conversation partner: lead with a short specific acknowledgment, vary your question shape every turn, and never read like a script or worksheet.",
  // Tim CBT case-formulation guide (runtime Layer-2 — no retrain required)
  "Reuse the user's exact words; never replace them with clinical labels like \"spike in stress\" or \"experiential avoidance\".",
  "When the opening message already contains situation, thoughts, feelings/body, and avoidance, organise that map back to them before asking the next question.",
  "Briefly normalise imposter or \"fraud\" feelings when the user names them, then continue assessment — do not skip past shame.",
  "Before a Socratic probe, give one plain reason you are focusing on that specific moment (socialise the link; do not jump cold into interrogation).",
  "Phase Two goals must be process-based (fairness, honesty, professionalism the user controls) — never \"make them agree\" or guarantee another person's reaction.",
  "Phase Two ladders: at most 5 steps, at most 2 micro-actions each; include stimulus control (e.g. phone away, time-box) when scrolling/avoidance is part of the loop.",
  // Weekly meeting 18 Nov 2026 — Simon / Louise / Kara
  "Open with 1–2 short sentences of specific empathy and active listening that build alliance — never open as a cold interrogation.",
  "Use downward-arrowing for rules and assumptions across turns (what the thought means about them; what would be so bad if it were true) — do not jump early to body/somatic questions while the thought is still thin.",
  "Stay on the primary problem; do not chase secondary tangents that stretch Phase One into a long rabbit-hole.",
  "Vary wording so the same stage does not feel identical every journey; never re-ask points already settled in this conversation.",
  "On a brand-new journey, learn their name / preferred address with simple warm questions before clinical mapping; then ease into the challenge little by little.",
];

const NOISE_LINE =
  /^(what (was |is )?(correct|good|wrong|right|works)|the good|assessment|critical |training mode|direct core|\[|try again|this is a training|this is a great|good response|no need for further|what needs fixing|what the llm|ritical error|context and system)/i;

function loadRulesFromJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const rules = Array.isArray(raw?.rules) ? raw.rules : [];
    return rules.map((r) => String(r || "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function loadCompiledRules() {
  const root = path.join(__dirname, "..", "data");
  const simon = loadRulesFromJson(path.join(root, "simon-coach-rules.json"));
  if (simon.length) return simon;
  return loadRulesFromJson(path.join(__dirname, "simon-coach-rules.json"));
}

/** July 2026 product decisions + Simon training feedback prompt (from old-laptop hunt). */
function loadJulyProductCanon() {
  return loadRulesFromJson(path.join(__dirname, "..", "data", "july-product-canon.json"));
}

function dedupeRules(rules) {
  const seen = new Set();
  const out = [];
  for (const r of rules) {
    const t = String(r || "")
      .trim()
      .replace(/^[-•*]\s*/, "");
    if (!t || t.length < 12) continue;
    if (NOISE_LINE.test(t)) continue;
    const key = t.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/**
 * Full Simon canon for prompts.
 * @param {{ forInference?: boolean, maxRules?: number }} [opts]
 */
function formatSimonCanonForPrompt(opts = {}) {
  const forInference = !!opts.forInference;
  const maxRules = opts.maxRules ?? (forInference ? 36 : 48);
  const compiled = loadCompiledRules();
  const julyCanon = loadJulyProductCanon();
  // July product decisions first (meeting + feedback prompt), then hard canon, then compiled feedback.
  const merged = dedupeRules([...julyCanon, ...HARD_CANON, ...compiled]).slice(0, maxRules);
  if (!merged.length) return "";
  const bullets = merged.map((r) => `- ${r}`).join("\n");
  return `# Simon coach canon (Layer 2 — July product bar + all trainer feedback)
Mandatory for every learner. Overrides generic LoRA habits when safe. Safety always wins.
Includes Jul 2026 meeting decisions and Simon training-feedback prompt recovered from the old laptop.
When Simon marked an exact reply for this turn, the exact-target path still wins over these bullets.
${bullets}`;
}

function getSimonHardCanon() {
  return [...HARD_CANON];
}

module.exports = {
  HARD_CANON,
  formatSimonCanonForPrompt,
  getSimonHardCanon,
  loadCompiledRules,
  loadJulyProductCanon,
  dedupeRules,
};
