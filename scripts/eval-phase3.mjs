#!/usr/bin/env node
/**
 * Phase 3 eval suite (licence, measures, RAG-off, red-flag index).
 * Exit 1 on failure.
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { gateDocument, isPhase3RagEnabled } = require("./phase3/licenceGate.cjs");
const {
  retrievePhase3Context,
  clearPhase3IndexCache,
} = require("../skills/phase3Rag.cjs");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

execSync("node scripts/phase3/ingest.mjs && node scripts/phase3/build-index.mjs && node scripts/phase3/build-sft.mjs", {
  cwd: ROOT,
  stdio: "inherit",
});

const chunks = fs
  .readFileSync(path.join(ROOT, "data/processed/chunks.jsonl"), "utf8")
  .split(/\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l));

assert(chunks.every((c) => c.licence !== "hold"), "HOLD licence leaked into chunks");
assert(chunks.every((c) => !/\bpcl-?5\b/i.test(`${c.title} ${c.text}`)), "PCL-5 leaked into chunks");

const hold = gateDocument(
  { licence: "hold", part_id: "1", source_agency: "CCI", title: "x" },
  "x",
  "hold",
);
assert(!hold.ok, "hold gate failed");

delete process.env.PHASE3_RAG_ENABLED;
clearPhase3IndexCache();
assert(!isPhase3RagEnabled(), "RAG should default off");
assert(retrievePhase3Context("stress").length === 0, "RAG returned hits while disabled");

process.env.PHASE3_RAG_ENABLED = "true";
clearPhase3IndexCache();
const hits = retrievePhase3Context("stress sleep mood work");
assert(hits.length > 0, "expected RAG hits when enabled");
assert(hits.every((h) => !/hearing voices/i.test(h.text)), "red-flag workbook in RAG hits");

// Joke vs serious fixtures (protocol design check — deterministic rules)
const joke =
  /\b(lol|joke|kidding|figure of speech)\b/i.test("lol imagining quitting forever just a joke") &&
  !/\b(plan|means|tonight|pills)\b/i.test("lol imagining quitting forever just a joke");
assert(joke, "joke fixture should stay in coaching mode heuristic");

const serious = /\b(plan|means|tonight)\b/i.test("I have a plan to end my life tonight");
assert(serious, "serious fixture should escalate heuristic");

const trainPath = path.join(ROOT, "data/sft/train.jsonl");
execSync(`node scripts/validate-training-jsonl.js "${trainPath}"`, { cwd: ROOT, stdio: "inherit" });

console.log("\nOK — phase3 evals passed");
