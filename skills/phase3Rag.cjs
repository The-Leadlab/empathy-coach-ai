/**
 * Phase 3 RAG over data/index/phase3-index.json (hash embeddings + keyword score).
 * Off unless PHASE3_RAG_ENABLED=true. Never returns red-flag / cultural-review chunks
 * (those are filtered at index build time).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { isPhase3RagEnabled } = require("../scripts/phase3/licenceGate.cjs");

const ROOT = path.join(__dirname, "..");
const DEFAULT_INDEX = path.join(ROOT, "data", "index", "phase3-index.json");

let cached = null;

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function hashEmbed(text, dim = 64) {
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

function cosine(a, b) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

function loadIndex(filePath) {
  const p = filePath || process.env.PHASE3_VECTOR_URI || DEFAULT_INDEX;
  if (cached && cached.path === p) return cached.data;
  if (!fs.existsSync(p)) {
    cached = { path: p, data: { records: [] } };
    return cached.data;
  }
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  cached = { path: p, data };
  return data;
}

/**
 * @param {string} userText
 * @param {{ limit?: number, excludeRedFlagSources?: boolean, indexPath?: string }} [opts]
 */
function retrievePhase3Context(userText, opts = {}) {
  if (!isPhase3RagEnabled()) return [];
  const limit = opts.limit ?? 3;
  const index = loadIndex(opts.indexPath);
  const records = index.records || [];
  if (!records.length) return [];

  const qTokens = tokenize(userText);
  const qVec = hashEmbed(userText, index.dim || 64);
  if (!qTokens.length) return [];

  const scored = records.map((r) => {
    let kw = 0;
    const hay = r.tokens || tokenize(`${r.title} ${r.text}`);
    for (const t of qTokens) {
      kw += hay.filter((h) => h === t || h.includes(t)).length;
    }
    const emb = r.embedding ? cosine(qVec, r.embedding) : 0;
    return { record: r, score: kw * 2 + emb };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.record);
}

/**
 * Compact prompt block. Internal only — coach must not dump citations to the user.
 * Aim ≤600–800 tokens (~2400–3200 chars).
 */
function formatPhase3ForPrompt(hits, maxChars = 2800) {
  if (!hits.length) return "";
  const lines = [
    "# Reference notes (internal — do not cite brands or quote long passages)",
    "Paraphrase in plain language if useful. Never attach PDFs. Never name protocol phases.",
  ];
  let used = lines.join("\n").length;
  for (const h of hits) {
    const snippet = String(h.text || "").slice(0, 700);
    const block = `\n- (${h.source_agency || "source"}) ${h.title || ""}: ${snippet}`;
    if (used + block.length > maxChars) break;
    lines.push(block);
    used += block.length;
  }
  return lines.join("\n");
}

function clearPhase3IndexCache() {
  cached = null;
}

module.exports = {
  retrievePhase3Context,
  formatPhase3ForPrompt,
  isPhase3RagEnabled,
  loadIndex,
  clearPhase3IndexCache,
  tokenize,
  hashEmbed,
};
