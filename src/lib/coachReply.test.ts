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
    expect(
      rejectReason(
        "Here's what I'm hearing: the tasks feel repetitive and you scroll. Does that fit how things are working for you right now?",
        { phaseOne: true, element: "summary" },
      ),
    ).toBeNull();
  });

  it("rejects exploratory probes when Reflective Handshake is due", () => {
    expect(
      rejectReason("It makes sense that you feel pressured. What happens when you try to focus on meeting those targets?", {
        phaseOne: true,
        element: "summary",
      }),
    ).toBe("summary_not_handshake");
  });

  it("rejects strength turns that never ask 0–100", () => {
    expect(
      rejectReason("That sounds draining. What part of the work still catches your attention?", {
        phaseOne: true,
        element: "strength",
      }),
    ).toBe("strength_not_asked");
    expect(
      rejectReason("On a scale from 0 to 100, how strongly do you believe that thought right now?", {
        phaseOne: true,
        element: "strength",
      }),
    ).toBeNull();
  });

  it("does not treat incidental numbers as belief strength", () => {
    const next = advancePhaseOneState({
      prior: {
        asking: "strength",
        captured: {
          situation: "repetitive tasks",
          trigger: "bored",
          coping: "scroll",
          rule: "stuck",
          belief: "not good enough",
        },
      },
      userMessage: "I feel pressure to onboard three clients a day",
    });
    expect(next.captured.strength).toBeUndefined();
    expect(next.asking).toBe("strength");
    const withPct = advancePhaseOneState({
      prior: {
        asking: "strength",
        captured: {
          situation: "repetitive tasks",
          trigger: "bored",
          coping: "scroll",
          rule: "stuck",
          belief: "not good enough",
        },
      },
      userMessage: "About 70%",
    });
    expect(withPct.captured.strength).toBe(70);
    expect(withPct.asking).toBe("summary");
  });

  it("allows step language outside intake (goal ladders)", () => {
    expect(rejectReason("Your next step could be one short conversation. Does that feel doable?", {})).toBeNull();
  });

  it("rejects early goal / shared-goal asks during Phase One", () => {
    expect(
      rejectReason("What shared goal do you want when giving the feedback? What matters most?", {
        phaseOne: true,
        element: "trigger",
      }),
    ).toBe("early_goal");
    expect(
      rejectReason("What would a successful resolution look like for you?", {
        protocolState: "MAP_CORE_COMPONENTS",
      }),
    ).toBe("early_goal");
    expect(
      rejectReason("What would a successful resolution look like for you?", {
        protocolState: "GOAL_SETTING",
      }),
    ).toBeNull();
  });

  it("rejects feeling re-interview when coping already known, allows reinforcement", () => {
    expect(
      rejectReason("That second thought is heavy. How do you feel about it?", {
        phaseOne: true,
        element: "belief",
        feelingsKnown: true,
      }),
    ).toBe("feeling_reask");
    expect(
      rejectReason(
        "I hear the fog. What's the first thing you notice in your body when you start to feel that paralysis?",
        { phaseOne: true, element: "trigger", feelingsKnown: true },
      ),
    ).toBe("feeling_reask");
    expect(
      rejectReason("That second thought is heavy. Do you still feel the same about it?", {
        phaseOne: true,
        element: "belief",
        feelingsKnown: true,
      }),
    ).toBeNull();
    expect(
      rejectReason("When that thought shows up, what do you notice in your body?", {
        phaseOne: true,
        element: "coping",
        feelingsKnown: false,
      }),
    ).toBeNull();
  });

  it("rejects affirming a weekly goal before handshake", () => {
    expect(
      rejectReason(
        "You've pinned a clear deadline—4:30 PM every day. Does that capture everything you want to achieve this week?",
        { phaseOne: true, element: "rule" },
      ),
    ).toBe("early_goal");
    expect(
      rejectReason("That sounds like a solid target. What would a day look like for you?", {
        phaseOne: true,
        element: "summary",
      }),
    ).toBe("early_goal");
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
    expect(next.asking).toBe("coping");
  });

  it("keeps asking for strength until a number is given", () => {
    const prior = {
      captured: { situation: "s", trigger: "t", coping: "c", rule: "r", belief: "b" },
      asking: "strength",
    };
    expect(advancePhaseOneState({ prior, history: [], userMessage: "quite a lot" }).asking).toBe("strength");
    const done = advancePhaseOneState({ prior, history: [], userMessage: "about 80" });
    expect(done.captured.strength).toBe(80);
    expect(done.asking).toBe("summary");
  });

  it("skips ahead when the user says the question was already asked", () => {
    const prior = {
      captured: { situation: "Scrolling at work", trigger: "Repetitive tasks" },
      asking: "coping",
    };
    const next = advancePhaseOneState({
      prior,
      history: [],
      userMessage: "I feel like you've asked this question quite a few times.",
    });
    expect(next.captured.coping).toMatch(/already covered/i);
    expect(next.asking).toBe("rule");
  });

  it("does not run Phase One intake on uploaded document turns", () => {
    const turn = prepareCoachTurn({
      mode: "chat",
      journeyContext: { platformPhase: 1, phaseOneStep: 2, phaseOneConfirmed: false },
      history: [],
      userMessage: "[Uploaded document for analysis: louise.pdf]\n\nPlease analyse.\n---\nhello\n---",
    });
    expect(turn.phaseOne).toBeNull();
    expect(turn.turnInstruction).toMatch(/uploaded a document/i);
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

  it("keeps Phase One intake through summary (step 3) until handshake confirm", () => {
    expect(isPhaseOneIntake({ platformPhase: 1, phaseOneStep: 2 }, false)).toBe(true);
    expect(isPhaseOneIntake({ platformPhase: 1, phaseOneStep: 3 }, false)).toBe(true);
    expect(isPhaseOneIntake({ platformPhase: 1, phaseOneStep: 3, phaseOneConfirmed: true }, false)).toBe(false);
    expect(isPhaseOneIntake({ platformPhase: 1, phaseOneStep: 2 }, true)).toBe(false);
    expect(isPhaseOneIntake({ platformPhase: 2 }, false)).toBe(false);
  });

  it("recomputes asking after merge so rule cannot stick once captured", () => {
    const merged = mergeStateUpdate(
      {
        captured: {
          situation: "desk",
          trigger: "fog",
          coping: "scroll",
          rule: "if fog then phone",
        },
        asking: "rule",
      },
      { captured: { belief: "" } },
    );
    expect(merged.asking).toBe("belief");
  });

  it("exits the summary loop when the user confirms the handshake", () => {
    const prior = {
      captured: {
        situation: "Scrolling at work",
        trigger: "Paralyzed by repetitive tasks",
        rule: "Look for stimulating distraction",
        belief: "Work is boring",
        strength: 95,
        coping: "Scroll phone 40 minutes",
      },
      asking: "summary",
    };
    const next = advancePhaseOneState({ prior, history: [], userMessage: "yes can we move on?" });
    expect(next.handshakeConfirmed).toBe(true);

    const turn = prepareCoachTurn({
      mode: "chat",
      journeyContext: { platformPhase: 1, phaseOneStep: 1, phaseOneConfirmed: false, phaseOneState: prior },
      history: [],
      userMessage: "yes",
    });
    expect(turn.phaseOne?.handshakeConfirmed).toBe(true);
    expect(turn.guard?.phaseOne).toBe(false);
    expect(turn.turnInstruction).toMatch(/Phase Two/i);
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
    expect(turn.protocolState).toBe("MAP_CORE_COMPONENTS");
    expect(turn.turnInstruction).toMatch(/MAP_CORE_COMPONENTS|Hot Cross Bun/);
    expect(turn.turnInstruction).toMatch(/# This turn/);
    expect(turn.turnInstruction).toMatch(/Output format/);
  });

  it("injects Phase Two hard-gate turnInstruction after handshake", () => {
    const turn = prepareCoachTurn({
      mode: "chat",
      journeyContext: {
        platformPhase: 2,
        phaseOneConfirmed: true,
        activeMicroGoal: "Draft one sentence",
        microGoalConfidence: 5,
      },
      history: [],
      userMessage: "Still nervous about sending it",
    });
    expect(turn.phaseOne).toBeNull();
    expect(turn.protocolState).toBe("MICRO_STEPPING_AND_CONFIDENCE_CHECK");
    expect(turn.turnInstruction).toMatch(/confidence|≥7|hard gate/i);
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
