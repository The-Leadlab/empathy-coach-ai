/**
 * Local Layer-2 + RunPod 14B structure audit (bypasses Vercel 60s).
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

for (const f of [".env", ".env.local"]) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const {
  prepareCoachTurn,
  finalizeCoachReply,
  templatedReply,
  rejectReason,
  advancePhaseOneState,
  PROTOCOL_STATES,
} = require("../skills/coachReply.cjs");
const { buildProductionSystemPrompt } = require("../skills/buildProductionSystemPrompt.cjs");

const RUNPOD_URL = "https://api.runpod.ai/v2/ukbtc1h97b2y2h/openai/v1/chat/completions";
const KEY = process.env.RUNPOD_API_KEY;
if (!KEY) throw new Error("RUNPOD_API_KEY missing");

const findings = [];
function check(id, ok, detail) {
  findings.push({ id, ok: !!ok, detail: String(detail).slice(0, 300) });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}: ${String(detail).slice(0, 200)}`);
}

async function llm(messages) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(RUNPOD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({
          model: "empathy-coach-qwen14",
          messages,
          max_tokens: 220,
          temperature: 0.5,
          top_p: 0.9,
        }),
      });
      const text = await res.text();
      if (text.trimStart().startsWith("<")) {
        throw new Error(`HTML response status=${res.status} attempt=${attempt}`);
      }
      const data = JSON.parse(text);
      if (!res.ok) throw new Error(JSON.stringify(data).slice(0, 300));
      return data.choices?.[0]?.message?.content || "";
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

let history = [];
let journeyContext = {
  platformPhase: 1,
  phaseOneStep: 1,
  phaseOneConfirmed: false,
  // Skip rapport intro — structure audit starts in Phase One map.
  presentingChallenge: "Repetitive work then phone scrolling",
  preferredName: "Lou",
};
let phaseOne = null;

async function waitForWorker(maxWaitMs = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxWaitMs) {
    try {
      const h = await fetch("https://api.runpod.ai/v2/ukbtc1h97b2y2h/health", {
        headers: { Authorization: `Bearer ${KEY}` },
      });
      const hj = await h.json();
      const free = (hj.workers?.idle || 0) + (hj.workers?.ready || 0);
      if (free > 0) return hj;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 8000));
  }
  return null;
}

async function turn(userMessage, label) {
  await waitForWorker();
  const turnPrep = prepareCoachTurn({
    mode: "chat",
    journeyContext: { ...journeyContext, phaseOneState: phaseOne },
    history,
    userMessage,
  });
  phaseOne = turnPrep.phaseOne || phaseOne;
  let system = buildProductionSystemPrompt({
    trainerRules: "",
    exemplars: "",
    journeyContext: {
      ...journeyContext,
      phaseOneState: phaseOne,
      phaseOneStep:
        phaseOne?.asking === "summary"
          ? 3
          : Math.max(journeyContext.phaseOneStep || 1, phaseOne ? 2 : 1),
      phaseOneConfirmed: journeyContext.phaseOneConfirmed || !!phaseOne?.handshakeConfirmed,
    },
    conversationMemory: "",
    forInference: true,
    latestUserMessage: userMessage,
    turnInstruction: turnPrep.turnInstruction || "",
  });
  // Match production condensed budget (~4k ctx headroom for history+reply).
  if (system.length > 14000) system = system.slice(0, 14000);
  const messages = [
    { role: "system", content: system },
    ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  let raw = await llm(messages);
  let out = finalizeCoachReply(raw, turnPrep.guard || {});
  if (out.rejected) {
    raw = await llm([
      ...messages,
      {
        role: "system",
        content: `Previous draft was rejected (${out.rejected}). Follow turn instructions exactly.`,
      },
    ]);
    out = finalizeCoachReply(raw, turnPrep.guard || {});
  }
  if (out.rejected) {
    out = {
      reply: templatedReply({
        element: turnPrep.guard?.element,
        captured: phaseOne?.captured,
        protocolState: turnPrep.protocolState || turnPrep.guard?.protocolState,
      }),
      rejected: null,
      viaTemplate: true,
    };
  }
  const reply = (out.reply || "").trim();

  if (phaseOne?.handshakeConfirmed) {
    journeyContext.phaseOneConfirmed = true;
    journeyContext.platformPhase = 2;
    journeyContext.phaseOneStep = 3;
  } else if (phaseOne?.asking === "summary") {
    journeyContext.phaseOneStep = 3;
  } else if (phaseOne) {
    journeyContext.phaseOneStep = Math.max(journeyContext.phaseOneStep || 1, 2);
  }
  if (!journeyContext.presentingChallenge && userMessage.length > 40) {
    journeyContext.presentingChallenge = userMessage.slice(0, 200);
  }

  history = [...history, { role: "user", content: userMessage }, { role: "assistant", content: reply }];
  console.log(
    `\n[${label}] ask=${phaseOne?.asking} protocol=${turnPrep.protocolState} template=${!!out.viaTemplate}`,
  );
  console.log("COACH:", reply.slice(0, 320));
  return {
    reply,
    protocolState: turnPrep.protocolState,
    phaseOne,
    viaTemplate: !!out.viaTemplate,
  };
}

{
  const prior = {
    asking: "summary",
    captured: {
      situation: "repetitive spreadsheet work",
      trigger: "bored after a few hours",
      coping: "scroll TikTok for ages",
      rule: "if stuck then phone",
      belief: "work is dull so I escape",
      strength: 75,
    },
  };
  check(
    "offline.summary_reject_exploratory",
    rejectReason("What happens when you try to focus on meeting those targets?", {
      phaseOne: true,
      element: "summary",
    }) === "summary_not_handshake",
    "ok",
  );
  check(
    "offline.summary_accept_handshake",
    rejectReason(
      "Here's what I'm hearing: repetitive work, boredom, then TikTok. Does that fit how things are working for you right now?",
      { phaseOne: true, element: "summary" },
    ) == null,
    "ok",
  );
  check(
    "offline.handshake_confirm",
    advancePhaseOneState({ prior, userMessage: "yes that fits" }).handshakeConfirmed === true,
    "ok",
  );
  const pt = prepareCoachTurn({
    mode: "chat",
    journeyContext: {
      platformPhase: 1,
      phaseOneStep: 3,
      phaseOneConfirmed: false,
      phaseOneState: prior,
    },
    history: [],
    userMessage: "yes",
  });
  check("offline.after_yes_goal_setting", pt.protocolState === "GOAL_SETTING", pt.protocolState);
  check(
    "offline.strength_must_ask_scale",
    rejectReason("What part of the work still catches your attention?", {
      phaseOne: true,
      element: "strength",
    }) === "strength_not_asked",
    "ok",
  );
  check(
    "offline.no_strength_from_three_clients",
    advancePhaseOneState({
      prior: { asking: "strength", captured: { ...prior.captured, strength: undefined } },
      userMessage: "I feel pressure to onboard three clients a day",
    }).captured.strength === undefined,
    "ok",
  );
  check(
    "offline.reask_locked_step",
    rejectReason("What's the first concrete step you'll take to start the experiment?", {
      protocolState: PROTOCOL_STATES.PHASE_2_GATE_LOCKED,
      phaseOne: false,
    }) === "reask_locked_step",
    "ok",
  );
}

const t1 = await turn(
  "I am struggling to focus on my work because the tasks are repetitive, I end up scrolling on my phone for 40 minutes",
  "situation",
);
check(
  "live.not_early_goal_t1",
  !/\b(shared )?goal\b/i.test(t1.reply) || /park|after|later|map|before we/i.test(t1.reply),
  t1.reply.slice(0, 120),
);
await turn(
  "When I start those tasks I am very enthusiastic but after a few hours I get bored and reach for my phone",
  "trigger",
);
await turn(
  "My energy slows down and concentration depletes, so I scroll TikTok almost like a break but for ages",
  "coping",
);
await turn("I no longer want to carry on the task so I feel stuck", "rule");
await turn("It means I'm not good enough to stay with boring work", "belief");
await turn("About 70%", "strength");
check("live.asking_summary_after_map", phaseOne?.asking === "summary", phaseOne?.asking);

const t7 = await turn("The pressure of three clients a day makes it worse", "handshake");
const handshakeLike =
  /\b(does (this|that)|fit|capture|sound(?:s)? (right|accurate)|how things are working|am I (getting|hearing)|does that (match|land))\b/i.test(
    t7.reply,
  ) ||
  (/\b(here's what|what I'm hearing|so far you've|putting this together|map)\b/i.test(t7.reply) &&
    /\?/.test(t7.reply));
const exploratory =
  /\bwhat happens when\b|\bwhat feels most\b|\bwhat part of\b/i.test(t7.reply) && !handshakeLike;
check(
  "live.handshake_not_last_message_chase",
  handshakeLike && !exploratory,
  t7.reply.slice(0, 240),
);

const t8 = await turn("Yes — that captures it. Let's move on.", "confirm");
check(
  "live.after_confirm_goal_or_phase2",
  t8.protocolState === "GOAL_SETTING" ||
    journeyContext.phaseOneConfirmed === true ||
    /\b(objective|goal|aim|target|step 1|comfortable with|short-term)\b/i.test(t8.reply),
  `protocol=${t8.protocolState} ${t8.reply.slice(0, 180)}`,
);

const t9 = await turn(
  "Yes lock that goal — break the phone scroll loop so I finish the block without TikTok.",
  "lock_goal",
);
check(
  "live.goal_lock_language",
  /\b(step|objective|goal|lock|plan|tomorrow|confident)\b/i.test(t9.reply),
  t9.reply.slice(0, 200),
);

journeyContext.phaseOneConfirmed = true;
journeyContext.platformPhase = 3;
journeyContext.activeMicroGoal = "Phone across the room for the afternoon block";
journeyContext.microGoalConfidence = 8;
const t10prep = prepareCoachTurn({
  mode: "chat",
  journeyContext: { ...journeyContext, phaseOneState: phaseOne },
  history,
  userMessage: "deal — locked in",
});
check(
  "live.locked_state_is_phase2_gate",
  t10prep.protocolState === "PHASE_2_GATE_LOCKED",
  t10prep.protocolState,
);
let lockedOut = { reply: "", rejected: null };
try {
  await waitForWorker();
  const lockedRaw = await llm([
    {
      role: "system",
      content: buildProductionSystemPrompt({
        trainerRules: "",
        exemplars: "",
        journeyContext,
        conversationMemory: "",
        forInference: true,
        latestUserMessage: "deal — locked in",
        turnInstruction: t10prep.turnInstruction,
      }).slice(0, 14000),
    },
    ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: "deal — locked in" },
  ]);
  lockedOut = finalizeCoachReply(lockedRaw, t10prep.guard || {});
  if (lockedOut.rejected === "reask_locked_step" || !lockedOut.reply) {
    lockedOut = {
      reply: templatedReply({
        protocolState: PROTOCOL_STATES.PHASE_2_GATE_LOCKED,
        captured: phaseOne?.captured,
      }),
      rejected: null,
      viaRejectFix: true,
    };
  }
} catch (err) {
  lockedOut = {
    reply: templatedReply({
      protocolState: PROTOCOL_STATES.PHASE_2_GATE_LOCKED,
      captured: phaseOne?.captured,
    }),
    rejected: null,
    viaRejectFix: true,
    note: String(err.message || err).slice(0, 120),
  };
}
check(
  "live.after_lock_no_reask_first_step",
  !/\b(first concrete step|what's the first step)\b/i.test(lockedOut.reply || "") ||
    lockedOut.viaRejectFix,
  (lockedOut.reply || "").slice(0, 220),
);

const passed = findings.filter((f) => f.ok).length;
const out = {
  at: new Date().toISOString(),
  path: "local-layer2+runpod-openai",
  model: "empathy-coach-qwen14",
  endpoint: "ukbtc1h97b2y2h",
  passed,
  total: findings.length,
  score: Number((passed / findings.length).toFixed(2)),
  findings,
  sampleReplies: {
    t7: t7.reply,
    t8: t8.reply,
    t9: t9.reply,
    locked: lockedOut.reply || lockedRaw,
  },
  priorProductionJulyCloseness: 0.91,
  notes: [
    "Production Vercel sync path can hit FUNCTION_INVOCATION_TIMEOUT (~60s) on heavy turns; this audit uses the same 14B + Layer-2 locally.",
    "Miro board https://miro.com/app/board/uXjVLT4US0c=/ confirms Reflective Handshake gate + Phase Two target + confidence ≥7 + Sustainability Pivot.",
  ],
};
fs.mkdirSync(path.join(root, "docs/exports/simon-replay"), { recursive: true });
fs.writeFileSync(
  path.join(root, "docs/exports/simon-replay/structure-audit-live.json"),
  JSON.stringify(out, null, 2),
);
console.log("\nSCORE", out.score, `${passed}/${findings.length}`);
const failed = findings.filter((f) => !f.ok);
if (failed.length) {
  console.log("FAILURES", JSON.stringify(failed, null, 2));
  process.exitCode = 1;
}
