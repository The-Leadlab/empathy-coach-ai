/**
 * Licence + content gates for Phase 3 ingest.
 * SAFE: US-federal-PD + simon-owned + shifted-owned.
 * Third-party folders (CCI/NHS/CEDAR/PP/YouTube) stay HOLD even inside Simon packs.
 */

const SAFE_LICENCES = new Set(["US-federal-PD", "simon-owned", "shifted-owned"]);
const HOLD_LICENCES = new Set(["hold", "skip"]);

const SAFE_PART_IDS = new Set([
  "2a",
  "2d",
  "2e",
  "4a",
  "8",
  "8b",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
]);

/** Path/filename only — do not scan document body (false positives). */
const THIRD_PARTY_PATH_RE =
  /(positive[-_]?psychology|positivepsychology|nhs[-_]?resources|\/cci\b|\bcci[-_/]|cntw|cedar|berkshire|youtube|part[_-]?1\b|part[_-]?2b|part[_-]?2c|part[_-]?3[a-c]\b|part[_-]?4[b-e]\b|part[_-]?5\b|part[_-]?6[a-l]?\b|part[_-]?7\b)/i;

/** Folders that are clearly third-party worksheets Simon collected (not his authorship). */
const COLLECTED_THIRD_PARTY_DIR_RE =
  /\/(02-anxiety-info-sheets|03-depression-back-from-the-bluez|04-depression-info-sheets|05-depression-worksheets|09-nhs-resources|10-positive-psychology|12-worry|CCI guided audio)\b/i;

const MEASURE_RE =
  /\b(pcl-?5|phq-?9|isi\b|cows\b|ort\b|stanley[-\s]?brown|bryan[-\s]?rudd|safety[-\s]?plan form)\b/i;

const KIDS_RE = /\b(kids?|youth|children|adolescent|teen(?:ager)?s?|school counselling)\b/i;

const RED_FLAG_SOURCE_RE =
  /\b(suicid(?:e|al)|self[-\s]?harm|hearing voices|kill myself|end (?:my|their) life)\b/i;

function normalizeMeta(raw = {}, filePath = "") {
  const part_id = String(raw.part_id || guessPartId(filePath) || "").trim();
  let licence = String(raw.licence || "skip").trim();
  // ShiftED product/spec packs
  if (part_id === "2e" && (licence === "skip" || licence === "hold" || licence === "simon-owned")) {
    licence = "shifted-owned";
  }
  return {
    part_id,
    source_agency: String(raw.source_agency || raw.agency || "").trim(),
    licence,
    cite: String(raw.cite || raw.title || filePath).trim(),
    title: String(raw.title || "").trim(),
    exclude_reasons: Array.isArray(raw.exclude_reasons) ? [...raw.exclude_reasons] : [],
    // Part 20 cultural hold cleared (Simon OK 9 Nov 2026); keep meta flag if set explicitly.
    requires_cultural_review: !!raw.requires_cultural_review,
  };
}

function guessPartId(filePath) {
  const m = String(filePath).match(/(?:^|\/)(?:part)?(\d+[a-z]?)(?:\/|_part\.|\/extract)/i)
    || String(filePath).match(/part[_-]?(\d+[a-z]?)/i);
  return m ? m[1].toLowerCase() : "";
}

function pathIsThirdParty(filePath) {
  const p = String(filePath || "");
  return THIRD_PARTY_PATH_RE.test(p) || COLLECTED_THIRD_PARTY_DIR_RE.test(p);
}

/**
 * Decide whether a document may become coaching RAG / SFT content.
 * @returns {{ ok: boolean, meta: object, tags: string[] }}
 */
function gateDocument(metaInput, text, filePath = "") {
  const meta = normalizeMeta(metaInput, filePath);
  const tags = [];
  const pathBlob = `${filePath} ${meta.title} ${meta.cite} ${meta.source_agency}`;
  const body = String(text || "");

  if (HOLD_LICENCES.has(meta.licence)) {
    meta.exclude_reasons.push("hold_licence_or_path");
    return { ok: false, meta, tags: ["hold"] };
  }

  if (pathIsThirdParty(pathBlob)) {
    meta.exclude_reasons.push("hold_licence_or_path");
    return { ok: false, meta, tags: ["hold"] };
  }

  if (!SAFE_LICENCES.has(meta.licence)) {
    meta.exclude_reasons.push("licence_not_safe");
    return { ok: false, meta, tags: ["skip"] };
  }

  if (MEASURE_RE.test(`${pathBlob} ${body}`)) {
    meta.exclude_reasons.push("validated_measure");
    return { ok: false, meta, tags: ["measure"] };
  }

  if (KIDS_RE.test(`${pathBlob} ${body}`)) {
    meta.exclude_reasons.push("kids_youth");
    return { ok: false, meta, tags: ["kids"] };
  }

  if (RED_FLAG_SOURCE_RE.test(`${pathBlob} ${body}`) && /\b(workbook|patient|module|worksheet)\b/i.test(`${pathBlob} ${body}`)) {
    tags.push("red_flag_source_only");
    meta.red_flag_source_only = true;
  }

  if (meta.requires_cultural_review) {
    tags.push("requires_cultural_review");
  }

  return { ok: true, meta, tags };
}

function isPhase3RagEnabled() {
  const v = String(process.env.PHASE3_RAG_ENABLED || "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

module.exports = {
  SAFE_LICENCES,
  SAFE_PART_IDS,
  MEASURE_RE,
  KIDS_RE,
  RED_FLAG_SOURCE_RE,
  THIRD_PARTY_PATH_RE,
  COLLECTED_THIRD_PARTY_DIR_RE,
  normalizeMeta,
  gateDocument,
  isPhase3RagEnabled,
  pathIsThirdParty,
};
