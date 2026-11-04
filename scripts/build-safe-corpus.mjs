#!/usr/bin/env node
/**
 * Split extracted text files into ~600–800 token passages.
 * Usage: node scripts/build-safe-corpus.mjs <textDir> <map.csv>
 * map.csv columns: file,agency,title,url,licence
 */
import fs from "fs";
import path from "path";

const [textDir, mapCsv] = process.argv.slice(2);
if (!textDir || !mapCsv) {
  console.error("Usage: node scripts/build-safe-corpus.mjs <textDir> <map.csv>");
  process.exit(1);
}

function approxTokens(s) {
  return Math.ceil(String(s).split(/\s+/).filter(Boolean).length * 1.3);
}

function chunkText(text, target = 700) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let buf = [];
  for (const w of words) {
    buf.push(w);
    if (approxTokens(buf.join(" ")) >= target) {
      chunks.push(buf.join(" "));
      buf = [];
    }
  }
  if (buf.length) chunks.push(buf.join(" "));
  return chunks;
}

const mapLines = fs.readFileSync(mapCsv, "utf8").trim().split(/\r?\n/).slice(1);
const out = [];
let part = 1;
for (const line of mapLines) {
  const [file, agency, title, url, licence] = line.split(",").map((c) => c.trim());
  const abs = path.join(textDir, file);
  if (!fs.existsSync(abs)) continue;
  const text = fs.readFileSync(abs, "utf8");
  const chunks = chunkText(text);
  chunks.forEach((chunk, i) => {
    out.push(
      JSON.stringify({
        id: `${agency.toLowerCase().replace(/\W+/g, "-")}-${part}-${i + 1}`,
        agency,
        title,
        part: String(part),
        file,
        url,
        licence: licence || "us_public_domain",
        text: chunk,
      }),
    );
  });
  part += 1;
}

const destDir = path.join(process.cwd(), "knowledge-base", "safe-corpus");
fs.mkdirSync(destDir, { recursive: true });
const dest = path.join(destDir, "passages.jsonl");
fs.writeFileSync(dest, out.join("\n") + "\n");
console.log(`Wrote ${out.length} passages to ${dest}`);
