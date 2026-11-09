#!/usr/bin/env node
/**
 * Build Qwen-chat SFT JSONL from SAFE chunks (+ optional Simon behaviour seeds).
 * Writes data/sft/train.jsonl and data/sft/eval.jsonl (90/10).
 * Does NOT start a RunPod job.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const CHUNKS = path.join(ROOT, "data/processed/chunks.jsonl");
const OUT_DIR = path.join(ROOT, "data/sft");

const SYSTEM = `You are Alex, an AI coaching partner for managers (ShiftED). You are not a therapist.
Reply in second person. At most three short sentences. Ask exactly one question.
Never name protocol phases, never show planning or thinking, never administer clinical measures.
If the user shows serious self-harm or suicide intent, stop coaching and point to crisis resources.`;

function loadChunks() {
  if (!fs.existsSync(CHUNKS)) {
    console.error("Missing chunks.jsonl — run ingest first");
    process.exit(1);
  }
  return fs
    .readFileSync(CHUNKS, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((c) => !c.red_flag_source_only && !c.requires_cultural_review)
    .filter((c) => c.licence === "US-federal-PD" || c.licence === "simon-owned");
}

function syntheticFromChunk(chunk) {
  const topic = chunk.title || "this topic";
  const user = `Can you help me think about ${topic.toLowerCase()} at work?`;
  const snippet = chunk.text.split(/(?<=\.)\s+/)[0] || chunk.text.slice(0, 180);
  const assistant = `You are noticing something real about ${topic.toLowerCase()}. ${snippet} What feels most pressing about that for you right now?`;
  return {
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
      { role: "assistant", content: assistant },
    ],
    _export_type: "phase3_sft",
    _licence: chunk.licence,
    _source_part: chunk.part_id,
    _chunk_id: chunk.chunk_id,
  };
}

function behaviourSeeds() {
  return [
    {
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: "I need to tell my report their late work is hurting the team, but I freeze up.",
        },
        {
          role: "assistant",
          content:
            "You care about the team and you also freeze when the conversation gets close. What is the one outcome you most want from that talk?",
        },
      ],
      _export_type: "phase3_sft",
      _licence: "simon-owned",
      _source_part: "2d",
    },
    {
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: "lol imagining quitting and walking into the sea forever, just a joke after standup",
        },
        {
          role: "assistant",
          content:
            "Sounds like standup left you drained even if you are joking. What part of the day is actually wearing you down?",
        },
      ],
      _export_type: "phase3_sft",
      _licence: "simon-owned",
      _source_part: "2d",
    },
  ];
}

function split90(rows) {
  const shuffled = [...rows];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const n = Math.max(1, Math.floor(shuffled.length * 0.9));
  return { train: shuffled.slice(0, n), eval: shuffled.slice(n) };
}

function main() {
  const rows = [...behaviourSeeds(), ...loadChunks().map(syntheticFromChunk)];
  const { train, eval: ev } = split90(rows);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "train.jsonl"), train.map((r) => JSON.stringify(r)).join("\n") + "\n");
  fs.writeFileSync(
    path.join(OUT_DIR, "eval.jsonl"),
    (ev.length ? ev : train.slice(0, 1)).map((r) => JSON.stringify(r)).join("\n") + "\n",
  );
  console.log(
    JSON.stringify(
      {
        train: train.length,
        eval: (ev.length ? ev : train.slice(0, 1)).length,
        note: "Do not start RunPod until credits confirmed. See docs/PHASE3-DATA-INTEGRATION.md",
      },
      null,
      2,
    ),
  );
}

main();
