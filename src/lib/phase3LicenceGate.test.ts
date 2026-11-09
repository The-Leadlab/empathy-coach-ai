import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { gateDocument, isPhase3RagEnabled } = require("../../scripts/phase3/licenceGate.cjs");

describe("phase3 licence gate", () => {
  it("drops HOLD fixtures", () => {
    const r = gateDocument(
      { part_id: "1", source_agency: "CCI", licence: "hold", title: "CCI sample" },
      "copyrighted text",
      "data/fixtures/hold-cci-sample.txt",
    );
    expect(r.ok).toBe(false);
    expect(r.meta.exclude_reasons.join(" ")).toMatch(/hold/i);
  });

  it("drops PCL-5 / measure content", () => {
    const r = gateDocument(
      { part_id: "14", source_agency: "VA NCPTSD", licence: "US-federal-PD", title: "PCL-5 Patient Checklist" },
      "PCL-5 checklist items",
      "data/fixtures/measure-pcl5.txt",
    );
    expect(r.ok).toBe(false);
    expect(r.meta.exclude_reasons).toContain("validated_measure");
  });

  it("drops kids/youth materials", () => {
    const r = gateDocument(
      { part_id: "8", source_agency: "SAMHSA", licence: "US-federal-PD", title: "Youth coping skills" },
      "Youth and children wellbeing worksheet",
      "data/fixtures/kids-youth.txt",
    );
    expect(r.ok).toBe(false);
    expect(r.meta.exclude_reasons).toContain("kids_youth");
  });

  it("tags suicide workbook sources as red_flag_source_only but keeps for protocol designers", () => {
    const r = gateDocument(
      {
        part_id: "10",
        source_agency: "NIMH",
        licence: "US-federal-PD",
        title: "Suicide prevention patient workbook",
      },
      "self-harm workbook for patients",
      "data/fixtures/redflag-suicide-workbook.txt",
    );
    expect(r.ok).toBe(true);
    expect(r.tags).toContain("red_flag_source_only");
  });

  it("allows SAFE SAMHSA fixture", () => {
    const r = gateDocument(
      { part_id: "11", source_agency: "SAMHSA", licence: "US-federal-PD", title: "Managing Stress" },
      "Stress is a normal response",
      "data/fixtures/safe-samhsa-stress.txt",
    );
    expect(r.ok).toBe(true);
  });

  it("RAG flag defaults off", () => {
    const prev = process.env.PHASE3_RAG_ENABLED;
    delete process.env.PHASE3_RAG_ENABLED;
    expect(isPhase3RagEnabled()).toBe(false);
    if (prev !== undefined) process.env.PHASE3_RAG_ENABLED = prev;
  });
});

describe("phase3 processed corpus (after ingest)", () => {
  const chunksPath = path.join(process.cwd(), "data/processed/chunks.jsonl");

  it("never puts HOLD or PCL-5 paths into chunks.jsonl when file exists", () => {
    if (!fs.existsSync(chunksPath)) return;
    const lines = fs.readFileSync(chunksPath, "utf8").split(/\n/).filter(Boolean);
    const rows = lines.map((l) => JSON.parse(l));
    expect(rows.every((r) => r.licence !== "hold")).toBe(true);
    expect(rows.every((r) => !/\bpcl-?5\b/i.test(`${r.title} ${r.text}`))).toBe(true);
    expect(rows.every((r) => !/\bkids?\b|\byouth\b/i.test(r.title))).toBe(true);
  });
});
