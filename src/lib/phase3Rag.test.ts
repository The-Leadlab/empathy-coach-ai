import { describe, expect, it, beforeAll, afterEach } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const {
  retrievePhase3Context,
  formatPhase3ForPrompt,
  clearPhase3IndexCache,
  isPhase3RagEnabled,
} = require("../../skills/phase3Rag.cjs");
const { buildProductionSystemPrompt } = require("../../skills/buildProductionSystemPrompt.cjs");

const indexPath = path.join(process.cwd(), "data/index/phase3-index.json");

beforeAll(() => {
  execSync("node scripts/phase3/ingest.mjs && node scripts/phase3/build-index.mjs", {
    cwd: process.cwd(),
    stdio: "pipe",
  });
  clearPhase3IndexCache();
});

afterEach(() => {
  delete process.env.PHASE3_RAG_ENABLED;
  clearPhase3IndexCache();
});

describe("phase3Rag", () => {
  it("returns nothing when RAG flag is off", () => {
    delete process.env.PHASE3_RAG_ENABLED;
    expect(isPhase3RagEnabled()).toBe(false);
    expect(retrievePhase3Context("stress at work sleep mood")).toEqual([]);
  });

  it("retrieves SAFE stress content when enabled and excludes red-flag index rows", () => {
    process.env.PHASE3_RAG_ENABLED = "true";
    clearPhase3IndexCache();
    expect(fs.existsSync(indexPath)).toBe(true);
    const hits = retrievePhase3Context("stress sleep mood concentration at work", { limit: 3 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h: { text: string }) => !/hearing voices/i.test(h.text))).toBe(true);
    const block = formatPhase3ForPrompt(hits);
    expect(block).toContain("Reference notes");
    expect(block.length).toBeLessThan(4000);
  });

  it("does not inject RAG into production prompt when flag unset", () => {
    delete process.env.PHASE3_RAG_ENABLED;
    const prompt = buildProductionSystemPrompt({
      forInference: true,
      latestUserMessage: "I am stressed and not sleeping",
    });
    expect(prompt).not.toContain("Reference notes (internal");
  });

  it("injects RAG block when flag on", () => {
    process.env.PHASE3_RAG_ENABLED = "true";
    clearPhase3IndexCache();
    const prompt = buildProductionSystemPrompt({
      forInference: true,
      latestUserMessage: "stress sleep irritability concentration",
    });
    expect(prompt).toContain("Reference notes (internal");
  });
});
