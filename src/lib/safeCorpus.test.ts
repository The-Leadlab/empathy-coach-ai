import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  isPassageAllowed,
  loadAllowedPassages,
  loadPassages,
  loadSourcesConfig,
  searchPassages,
} = require("../../skills/safeCorpus.cjs");

describe("safeCorpus", () => {
  it("loads sources config with blocked list", () => {
    const config = loadSourcesConfig();
    expect(config.blockedSources).toContain("PositivePsychology.com");
    expect(config.allowedLicences).toContain("us_public_domain");
  });

  it("never allows blocked commercial sources into allowed passages", () => {
    const all = loadPassages();
    const blocked = all.find((p: { agency: string }) => p.agency === "PositivePsychology.com");
    expect(blocked).toBeTruthy();
    expect(isPassageAllowed(blocked)).toBe(false);

    const allowed = loadAllowedPassages();
    expect(allowed.every((p: { agency: string }) => p.agency !== "PositivePsychology.com")).toBe(true);
    expect(allowed.every((p: { licence: string }) => p.licence === "us_public_domain")).toBe(true);
  });

  it("returns keyword hits only from allowed passages", () => {
    const hits = searchPassages("anxiety worry cognitive behavioural", { topK: 3 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h: { passage: { agency: string } }) => h.passage.agency !== "PositivePsychology.com")).toBe(
      true,
    );
  });
});
