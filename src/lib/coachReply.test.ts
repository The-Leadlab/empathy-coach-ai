import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  stripThinking,
  createThinkStreamFilter,
  contentFromChoice,
  parseCoachJson,
  fallbackExtractReply,
  rejectReason,
  advancePhaseOneState,
  mergeStateUpdate,
  isPhaseOneIntake,
  finalizeCoachReply,
  prepareCoachTurn,
  runGuarded,
  templatedReply,
  withNoThink,
} = require("../../skills/coachReply.cjs");
const { buildSamplingParams } = require("../../skills/llmChatHelpers.cjs");

/** Shape of the reply that reached users in production: planning text, then the real question. */
const LEAKED_REPLY =
  'We need to follow Phase One, Step 1.2. The user described a conflict with their manager. ' +
  "Let's ask about the trigger. We should reflect their feeling first and then ask one question. " +
  'Something like: "That sounds really draining. What happened right before you felt that frustration spike?"';

describe("stripThinking", () => {
  it("removes closed think blocks", () => {
    expect(stripThinking("<think>plan the reply</think>What happened next?")).toBe("What happened next?");
  });

  it("drops reasoning before a stray closing tag", () => {
    expect(stripThinking("plan plan plan</think>\nWhat happened next?")).toBe("What happened next?");
  });

  it("drops everything after an unclosed think tag", () => {
    expect(stripThinking("That sounds hard. <think>now I should")).toBe("That sounds hard.");
  });

  it("removes chat-template tokens and /no_think", () => {
    expect(stripThinking("<|im_start|>assistant Hi there?<|im_end|> /no_think")).toBe("Hi there?");
  });
});

describe("createThinkStreamFilter", () => {
  it("never emits think content even when tags split across chunks", () => {
    const f = createThinkStreamFilter();
    const chunks = ["<th", "ink>secret pl", "an</thi", "nk>Hello, ", "how are you?"];
    const out = chunks.map((c) => f.push(c)).join("") + f.flush();
    expect(out).toBe("Hello, how are you?");
    expect(out).not.toMatch(/secret|think/);
  });

  it("discards text before a stray closing tag when nothing was emitted yet", () => {
    const f = createThinkStreamFilter();
    const out = f.push("reasoning here") + f.push("</thi") + f.push("nk>Real reply?") + f.flush();
    expect(out.trim()).toBe("Real reply?");
  });

  it("releases an untagged reply on flush", () => {
    const f = createThinkStreamFilter();
    expect(f.push("That sounds hard. ") + f.push("What happened?") + f.flush()).toBe(
      "That sounds hard. What happened?",
    );
  });
});

describe("contentFromChoice", () => {
  it("ignores reasoning fields", () => {
    const choice = { message: { content: "", reasoning_content: "We need to ask...", reasoning: "x" } };
    expect(contentFromChoice(choice)).toBe("");
  });

  it("reads text and array content parts", () => {
    expect(contentFromChoice({ text: "Hi?" })).toBe("Hi?");
    expect(contentFromChoice({ message: { content: [{ type: "text", text: "A" }, { text: "B" }] } })).toBe("AB");
  });
});

describe("parseCoachJson / fallbackExtractReply", () => {
  it("parses fenced JSON with surrounding text", () => {
    const raw = 'Sure:\n```json\n{"reply":"What happened?","state_update":{"step":"1.2"}}\n```';
    expect(parseCoachJson(raw)?.reply).toBe("What happened?");
  });

  it("returns null when reply is missing", () => {
    expect(parseCoachJson('{"state_update":{}}')).toBeNull();
  });

  it("extracts the quoted question from leaked reasoning", () => {
    expect(fallbackExtractReply(LEAKED_REPLY)).toBe(
      "That sounds really draining. What happened right before you felt that frustration spike?",
    );
  });

  it("extracts a reply field from truncated JSON", () => {
    expect(fallbackExtractReply('{"reply": "How strongly do you believe that, 0 to 100?", "state_')).toBe(
      "How strongly do you believe that, 0 to 100?",
    );
  });
});

describe("rejectReason", () => {
  it("rejects meta / third-person text", () => {
    expect(rejectReason(LEAKED_REPLY, {})).toBe("meta");
    expect(rejectReason("The user seems upset. What happened?", {})).toBe("meta");
  });

  it("requires a question on intake turns but not for the summary", () => {
    expect(rejectReason("That sounds hard.", { phaseOne: true, element: "trigger" })).toBe("no_question");
    expect(rejectReason("Here is what I heard.", { phaseOne: true, element: "summary" })).toBeNull();
  });

  it("allows step language outside intake (goal ladders)", () => {
    expect(rejectReason("Your next step could be one short conversation. Does that feel doable?", {})).toBeNull();
  });

  it("rejects LoRA stock closings and garbled truncations", () => {
    expect(
      rejectReason(
        "You are noticing something real about your mind today. What feels most pressing about that for you right now?",
        {},
      ),
    ).toBe("stock_closing");
    expect(
      rejectReason("That sounds hard. ccessing or staying stuck in negative thoughts. What happened next?", {}),
    ).toBe("garbled");
    expect(
      rejectReason("Doom-scrolling for hours sounds exhausting. What usually happens right before you pick up the phone?", {}),
    ).toBeNull();
  });

  it("formats trainer rules without dumping exact-reply pastes into the live prompt", () => {
    const { formatTrainerRuleForPrompt, extractExactTargetFromText } = require("../../skills/regenerationHelpers.cjs");
    expect(formatTrainerRuleForPrompt("Be shorter and warmer.")).toMatch(/Be shorter/);
    expect(
      formatTrainerRuleForPrompt(
        "Use this exact reply: That sounds heavy. What usually happens before you open the sheet?",
      ),
    ).toBe("");
    expect(
      extractExactTargetFromText(
        "Use this exact reply: That sounds heavy. What usually happens before you open the sheet?",
      ),
    ).toMatch(/That sounds heavy/);
  });

  it("rejects instruction leaks and walls of text from regenerate failures", () => {
    expect(
      rejectReason(
        "You may fix tiny grammar or punctuation only—do not rewrite, shorten, or revert to the previous reply. That is a huge realization, Tim.",
        {},
      ),
    ).toBe("instruction_leak");
    expect(
      rejectReason(
        "A long dump.\n\nDay #1 Goal: finish the sheet.\nStep 1: open Excel.\nStep 2: stare.\nStep 3: shame.\nStep 4: scroll.\nMore filler text so this exceeds the wall-of-text threshold with enough characters overall for the guard to fire hard.",
        {},
      ),
    ).toBe("wall_of_text");
  });
});

describe("Phase One state", () => {
  it("records the answer to the element that was asked and moves on", () => {
    const prior = { captured: { situation: "Meeting with my manager on Monday" }, asking: "trigger" };
    const next = advancePhaseOneState({ prior, history: [], userMessage: "When she interrupted me in front of the team" });
    expect(next.captured.trigger).toMatch(/interrupted/);
    expect(next.asking).toBe("rule");
  });

  it("keeps asking for strength until a number is given", () => {
    const prior = { captured: { situation: "s", trigger: "t", rule: "r", belief: "b" }, asking: "strength" };
    expect(advancePhaseOneState({ prior, history: [], userMessage: "quite a lot" }).asking).toBe("strength");
    const done = advancePhaseOneState({ prior, history: [], userMessage: "about 80" });
    expect(done.captured.strength).toBe(80);
    expect(done.asking).toBe("coping");
  });

  it("rebuilds state from history when no prior state is stored", () => {
    const history = [
      { role: "assistant", content: "What happened right before you felt that spike?" },
      { role: "user", content: "She questioned my numbers in the meeting" },
    ];
    const next = advancePhaseOneState({
      prior: null,
      history,
      userMessage: "If I make a mistake then people will think I'm useless",
      presentingChallenge: "Conflict with my manager about reporting",
    });
    expect(next.captured.situation).toMatch(/manager/);
    expect(next.captured.trigger).toMatch(/questioned/);
  });

  it("code-captured values win over model values", () => {
    const merged = mergeStateUpdate(
      { captured: { trigger: "user words" }, asking: "rule" },
      { captured: { trigger: "model words", rule: "If X then Y" } },
    );
    expect(merged.captured).toEqual({ trigger: "user words", rule: "If X then Y" });
  });

  it("only applies to Phase One steps 1–2 outside crisis", () => {
    expect(isPhaseOneIntake({ platformPhase: 1, phaseOneStep: 2 }, false)).toBe(true);
    expect(isPhaseOneIntake({ platformPhase: 1, phaseOneStep: 2 }, true)).toBe(false);
    expect(isPhaseOneIntake({ platformPhase: 2 }, false)).toBe(false);
    expect(isPhaseOneIntake({ platformPhase: 1, phaseOneStep: 3 }, false)).toBe(false);
  });
});

describe("finalizeCoachReply", () => {
  const intake = { jsonMode: true, phaseOne: true, element: "trigger", crisis: false };

  it("returns the JSON reply and state update", () => {
    const out = finalizeCoachReply(
      '<think>hmm</think>{"reply":"That sounds draining. What set it off?","state_update":{"captured":{"trigger":"x"}}}',
      intake,
    );
    expect(out.rejected).toBeNull();
    expect(out.reply).toBe("That sounds draining. What set it off?");
    expect(out.stateUpdate?.captured?.trigger).toBe("x");
  });

  it("salvages the question from leaked reasoning in JSON mode", () => {
    const out = finalizeCoachReply(LEAKED_REPLY, intake);
    expect(out.rejected).toBeNull();
    expect(out.reply).not.toMatch(/We need to|Phase One|The user/);
    expect(out.reply.endsWith("?")).toBe(true);
  });

  it("rejects pure reasoning with no usable question", () => {
    const out = finalizeCoachReply("We need to follow Step 1.2 and ask about the trigger.", intake);
    expect(out.rejected).toBeTruthy();
  });

  it("keeps hidden progress tags in plain mode", () => {
    const out = finalizeCoachReply("Nice work. What's one small step for this week? [[GOAL: Speak up once]]", {
      jsonMode: false,
      phaseOne: false,
    });
    expect(out.rejected).toBeNull();
    expect(out.reply).toContain("[[GOAL: Speak up once]]");
  });
});

describe("turn preparation and fallback chain", () => {
  it("adds a JSON turn instruction on intake turns", () => {
    const turn = prepareCoachTurn({
      mode: "chat",
      journeyContext: { platformPhase: 1, phaseOneStep: 2, presentingChallenge: "Conflict with my manager about reporting" },
      possibleCrisisLanguage: false,
      history: [],
      userMessage: "It happened again yesterday in the weekly meeting with everyone",
    });
    expect(turn.guard.jsonMode).toBe(true);
    expect(turn.turnInstruction).toMatch(/# This turn/);
    expect(turn.turnInstruction).toMatch(/Output format/);
  });

  it("does not guard journey naming", () => {
    expect(prepareCoachTurn({ mode: "name_journey" }).guard).toBeNull();
  });

  it("regenerates once, then gives up", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const guard = { jsonMode: false, phaseOne: false };
    const bad = "We need to ask the user about their trigger.";
    const gen = vi.fn().mockResolvedValueOnce(bad).mockResolvedValueOnce("That sounds hard. What happened?");
    expect((await runGuarded(gen, guard))?.reply).toBe("That sounds hard. What happened?");
    expect(gen).toHaveBeenLastCalledWith(true);

    const alwaysBad = vi.fn().mockResolvedValue(bad);
    expect(await runGuarded(alwaysBad, guard)).toBeNull();
    expect(alwaysBad).toHaveBeenCalledTimes(2);
    expect(await runGuarded(alwaysBad, guard, 1)).toBeNull();
    expect(alwaysBad).toHaveBeenCalledTimes(3);
  });

  it("templates a safe question per element and for crisis", () => {
    expect(templatedReply({ element: "strength" })).toMatch(/0 to 100.*\?$/);
    expect(templatedReply({ element: "trigger", crisis: true })).toMatch(/ending your life/);
  });

  it("appends /no_think to the system message only", () => {
    const msgs = withNoThink([
      { role: "system", content: "Be kind." },
      { role: "user", content: "hi" },
    ]);
    expect(msgs[0].content).toMatch(/\/no_think$/);
    expect(msgs[1].content).toBe("hi");
  });
});

describe("buildSamplingParams", () => {
  it("sends stop sequences and allows longer summaries", () => {
    const chat = buildSamplingParams("chat");
    expect(chat.stop).toContain("<think>");
    expect(buildSamplingParams("chat", { summaryTurn: true }).max_tokens).toBeGreaterThan(chat.max_tokens);
  });
});
