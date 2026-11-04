/**
 * Load and filter copyright-safe passages for clinician workbook drafting.
 * Config: config/workbookSources.json (override with WORKBOOK_SOURCES_CONFIG).
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function loadSourcesConfig() {
  const override = (process.env.WORKBOOK_SOURCES_CONFIG || "").trim();
  if (override) {
    if (override.startsWith("{")) {
      return JSON.parse(override);
    }
    const abs = path.isAbsolute(override) ? override : path.join(ROOT, override);
    return JSON.parse(fs.readFileSync(abs, "utf8"));
  }
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, "config", "workbookSources.json"), "utf8"),
  );
}

function normalizeAgency(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isPassageAllowed(passage, config = loadSourcesConfig()) {
  const licence = String(passage.licence || "").trim();
  const agency = String(passage.agency || "").trim();
  const sourceBlob = `${agency} ${passage.title || ""} ${passage.url || ""}`.toLowerCase();

  const blocked = (config.blockedSources || []).some((b) =>
    sourceBlob.includes(String(b).toLowerCase()),
  );
  if (blocked) return false;

  const allowedLicences = config.allowedLicences || [];
  if (allowedLicences.length && !allowedLicences.includes(licence)) return false;

  const allowedAgencies = (config.allowedAgencies || []).map(normalizeAgency);
  if (allowedAgencies.length && !allowedAgencies.includes(normalizeAgency(agency))) {
    return false;
  }

  return true;
}

function loadPassages(filePath) {
  const abs =
    filePath ||
    path.join(ROOT, "knowledge-base", "safe-corpus", "passages.jsonl");
  if (!fs.existsSync(abs)) return [];
  const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/).filter(Boolean);
  const out = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line));
    } catch {
      // skip bad lines
    }
  }
  return out;
}

function loadAllowedPassages(filePath) {
  const config = loadSourcesConfig();
  return loadPassages(filePath).filter((p) => isPassageAllowed(p, config));
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Simple keyword score (BM25-lite) over allowed passages.
 * @returns {{ passage: object, score: number, cite: string }[]}
 */
function searchPassages(query, opts = {}) {
  const topK = opts.topK ?? 4;
  const passages = opts.passages || loadAllowedPassages(opts.filePath);
  const qTokens = tokenize(query);
  if (!qTokens.length) return [];

  const scored = passages.map((passage, i) => {
    const hay = tokenize(`${passage.title} ${passage.text} ${passage.agency}`);
    let score = 0;
    for (const t of qTokens) {
      const hits = hay.filter((h) => h === t || h.includes(t)).length;
      score += hits;
    }
    return {
      passage,
      score,
      cite: `S${i + 1}`,
    };
  });

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((r, idx) => ({ ...r, cite: `S${idx + 1}` }));
}

function formatPassagesForPrompt(hits) {
  if (!hits.length) {
    return "No allowed source passages matched. Draft only general structure and mark every claim as needing clinician verification.";
  }
  return hits
    .map(
      (h) =>
        `[${h.cite}] ${h.passage.agency} — ${h.passage.title}\n${h.passage.text}\nLink: ${h.passage.url || "n/a"}`,
    )
    .join("\n\n");
}

module.exports = {
  loadSourcesConfig,
  isPassageAllowed,
  loadPassages,
  loadAllowedPassages,
  searchPassages,
  formatPassagesForPrompt,
  tokenize,
};
