#!/usr/bin/env node
/**
 * Build data/simon-coach-rules.json from ALL Simon feedback sources
 * (old Phase1/2 zip, local exports, optional live Supabase).
 *
 *   node scripts/build-simon-coach-rules.mjs
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/build-simon-coach-rules.mjs
 */

import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/** Load gitignored .env / .env.local into process.env (no dependency). */
function loadEnvFiles() {
  for (const name of [".env", ".env.local"]) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  }
}
loadEnvFiles();

const { formatTrainerRuleForPrompt, isExactTargetPaste } = require("../skills/regenerationHelpers.cjs");
const { HARD_CANON, dedupeRules } = require("../skills/simonCoachRules.cjs");

const NOISE =
  /^(what (was |is )?(correct|good|wrong|right|works)|the good|assessment|critical |training mode|direct core|\[|try again|this is a training|this is a great|good response|no need for further|what needs fixing|what the llm|ritical error|context and system|what went right|what you did)/i;

const ACTIONABLE =
  /^(don'?t |do not |never |avoid |stop |keep |ask |use |stay |follow |mirror |vary |be |more |less |shorter|longer|should |needs? to |make it |add |remove |establish |challenge |summar|reflect |lock|one |when )/i;

const JSONL_SOURCES = [
  "train_simon_feedback.jsonl",
  "data/sft/external/phase1_phase2_simon_jun2026.jsonl",
  "data/sft/external/llm-training-old/TRANSFER-TO-MACBOOK-LLM-TRAINING/data/train_simon_feedback.jsonl",
  "data/sft/train_phase3_plus_simon.clean.jsonl",
  "data/sft/train_14b_gtm.jsonl",
];

function sectionAfter(sys, header) {
  const i = sys.indexOf(header);
  if (i < 0) return "";
  const rest = sys.slice(i + header.length);
  const n = rest.search(/\n# /);
  return n < 0 ? rest : rest.slice(0, n);
}

function acceptRule(text) {
  const s = String(text || "")
    .trim()
    .replace(/^[\u200b\u00a0]+/, "");
  if (!s || s.length < 24) return "";
  // Keep individual bullets short; long dumps are split upstream.
  if (s.length > 280) return "";
  if (isExactTargetPaste(s)) return "";
  if (NOISE.test(s)) return "";
  // Drop session-specific / meta prompt noise — Layer 2 must be reusable.
  if (
    /\b(Kate|Tim|Alex|Nikki)\b/i.test(s) ||
    /Follow every bullet below|These override generic|pattern to emulate|Underlying Fear|Automatic Thoughts|Thank you for/i.test(
      s,
    ) ||
    /^\*\*Phase|Goal before|Goal ladder|Uploaded documents|Treat trainer|They override|Do not mention trainers|If trainer guidance|Cross-learner|For a \*\*similar\*\*|Rotate naturally/i.test(
      s,
    )
  ) {
    return "";
  }
  // Must look like a standing instruction, not a one-off session note.
  if (!ACTIONABLE.test(s) && !/\b(do not|don't|never|ask |should |keep |avoid )\b/i.test(s)) return "";
  // Prefer general coaching directives over quoted example replies.
  if ((s.match(/"/g) || []).length >= 2 && s.length > 120) return "";
  const bullet = formatTrainerRuleForPrompt(s, 200);
  if (!bullet) return "";
  return bullet.replace(/^-\s*/, "");
}

/** Split a raw Simon critique into candidate rule lines. */
function candidatesFromFeedbackText(raw) {
  const t = String(raw || "").trim();
  if (!t) return [];
  const out = [];
  // Bullet / numbered lines
  for (const m of t.matchAll(/(?:^|\n)\s*(?:[-•*]|\d+[.)])\s+(.+)/g)) {
    out.push(m[1].trim());
  }
  // Paragraphs / sentences with directives
  for (const para of t.split(/\n+/)) {
    const p = para.trim();
    if (!p || NOISE.test(p)) continue;
    if (p.length <= 320) out.push(p);
    else {
      for (const sent of p.split(/(?<=[.!?])\s+/)) {
        if (sent.trim().length >= 20) out.push(sent.trim());
      }
    }
  }
  return out;
}

function collectFromJsonl(filePath, into, provenance) {
  if (!fs.existsSync(filePath)) return 0;
  let added = 0;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    const sys = (o.messages || []).find((m) => m.role === "system")?.content || "";
    const chunks = [];
    for (const h of [
      "# Trainer global standards (admin feedback",
      "# Trainer global standards (highest priority",
      "# Simon feedback for this training turn",
      "# Single-turn trainer feedback",
    ]) {
      chunks.push(sectionAfter(sys, h));
    }
    for (const k of ["_feedback_text", "feedback_text", "_trainer_note", "_regeneration_feedback"]) {
      if (o[k]) chunks.push(String(o[k]));
    }
    if (Array.isArray(o._feedback_notes)) chunks.push(...o._feedback_notes.map(String));

    for (const chunk of chunks) {
      for (const cand of candidatesFromFeedbackText(chunk)) {
        const rule = acceptRule(cand);
        if (!rule) continue;
        const key = rule.toLowerCase();
        if (into.has(key)) continue;
        into.set(key, rule);
        provenance.push({ rule, source: path.relative(root, filePath), type: o._export_type || "unknown" });
        added++;
      }
    }
  }
  return added;
}

async function collectFromSupabase(into, provenance) {
  const baseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) {
    console.warn("Supabase skipped (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to include live rows).");
    return 0;
  }
  let added = 0;
  let offset = 0;
  const page = 1000;
  while (true) {
    const url = `${baseUrl}/rest/v1/chat_feedback?select=feedback_text,apply_to_global_instructions,created_at&order=created_at.asc&limit=${page}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key.trim()}` },
    });
    if (!res.ok) {
      console.warn("Supabase chat_feedback fetch failed:", res.status);
      break;
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const r of rows) {
      if (r.apply_to_global_instructions === false) continue;
      for (const cand of candidatesFromFeedbackText(r.feedback_text)) {
        const rule = acceptRule(cand);
        if (!rule) continue;
        const keyLower = rule.toLowerCase();
        if (into.has(keyLower)) continue;
        into.set(keyLower, rule);
        provenance.push({ rule, source: "supabase:chat_feedback", type: "live" });
        added++;
      }
    }
    if (rows.length < page) break;
    offset += page;
  }
  return added;
}

async function main() {
  const into = new Map();
  const provenance = [];
  let fromFiles = 0;
  for (const rel of JSONL_SOURCES) {
    const n = collectFromJsonl(path.join(root, rel), into, provenance);
    fromFiles += n;
    console.log(`${rel}: +${n}`);
  }
  const fromSb = await collectFromSupabase(into, provenance);
  console.log(`supabase: +${fromSb}`);

  const compiled = dedupeRules([...into.values()]);
  const out = {
    built_at: new Date().toISOString(),
    hard_canon_count: HARD_CANON.length,
    compiled_count: compiled.length,
    sources_scanned: JSONL_SOURCES,
    supabase_included: fromSb > 0,
    rules: compiled,
    provenance: provenance.slice(0, 500),
  };

  const outPath = path.join(root, "data", "simon-coach-rules.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${outPath}`);
  console.log(`Hard canon: ${HARD_CANON.length} | Compiled from feedback: ${compiled.length} | file hits: ${fromFiles}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
