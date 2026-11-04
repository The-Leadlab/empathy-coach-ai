import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildWorkbookAuthorSystemPrompt,
  needsCrisisBox,
} = require("../../skills/workbookAuthorPrompt.cjs");

describe("workbookAuthorPrompt", () => {
  it("requires clinician review footer instruction", () => {
    const prompt = buildWorkbookAuthorSystemPrompt({
      topic: "worry",
      method: "thought record / HCPR",
      audience: "adult client",
    });
    expect(prompt).toContain("Draft — clinician review required");
    expect(prompt).toContain("British English");
  });

  it("adds crisis box for self-harm topics", () => {
    expect(needsCrisisBox("self-harm", "relapse prevention", "")).toBe(true);
    const prompt = buildWorkbookAuthorSystemPrompt({
      topic: "suicide risk screening",
      method: "safety planning",
      audience: "clinician",
    });
    expect(prompt).toMatch(/116 123/);
    expect(prompt).toMatch(/999/);
  });
});
