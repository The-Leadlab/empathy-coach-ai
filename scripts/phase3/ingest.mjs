#!/usr/bin/env node
/**
 * Phase 3 ingest: discover fixtures (+ data/raw), licence-gate, chunk, write processed/*.
 * Usage: node scripts/phase3/ingest.mjs
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { gateDocument } = require("./licenceGate.cjs");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const FIXTURES = path.join(ROOT, "data/fixtures");
const RAW = path.join(ROOT, "data/raw");
const OUT = path.join(ROOT, "data/processed");

const TEXT_EXT = new Set([".txt", ".md", ".html", ".htm"]);
// PDF siblings written by scripts/phase3/extract-pdfs.py as `*.pdf.txt`
const CHUNK_CHARS = 1800; // ~400–800 tokens-ish for English
const OVERLAP = 200;

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    if (name.endsWith(".meta.json") || name === "_part.meta.json") continue;
    if (name.toLowerCase().endsWith(".zip")) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (TEXT_EXT.has(path.extname(name).toLowerCase())) acc.push(p);
  }
  return acc;
}

function loadMeta(filePath) {
  const metaPath = filePath.replace(/\.[^.]+$/, "") + ".meta.json";
  if (fs.existsSync(metaPath)) {
    return JSON.parse(fs.readFileSync(metaPath, "utf8"));
  }
  // Inherit data/raw/partN/_part.meta.json when walking extracts
  let dir = path.dirname(filePath);
  for (let i = 0; i < 8; i++) {
    const partMeta = path.join(dir, "_part.meta.json");
    if (fs.existsSync(partMeta)) {
      return JSON.parse(fs.readFileSync(partMeta, "utf8"));
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return {};
}

function cleanText(raw) {
  return String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkText(text, chunkIdBase) {
  const chunks = [];
  if (!text) return chunks;
  let start = 0;
  let i = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + CHUNK_CHARS);
    const slice = text.slice(start, end).trim();
    if (slice) {
      chunks.push({
        chunk_id: `${chunkIdBase}_${i}`,
        text: slice,
        section: i,
      });
      i += 1;
    }
    if (end >= text.length) break;
    start = Math.max(end - OVERLAP, start + 1);
  }
  return chunks;
}

function sha1(s) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const files = [...walk(FIXTURES), ...walk(RAW)];
  const manifest = [];
  const chunks = [];
  const exclusions = [];
  const seenHashes = new Set();
  let rawFileCount = walk(RAW).length;

  for (const filePath of files) {
    const rel = path.relative(ROOT, filePath);
    const text = cleanText(fs.readFileSync(filePath, "utf8"));
    const metaIn = loadMeta(filePath);
    const { ok, meta, tags } = gateDocument(metaIn, text, rel);
    const docId = sha1(rel).slice(0, 12);

    const row = {
      doc_id: docId,
      path: rel,
      part_id: meta.part_id,
      source_agency: meta.source_agency,
      licence: meta.licence,
      cite: meta.cite,
      title: meta.title,
      tags,
      exclude_reasons: meta.exclude_reasons,
      requires_cultural_review: !!meta.requires_cultural_review,
      red_flag_source_only: !!meta.red_flag_source_only,
    };

    if (!ok) {
      exclusions.push(`- \`${rel}\` — ${meta.exclude_reasons.join(", ") || "excluded"}`);
      manifest.push({ ...row, status: "excluded" });
      continue;
    }

    const hash = sha1(text);
    if (seenHashes.has(hash)) {
      exclusions.push(`- \`${rel}\` — duplicate_content`);
      manifest.push({ ...row, status: "excluded", exclude_reasons: ["duplicate_content"] });
      continue;
    }
    seenHashes.add(hash);

    const parts = chunkText(text, docId);
    for (const c of parts) {
      chunks.push({
        chunk_id: c.chunk_id,
        doc_id: docId,
        part_id: meta.part_id,
        source_agency: meta.source_agency,
        licence: meta.licence,
        cite: meta.cite,
        title: meta.title || path.basename(rel),
        section: c.section,
        text: c.text,
        tags,
        red_flag_source_only: !!meta.red_flag_source_only,
        requires_cultural_review: !!meta.requires_cultural_review,
      });
    }
    manifest.push({ ...row, status: "included", chunk_count: parts.length });
  }

  fs.writeFileSync(
    path.join(OUT, "manifest.jsonl"),
    manifest.map((r) => JSON.stringify(r)).join("\n") + (manifest.length ? "\n" : ""),
  );
  fs.writeFileSync(
    path.join(OUT, "chunks.jsonl"),
    chunks.map((r) => JSON.stringify(r)).join("\n") + (chunks.length ? "\n" : ""),
  );

  const blockedNote =
    rawFileCount === 0
      ? [
          "# BLOCKED: waiting for data/raw",
          "",
          "No SAFE zips under `data/raw/`. Ingest used **fixtures only**.",
          "Drop approved Parts 8–20 (+ Simon 2a/2d subsets) into `data/raw/<part-id>/` and re-run:",
          "",
          "```bash",
          "node scripts/phase3/ingest.mjs && node scripts/phase3/build-index.mjs && node scripts/phase3/build-sft.mjs",
          "```",
          "",
        ].join("\n")
      : "# Data/raw present\n\nIngest included local raw text files.\n";

  fs.writeFileSync(path.join(OUT, "BLOCKED.md"), blockedNote);
  fs.writeFileSync(
    path.join(OUT, "EXCLUSIONS.md"),
    ["# Phase 3 ingest exclusions", "", ...exclusions, ""].join("\n"),
  );

  console.log(
    JSON.stringify(
      {
        files: files.length,
        rawFiles: rawFileCount,
        included: manifest.filter((m) => m.status === "included").length,
        excluded: exclusions.length,
        chunks: chunks.length,
        out: path.relative(ROOT, OUT),
      },
      null,
      2,
    ),
  );
}

main();
