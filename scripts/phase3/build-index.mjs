#!/usr/bin/env node
/**
 * Build a lightweight retrieval index from data/processed/chunks.jsonl.
 * Default: deterministic hash-embedding + keyword bag (no paid API).
 * Env: PHASE3_EMBEDDING_PROVIDER=hash|openai_compat (openai_compat reserved)
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const CHUNKS = path.join(ROOT, "data/processed/chunks.jsonl");
const OUT_DIR = path.join(ROOT, "data/index");
const DIM = 64;

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function hashEmbed(text, dim = DIM) {
  const vec = new Array(dim).fill(0);
  for (const t of tokenize(text)) {
    const h = crypto.createHash("sha256").update(t).digest();
    const idx = h[0] % dim;
    const sign = h[1] % 2 === 0 ? 1 : -1;
    vec[idx] += sign;
  }
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}

function loadChunks() {
  if (!fs.existsSync(CHUNKS)) {
    console.error("Missing chunks.jsonl — run node scripts/phase3/ingest.mjs first");
    process.exit(1);
  }
  return fs
    .readFileSync(CHUNKS, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function main() {
  const provider = (process.env.PHASE3_EMBEDDING_PROVIDER || "hash").trim();
  if (provider !== "hash" && provider !== "openai_compat") {
    console.warn(`Unknown PHASE3_EMBEDDING_PROVIDER=${provider}; using hash`);
  }

  const chunks = loadChunks().filter((c) => !c.red_flag_source_only);
  // Cultural review off by default in production retrieval
  const usable = chunks.filter((c) => !c.requires_cultural_review);

  const records = usable.map((c) => ({
    chunk_id: c.chunk_id,
    title: c.title,
    cite: c.cite,
    part_id: c.part_id,
    source_agency: c.source_agency,
    licence: c.licence,
    text: c.text,
    tokens: tokenize(`${c.title} ${c.text}`),
    embedding: hashEmbed(`${c.title} ${c.text}`),
  }));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, "phase3-index.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        version: 1,
        provider: "hash",
        dim: DIM,
        built_at: new Date().toISOString(),
        count: records.length,
        records,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ index: path.relative(ROOT, outPath), count: records.length }, null, 2));
}

main();
