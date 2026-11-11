#!/usr/bin/env node
/**
 * Merge Phase 3 + Simon feedback (+ optional data/sft/external/*.jsonl) into
 * data/sft/train_14b_gtm.jsonl and eval_14b_gtm.jsonl for Qwen2.5-14B QLoRA.
 *
 *   node scripts/merge-training-corpus.mjs
 *   npm run merge:training-corpus
 */
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const require = createRequire(import.meta.url);
const { hasInstructionLeak, hasStockClosing, hasWallOfText } = require("../skills/humanCoachVoice.cjs");

const OUT_TRAIN = path.join(root, "data/sft/train_14b_gtm.jsonl");
const OUT_EVAL = path.join(root, "data/sft/eval_14b_gtm.jsonl");
const EXTERNAL_DIR = path.join(root, "data/sft/external");
const EVAL_RATIO = 0.08;
/** Repeat Simon / Phase1–2 / exact-target behaviour rows so Phase 3 synthetic doesn't drown them. */
const SIMON_UPSAMPLE = 10;
const EXTERNAL_UPSAMPLE = 12;

const INPUTS = [
  { path: path.join(root, "data/sft/train_phase3_plus_simon.clean.jsonl"), tag: "phase3_plus_simon", priority: 2 },
  { path: path.join(root, "data/sft/train.jsonl"), tag: "phase3", priority: 1 },
  { path: path.join(root, "train_simon_feedback.jsonl"), tag: "simon", priority: 3 },
];

function fingerprint(messages) {
  const core = (messages || [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role}:${String(m.content || "").trim().slice(0, 200)}`)
    .join("|");
  return createHash("sha1").update(core).digest("hex");
}

function lastAssistant(messages) {
  for (let i = (messages || []).length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") return String(messages[i].content || "");
  }
  return "";
}

function sanitizeMessages(messages) {
  const clean = [];
  for (const m of messages || []) {
    if (!m || (m.role !== "system" && m.role !== "user" && m.role !== "assistant")) continue;
    const content = String(m.content ?? "").trim();
    if (m.role !== "system" && !content) continue;
    clean.push({ role: m.role, content: content || " " });
  }
  return clean;
}

function loadJsonl(filePath, tag) {
  if (!fs.existsSync(filePath)) return [];
  const rows = [];
  const text = fs.readFileSync(filePath, "utf8");
  for (const [i, line] of text.split("\n").entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      console.warn(`Skip bad JSON ${filePath}:${i + 1}`);
      continue;
    }
    const messages = sanitizeMessages(obj.messages);
    if (messages.length < 3) continue;
    const assistant = lastAssistant(messages);
    // Always drop instruction leaks / holiday hallucinations (WhatsApp regressions).
    if (hasInstructionLeak(assistant)) continue;
    if (/World Mental Health Day|Universal Human Right/i.test(assistant)) continue;
    // Stock closings / walls: keep Simon feedback / exact / regen / starred even if longer —
    // those are the corrections we must train on. Only drop walls on generic session turns.
    const isPhase3 = tag === "phase3" || tag === "phase3_plus_simon";
    const keepLongBehaviour = [
      "feedback_turn",
      "exact_target_turn",
      "regeneration_turn",
      "starred_turn",
    ].includes(obj._export_type);
    if (isPhase3) {
      if (assistant.length > 2500) continue;
    } else if (keepLongBehaviour) {
      if (hasStockClosing(assistant)) continue;
      if (assistant.length > 2500) continue;
    } else {
      if (hasStockClosing(assistant) || hasWallOfText(assistant)) continue;
      if (assistant.length > 1200) continue;
    }
    rows.push({
      messages,
      _source: tag,
      _export_type: obj._export_type || tag,
      _fp: fingerprint(messages),
      _priority: INPUTS.find((x) => x.tag === tag)?.priority ?? 2,
    });
  }
  return rows;
}

function listExternalJsonl(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      // Skip nested duplicates of train.jsonl.part* and copied skills packs; only take leaf JSONL.
      if (name === "llm-training-old") {
        // Prefer the flat copy we place in external/; still pick train_simon_feedback once under data/
        const nested = path.join(full, "TRANSFER-TO-MACBOOK-LLM-TRAINING/data/train_simon_feedback.jsonl");
        if (fs.existsSync(nested)) out.push(nested);
        continue;
      }
      out.push(...listExternalJsonl(full));
      continue;
    }
    if (name.endsWith(".jsonl") && !name.includes(".part")) out.push(full);
  }
  return out;
}

function loadExternal() {
  if (!fs.existsSync(EXTERNAL_DIR)) {
    fs.mkdirSync(EXTERNAL_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(EXTERNAL_DIR, ".gitkeep"),
      "# Drop other-laptop / legacy JSONL here, then re-run merge:training-corpus\n",
      "utf8",
    );
    return [];
  }
  const files = listExternalJsonl(EXTERNAL_DIR);
  const rows = [];
  const seenFiles = new Set();
  for (const f of files) {
    const key = path.basename(f);
    // Prefer flat external/*.jsonl over nested pack copies of the same name
    if (seenFiles.has(key) && path.dirname(f) !== EXTERNAL_DIR) continue;
    seenFiles.add(key);
    const tag = `external:${path.relative(EXTERNAL_DIR, f)}`;
    // Phase1/2 + Simon packs outrank generic duplicates.
    const priority = /phase1_phase2|simon/i.test(path.basename(f)) ? 5 : 4;
    const loaded = loadJsonl(f, tag).map((r) => ({ ...r, _priority: priority }));
    console.log(`  ${tag}: ${loaded.length} kept`);
    rows.push(...loaded);
  }
  return rows;
}

function main() {
  const all = [];
  for (const inp of INPUTS) {
    const rows = loadJsonl(inp.path, inp.tag);
    console.log(`${inp.tag}: ${rows.length} from ${path.relative(root, inp.path)}`);
    all.push(...rows);
  }
  const external = loadExternal();
  console.log(`external: ${external.length}`);
  all.push(...external);

  // Dedupe: keep highest priority per fingerprint
  const best = new Map();
  for (const row of all) {
    const prev = best.get(row._fp);
    if (!prev || row._priority > prev._priority) best.set(row._fp, row);
  }
  let merged = [...best.values()];

  const simonish = merged.filter((r) => {
    if (r._source === "simon" || String(r._source).startsWith("external")) return true;
    return ["exact_target_turn", "regeneration_turn", "feedback_turn", "starred_turn", "session_turn"].includes(
      r._export_type,
    );
  });
  const rest = merged.filter((r) => !simonish.includes(r));

  const upsampledSimon = [];
  for (const r of simonish) {
    const times = String(r._source).startsWith("external") ? EXTERNAL_UPSAMPLE : SIMON_UPSAMPLE;
    for (let i = 0; i < times; i++) {
      upsampledSimon.push({ ...r, _fp: `${r._fp}:up${i}` });
    }
  }
  merged = [...upsampledSimon, ...rest];
  merged.sort((a, b) => a._fp.localeCompare(b._fp));

  const evalCount = Math.max(1, Math.floor(merged.length * EVAL_RATIO));
  const evalRows = merged.slice(0, evalCount);
  const trainRows = merged.slice(evalCount);

  const toLine = (r) =>
    JSON.stringify({
      messages: r.messages,
      _source: r._source,
      _export_type: r._export_type,
    });

  fs.mkdirSync(path.dirname(OUT_TRAIN), { recursive: true });
  fs.writeFileSync(OUT_TRAIN, trainRows.map(toLine).join("\n") + "\n", "utf8");
  fs.writeFileSync(OUT_EVAL, evalRows.map(toLine).join("\n") + "\n", "utf8");

  const summary = {
    train: trainRows.length,
    eval: evalRows.length,
    by_source: {},
    written_at: new Date().toISOString(),
    out_train: path.relative(root, OUT_TRAIN),
    out_eval: path.relative(root, OUT_EVAL),
  };
  for (const r of [...trainRows, ...evalRows]) {
    summary.by_source[r._source] = (summary.by_source[r._source] || 0) + 1;
  }
  fs.writeFileSync(path.join(root, "data/sft/train_14b_gtm.summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log("\n--- merge summary ---");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nWrote ${OUT_TRAIN}`);
  console.log(`Wrote ${OUT_EVAL}`);
}

main();
