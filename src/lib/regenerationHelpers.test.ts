import { describe, expect, it } from "vitest";
import {
  buildRegenerationUserPrompt,
  extractExactTargetReply,
} from "../../skills/regenerationHelpers.cjs";

describe("extractExactTargetReply", () => {
  it("extracts reply after explicit prefix", () => {
    const target = extractExactTargetReply([
      {
        feedbackText:
          "Use this exact reply: That sounds really tough. What felt hardest about that conversation for you?",
      },
    ]);
    expect(target).toContain("That sounds really tough");
  });

  it("extracts long coach-style feedback pasted as the desired reply", () => {
    const pasted =
      "I hear how frustrating that meeting was for you. It makes sense you'd feel stuck after that. What would a good outcome look like for you this week?";
    expect(extractExactTargetReply([{ feedbackText: pasted }])).toBe(pasted);
  });

  it("ignores short meta instructions", () => {
    expect(extractExactTargetReply([{ feedbackText: "Be more empathetic and shorter." }])).toBeNull();
  });

  it("extracts Simon mid-string Example of how it should have responded paste", () => {
    const desired =
      "Tim, thank you for sharing that. First, I want to take a breath with you. What you described matters, and I hear how heavy that self-evaluation has been. What feels most true for you in this moment?";
    const feedback =
      `I am putting in text I want it to respond with, so we should see this or a version closer to it, Example of how it should have responded: ${desired}`;
    expect(extractExactTargetReply([{ feedbackText: feedback }])).toBe(desired);
  });

  it("prefers labeled example over junk quote in earlier critique feedback", () => {
    const desired =
      "Tim, thank you for sharing that. First, I want to take a breath with you. You are not alone in this. What would support look like right now?";
    const target = extractExactTargetReply([
      {
        feedbackText:
          'I am still getting this as a regenerated response after save feedback, - ) and picked up on his core self-evaluation ("',
      },
      {
        feedbackText: `Example of how it should have responded: ${desired}`,
      },
    ]);
    expect(target).toBe(desired);
  });

  it("does not treat incomplete critique quotes as exact targets", () => {
    expect(
      extractExactTargetReply([
        {
          feedbackText:
            'I am still getting this as a regenerated response after save feedback, - ) and picked up on his core self-evaluation ("',
        },
      ]),
    ).toBeNull();
  });
});

describe("buildRegenerationUserPrompt", () => {
  it("includes target reply block when exact reply is detected", () => {
    const prompt = buildRegenerationUserPrompt({
      originalUserMessage: "My manager ignored me.",
      previousAssistantReply: "Tell me more about your manager.",
      feedbackList: [
        {
          feedbackText:
            "Reply should be: That sounds really tough — what part of that hit you hardest?",
        },
      ],
    });
    expect(prompt).toContain("[Target reply text]");
    expect(prompt).toContain("That sounds really tough — what part of that hit you hardest?");
    expect(prompt).toContain("Output only the target reply text above");
  });
});
