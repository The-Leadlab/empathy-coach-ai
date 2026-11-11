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
];

const NOISE_LINE =
  /^(what (was |is )?(correct|good|wrong|right|works)|the good|assessment|critical |training mode|direct core|\[|try again|this is a training|this is a great|good response|no need for further|what needs fixing|what the llm|ritical error|context and system)/i;

function loadCompiledRules() {
  const candidates = [
    path.join(__dirname, "..", "data", "simon-coach-rules.json"),
    path.join(__dirname, "simon-coach-rules.json"),
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = JSON.parse(fs.readFileSync(p, "utf8"));
      const rules = Array.isArray(raw?.rules) ? raw.rules : [];
      return rules.map((r) => String(r || "").trim()).filter(Boolean);
    } catch {
      /* ignore corrupt file */
    }
  }
  return [];
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
  const maxRules = opts.maxRules ?? (forInference ? 28 : 48);
  const compiled = loadCompiledRules();
  const merged = dedupeRules([...HARD_CANON, ...compiled]).slice(0, maxRules);
  if (!merged.length) return "";
  const bullets = merged.map((r) => `- ${r}`).join("\n");
  return `# Simon coach canon (Layer 2 — all trainer feedback, old + new)
Mandatory for every learner. Overrides generic LoRA habits when safe. Safety always wins.
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
  dedupeRules,
};
