#!/usr/bin/env node
/**
 * Build a continued-SFT mix aimed at July tone + Phase3 protocol (no training run).
 * Target mix: ~40% Simon-style, ~40% phase3+protocol, ~20% hard-negatives (tagged).
 *
 *   node scripts/build-july-match-sft-mix.mjs
 *
 * Writes: data/sft/exports/train_july_match_mix.jsonl (+ .summary.json)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "data/sft/exports");

const SIMON = path.join(
  root,
  "data/sft/external/llm-training-old/TRANSFER-TO-MACBOOK-LLM-TRAINING/data/train_simon_feedback.jsonl",
);
const PHASE3 = path.join(root, "data/sft/train_phase3_plus_simon.clean.jsonl");
const GOLD = path.join(outDir, "gold_jul_nov.jsonl");
const OUT = path.join(outDir, "train_july_match_mix.jsonl");

function readJsonl(p) {
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function take(arr, n) {
  if (arr.length <= n) return arr.slice();
  // Stable subsample: every k-th row
  const out = [];
  const step = arr.length / n;
  for (let i = 0; i < n; i++) out.push(arr[Math.min(arr.length - 1, Math.floor(i * step))]);
  return out;
}

/** Synthetic hard-negatives: teach what NOT to do via corrected assistant (positive target). */
function hardNegatives() {
  return [
    {
      export_type: "hard_negative_corrected",
      source: "synthetic_july_match",
      bad_pattern: "multi_question",
      messages: [
        { role: "user", content: "My manager keeps ignoring my ideas in meetings." },
        {
          role: "assistant",
          content:
            "Being talked over like that can feel really demoralising. What usually happens in the moment when your idea gets skipped?",
        },
      ],
    },
    {
      export_type: "hard_negative_corrected",
      source: "synthetic_july_match",
      bad_pattern: "clinical_jargon",
      messages: [
        { role: "user", content: "I freeze whenever I have to give feedback." },
        {
          role: "assistant",
          content:
            "That freeze sounds really uncomfortable. What goes through your mind just before you go quiet?",
        },
      ],
    },
    {
      export_type: "hard_negative_corrected",
      source: "synthetic_july_match",
      bad_pattern: "skipped_handshake",
      messages: [
        {
          role: "user",
          content: "I snap at my partner after work and then feel awful.",
        },
        {
          role: "assistant",
          content:
            "Snapping then feeling awful afterwards sounds exhausting. Can you walk me through what typically happens in those evenings, starting with what sets it off?",
        },
      ],
    },
  ];
}

function main() {
  const simon = readJsonl(SIMON);
  const phase3 = readJsonl(PHASE3);
  const gold = readJsonl(GOLD);

  // Approximate 40/40/20 on a practical corpus size (~1200 lines).
  const target = 1200;
  const nSimon = Math.floor(target * 0.4);
  const nPhase = Math.floor(target * 0.4);
  const nHard = Math.max(hardNegatives().length, Math.floor(target * 0.2));

  const simonPart = [
    ...gold.filter((g) => g.export_type === "gold_starred" || g.export_type === "gold_feedback"),
    ...take(simon, nSimon),
  ].slice(0, nSimon);

  const phasePart = take(phase3, nPhase);
  const hardPart = [...hardNegatives(), ...take(simon, Math.max(0, nHard - hardNegatives().length))];

  const mix = [
    ...simonPart.map((r) => ({ ...r, mix_bucket: "simon_style" })),
    ...phasePart.map((r) => ({ ...r, mix_bucket: "phase3_protocol" })),
    ...hardPart.map((r) => ({ ...r, mix_bucket: "hard_negative_corrected" })),
  ];

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUT, mix.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const summary = {
    written_at: new Date().toISOString(),
    out: OUT,
    total: mix.length,
    by_bucket: {
      simon_style: simonPart.length,
      phase3_protocol: phasePart.length,
      hard_negative_corrected: hardPart.length,
    },
    sources: { simon: simon.length, phase3: phase3.length, gold: gold.length },
  };
  fs.writeFileSync(OUT.replace(/\.jsonl$/, ".summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main();
