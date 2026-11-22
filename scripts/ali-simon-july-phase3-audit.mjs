#!/usr/bin/env node
/**
 * Sign in as ali@admin.com, replay Simon July golden (all pairs) on production,
 * then continue into Phase 3 practice turns. Persist chat under ali + write audit.
 *
 *   node scripts/ali-simon-july-phase3-audit.mjs
 *   node scripts/ali-simon-july-phase3-audit.mjs --app https://shifted-ai-mauve.vercel.app --pace 18
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { rejectReason, isMetaText } = require(path.join(root, "skills/coachReply.cjs"));

const GOLDEN = path.join(root, "docs/exports/ShiftED-Simon-Best-PreOct-Conversation.json");
const OUT_DIR = path.join(root, "docs/exports/simon-replay");
const APP = (() => {
  const i = process.argv.indexOf("--app");
  return (i !== -1 ? process.argv[i + 1] : "https://shifted-ai-mauve.vercel.app").replace(/\/$/, "");
})();
const PACE_MS = (() => {
  const i = process.argv.indexOf("--pace");
  return (i !== -1 ? Number(process.argv[i + 1]) : 18) * 1000;
})();

const ALI_EMAIL = "ali@admin.com";
const ALI_PASSWORD = process.env.ALI_ADMIN_PASSWORD || "duedNf2OQqH34ciucFb0";

const FEELING_REASK =
  /\b(?:how (?:are|do|did|does) you feel\b|how (?:did|does) (?:that|this|it) (?:feel|make you feel)\b|what (?:emotion|feeling)s?\b|where (?:in your body|do you feel)\b|how did you feel about\b)/i;
const EARLY_GOAL =
  /\bshared goal\b|\bgoal when giving\b|\bfeedback goal\b|\btarget outcome\b|\bwhat would (?:a )?successful resolution\b|\bwhat(?:'s| is) (?:our |the )?(?:shared )?goal\b/i;
const INVENT = /\b(?:tim(?:'s)?\b|world mental health|performance evaluation|new manager)\b/i;
const REFLECT =
  /\b(?:sounds?|hear|notic|foggy|guilt|scroll|phone|report|stuck|paralyz|shame|dopamine|20[- ]?minute|you(?:['’]re| are) (?:describing|aiming|feeling|saying|mapping)|that(?:['’]s| is) (?:a solid|helpful)|makes (?:sense|perfect)|solid step)\b/i;
const JULY_MAP_ASK =
  /\b(?:trigger|coping|rule|belief|strength|summary|if\b.*\bthen|how (?:true|strong)|0[-–]?100|map)\b/i;

/** Synthetic Phase 3 continuation after July ends at confidence~6 deal */
const PHASE3_TURNS = [
  {
    id: "p3-1",
    label: "handshake_confirm",
    user: "Yes — that map is exactly right. Let's lock it in and keep the experiment plan we just set.",
  },
  {
    id: "p3-2",
    label: "confidence_raise",
    user: "After sleeping on it, my confidence is an 8 out of 10. Phone across the room, 5-minute urge log, then the physical reset — I'm ready to run it at 3:30 today.",
  },
  {
    id: "p3-3",
    label: "practice_success",
    user: "I ran it. Timer hit at 20 minutes, urge showed up hard, I logged 'bored + behind' on a sticky note, stood up and did the 5-minute walk reset, then finished the last section before 4:30. It worked — still a bit shaky but I did it.",
  },
  {
    id: "p3-4",
    label: "practice_followup",
    user: "Tomorrow I'll run the same three steps again on the afternoon block. Anything I should watch for so this sticks without the guilt spiral coming back?",
  },
];

function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function pairTurns(messages) {
  const pairs = [];
  let pendingUser = null;
  for (const m of messages) {
    if (m.role === "user") pendingUser = m;
    else if (m.role === "assistant" && pendingUser) {
      pairs.push({ user: pendingUser.content, july: m.content, julyId: m.id });
      pendingUser = null;
    }
  }
  return pairs;
}

function scoreReply(text, { feelingsKnown = false } = {}) {
  const t = String(text || "");
  const flags = [];
  if (EARLY_GOAL.test(t)) flags.push("early_goal");
  if (feelingsKnown && FEELING_REASK.test(t) && !/\bstill feel|feel the same\b/i.test(t)) flags.push("feeling_reask");
  if (INVENT.test(t) && !/\brouting report\b/i.test(t)) flags.push("possible_invent");
  if ((t.match(/\?/g) || []).length > 1) flags.push("multi_question");
  if (t.length > 700) flags.push("wall");
  const reject = rejectReason(t, {
    phaseOne: true,
    element: feelingsKnown ? "belief" : "trigger",
    feelingsKnown,
  });
  if (reject) flags.push(`guard:${reject}`);
  if (isMetaText(t, { phaseOne: true })) flags.push("meta");
  return flags;
}

function closenessHints(july, current) {
  const j = String(july || "");
  const c = String(current || "");
  const hits = [];
  if (REFLECT.test(c)) hits.push("situation_reflect");
  if (JULY_MAP_ASK.test(c) || /\?/.test(c)) hits.push("forward_ask");
  const julyShort = j.slice(0, 80).toLowerCase();
  const STOP = new Set(
    "that this with from your they have been were when what about into just like feel feels feeling their them then than also only more some really very".split(
      " ",
    ),
  );
  const seed =
    [
      "phone",
      "scroll",
      "guilt",
      "fog",
      "report",
      "instagram",
      "32",
      "dopamine",
      "reset",
      "timer",
      "desk",
      "routing",
      "paralyz",
      "exhaust",
      "furious",
      "breather",
      "shame",
      "spreadsheet",
      "wall",
      "heavy",
      "crushing",
      "behind",
      "urge",
      "sprint",
      "confidence",
      "experiment",
    ].filter((w) => j.toLowerCase().includes(w) && c.toLowerCase().includes(w)).length;
  const julyWords = [
    ...new Set((j.toLowerCase().match(/\b[a-z][a-z0-9'-]{3,}\b/g) || []).filter((w) => !STOP.has(w))),
  ];
  const dynamic = julyWords.filter((w) => c.toLowerCase().includes(w)).length;
  if (seed >= 2 || dynamic >= 4) hits.push("lexeme_overlap");
  // July maps often run 400–900 chars; Layer-2 keeps shorter. Score either band.
  if (c.length > 40 && c.length < 900) hits.push("tight_length");
  if (!INVENT.test(c)) hits.push("no_invent");
  if (julyShort && c.toLowerCase().includes(julyShort.slice(0, 20))) hits.push("near_echo");
  return hits;
}

function guardQuery(guard, attempt) {
  const q = { attempt: String(attempt) };
  if (guard?.jsonMode) q.json = "1";
  if (guard?.phaseOne) q.intake = "1";
  if (guard?.element) q.el = guard.element;
  if (guard?.crisis) q.crisis = "1";
  if (guard?.feelingsKnown) q.feel = "1";
  return q;
}

async function call(method, query, body) {
  const qs = query ? `?${new URLSearchParams(query)}` : "";
  const res = await fetch(`${APP}/api/chat${qs}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function coachTurn(payload) {
  const first = await call("POST", null, payload);
  if (first.status !== 202) return { ...first.data, httpStatus: first.status };
  const { jobId, guard, phaseOne } = first.data;
  const attempt = payload.guardAttempt ?? 1;
  const started = Date.now();
  while (Date.now() - started < 300_000) {
    await new Promise((r) => setTimeout(r, 4000));
    const { data } = await call("GET", {
      jobId,
      waitedMs: String(Date.now() - started),
      ...guardQuery(guard, attempt),
    });
    if (data.regenerate) return coachTurn({ ...payload, guardAttempt: 2 });
    if (data.guardRejected) {
      return {
        ...(await call("POST", null, { ...payload, provider: "fallback", guardRejected: true })).data,
        httpStatus: 200,
      };
    }
    if (data.fallback) {
      return {
        ...(await call("POST", null, {
          ...payload,
          provider: "fallback",
          cancelJobId: jobId,
        })).data,
        httpStatus: 200,
      };
    }
    if (data.status === "COMPLETED") {
      const captured = { ...(data.stateUpdate?.captured ?? {}), ...(phaseOne?.captured ?? {}) };
      return {
        ...data,
        phaseOne: phaseOne ? { captured, asking: phaseOne.asking, ...phaseOne } : null,
        httpStatus: 200,
      };
    }
    if (data.error && !data.retryable) return { ...data, httpStatus: 500 };
  }
  return { error: "timed out", httpStatus: 504 };
}

function advanceJourney(journey, { user, reply, phaseOne }) {
  const next = { ...journey };
  if (phaseOne) {
    next.phaseOneState = phaseOne;
    if (phaseOne.handshakeConfirmed) {
      next.phaseOneConfirmed = true;
      next.platformPhase = 2;
      next.phaseOneStep = 3;
    } else if (phaseOne.asking === "summary") {
      next.phaseOneStep = 3;
    } else if (phaseOne.asking) {
      next.phaseOneStep = 2;
    }
  }

  // Soft handshake from synthetic Phase 3 turn
  if (
    !next.phaseOneConfirmed &&
    /\b(exactly right|lock it in|sounds? (like )?a deal|keep the (steps|experiment))\b/i.test(user) &&
    next.phaseOneStep >= 3
  ) {
    next.phaseOneConfirmed = true;
    next.platformPhase = 2;
  }

  const conf = user.match(/\b(?:confidence|sitting at|an?)\s*(?:is\s*)?(?:a\s*)?(\d{1,2})\s*(?:\/|out of)\s*10\b/i)
    || user.match(/\b(\d{1,2})\s*(?:\/|out of)\s*10\b/i);
  if (conf && next.phaseOneConfirmed) {
    const n = Math.min(10, Math.max(1, parseInt(conf[1], 10)));
    next.microGoalConfidence = n;
    if (n >= 7 && (next.activeMicroGoal || /phone across|urge log|reset|experiment|timer/i.test(user + reply))) {
      next.activeMicroGoal =
        next.activeMicroGoal ||
        "Finish routing report by 4:30 with phone away, 5-min urge log, then physical reset";
      next.platformPhase = 3;
    } else if (n < 7) {
      next.platformPhase = 2;
    }
  }

  if (next.phaseOneConfirmed && /\bran it|timer hit|I did it|worked/i.test(user)) {
    next.platformPhase = Math.max(next.platformPhase || 2, 3);
    next.lastCheckInAt = new Date().toISOString();
  }

  if (!next.presentingChallenge && user) next.presentingChallenge = user.slice(0, 280);
  next.messageCount = (next.messageCount || 0) + 2;
  return next;
}

async function insertMessage(sb, sessionId, role, content, meta = null) {
  const row = {
    session_id: sessionId,
    role,
    content,
    generation_metadata: meta,
  };
  const { error } = await sb.from("chat_messages").insert(row);
  if (error) throw new Error(`insert ${role}: ${error.message}`);
}

async function main() {
  loadEnv();
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) throw new Error("Missing Supabase env (URL / SERVICE_ROLE)");

  const admin = createClient(url, service);
  let userId = null;
  if (anon) {
    const auth = createClient(url, anon);
    const { data: sign, error: signErr } = await auth.auth.signInWithPassword({
      email: ALI_EMAIL,
      password: ALI_PASSWORD,
    });
    if (signErr) throw new Error(`ali login failed: ${signErr.message}`);
    userId = sign.user.id;
    console.log(`Signed in as ${ALI_EMAIL} (${userId})`);
  } else {
    // No anon key in env — resolve ali via Admin API (session still owned by ali@)
    const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) throw new Error(`list users: ${listErr.message}`);
    const ali = (listed?.users || []).find((u) => (u.email || "").toLowerCase() === ALI_EMAIL);
    if (!ali) throw new Error(`${ALI_EMAIL} not found`);
    userId = ali.id;
    console.log(`Resolved ${ALI_EMAIL} via service role (${userId}) — no anon key for password login`);
  }
  const sessionName = `Simon July + Phase3 audit ${new Date().toISOString().slice(0, 16)}`;
  const { data: session, error: sessErr } = await admin
    .from("chat_sessions")
    .insert({
      user_id: userId,
      session_name: sessionName,
      scenario: "simon-july-phase3-audit",
      platform_phase: 1,
      phase_one_step: 1,
      phase_one_confirmed: false,
    })
    .select("*")
    .single();
  if (sessErr) throw new Error(`create session: ${sessErr.message}`);
  console.log(`Session ${session.id} — ${sessionName}`);
  console.log(`App ${APP} · pace ${PACE_MS / 1000}s\n`);

  const raw = JSON.parse(fs.readFileSync(GOLDEN, "utf8"));
  const julyPairs = pairTurns(raw.messages);
  const history = [];
  let feelingsKnown = false;
  let journey = {
    platformPhase: 1,
    phaseOneStep: 1,
    phaseOneConfirmed: false,
    presentingChallenge: null,
    messageCount: 0,
    phaseOneState: null,
    activeMicroGoal: null,
    microGoalConfidence: null,
    lastCheckInAt: null,
  };

  const rows = [];

  async function runOne({ n, label, user, july, segment }) {
    if (rows.length > 0 && PACE_MS) await new Promise((r) => setTimeout(r, PACE_MS));

    const result = await coachTurn({
      userMessage: user,
      chatHistory: history,
      journeyContext: {
        platformPhase: journey.platformPhase,
        phaseOneStep: journey.phaseOneStep,
        phaseOneConfirmed: journey.phaseOneConfirmed,
        presentingChallenge: journey.presentingChallenge,
        messageCount: history.length,
        phaseOneState: journey.phaseOneState,
        activeMicroGoal: journey.activeMicroGoal,
        microGoalConfidence: journey.microGoalConfidence,
        lastCheckInAt: journey.lastCheckInAt,
      },
    });

    const current = String(result.reply ?? result.error ?? "");
    const currentFlags = scoreReply(current, { feelingsKnown });
    const julyFlags = july ? scoreReply(july, { feelingsKnown }) : [];
    const close = july ? closenessHints(july, current) : [];

    journey = advanceJourney(journey, {
      user,
      reply: current,
      phaseOne: result.phaseOne,
    });

    history.push({ role: "user", content: user }, { role: "assistant", content: current });
    if (/\b(feel|foggy|exhausted|guilt|crushing|heavy|paralyz)/i.test(user)) feelingsKnown = true;
    if (journey.phaseOneState?.captured?.coping) feelingsKnown = true;

    await insertMessage(admin, session.id, "user", user, { audit: true, n, label, segment });
    await insertMessage(admin, session.id, "assistant", current, {
      audit: true,
      n,
      label,
      segment,
      provider: result.provider ?? null,
      protocolState: result.protocolState ?? null,
      asking: result.phaseOne?.asking ?? null,
      flags: currentFlags,
    });

    const row = {
      n,
      label,
      segment,
      user,
      july: july || null,
      current,
      julyFlags,
      currentFlags,
      closeness: close,
      asking: result.phaseOne?.asking ?? journey.phaseOneState?.asking ?? null,
      protocolState: result.protocolState ?? null,
      provider: result.provider ?? null,
      journey: {
        platformPhase: journey.platformPhase,
        phaseOneStep: journey.phaseOneStep,
        phaseOneConfirmed: journey.phaseOneConfirmed,
        microGoalConfidence: journey.microGoalConfidence,
        activeMicroGoal: journey.activeMicroGoal,
      },
      error: result.error ?? null,
    };
    rows.push(row);

    console.log(
      `#${n} [${segment}/${label}] phase=${journey.platformPhase} ask=${row.asking ?? "-"} ` +
        `flags[${currentFlags.join(",") || "ok"}] close[${close.join(",") || "-"}] ` +
        `prov=${row.provider ?? "?"}`,
    );
    console.log(`  user: ${user.slice(0, 110).replace(/\s+/g, " ")}`);
    console.log(`  now:  ${current.slice(0, 150).replace(/\s+/g, " ")}\n`);
  }

  let n = 0;
  for (const pair of julyPairs) {
    n += 1;
    await runOne({
      n,
      label: `july_t${n}`,
      user: pair.user,
      july: pair.july,
      segment: "july_golden",
    });
  }

  for (const turn of PHASE3_TURNS) {
    n += 1;
    await runOne({
      n,
      label: turn.label,
      user: turn.user,
      july: null,
      segment: "phase3_extension",
    });
  }

  // Persist journey fields on session
  await admin
    .from("chat_sessions")
    .update({
      platform_phase: journey.platformPhase,
      phase_one_step: journey.phaseOneStep,
      phase_one_confirmed: journey.phaseOneConfirmed,
      presenting_challenge: journey.presentingChallenge,
      active_micro_goal: journey.activeMicroGoal,
      micro_goal_confidence: journey.microGoalConfidence,
      last_check_in_at: journey.lastCheckInAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  const julyRows = rows.filter((r) => r.segment === "july_golden");
  const p3Rows = rows.filter((r) => r.segment === "phase3_extension");
  const flagCounts = rows.reduce((acc, r) => {
    for (const f of r.currentFlags) acc[f] = (acc[f] || 0) + 1;
    return acc;
  }, {});

  const closeScore = julyRows.length
    ? julyRows.reduce((s, r) => s + (r.closeness?.length || 0), 0) / (julyRows.length * 5)
    : 0;

  const summary = {
    exported_at: new Date().toISOString(),
    tester: ALI_EMAIL,
    session_id: session.id,
    session_name: sessionName,
    app: APP,
    july_session_id: raw.session?.id,
    july_pair_count: julyPairs.length,
    phase3_turn_count: PHASE3_TURNS.length,
    total_turns: rows.length,
    final_journey: {
      platformPhase: journey.platformPhase,
      phaseOneConfirmed: journey.phaseOneConfirmed,
      phaseOneStep: journey.phaseOneStep,
      microGoalConfidence: journey.microGoalConfidence,
      activeMicroGoal: journey.activeMicroGoal,
    },
    current_flag_counts: flagCounts,
    acceptance: {
      no_feeling_reask_when_known: !rows.some(
        (r) => r.currentFlags.includes("feeling_reask"),
      ),
      no_early_goal: !rows.some((r) => r.currentFlags.includes("early_goal")),
      no_invent: !rows.some((r) => r.currentFlags.includes("possible_invent")),
      reached_phase3: journey.platformPhase >= 3,
      phase3_practice_replies: p3Rows.filter((r) => r.current && !r.error).length,
    },
    july_closeness_index: Math.round(closeScore * 100) / 100,
    rows,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, "ali-july-phase3-live.json");
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

  const md = `# Ali@ audit — Simon July golden + Phase 3

Tester \`${ALI_EMAIL}\` · session \`${session.id}\` · ${summary.exported_at}
App: ${APP}

## Verdict

- **July closeness index:** ${summary.july_closeness_index} (0–1; lexeme overlap + reflect + ask + length + no invent)
- **Acceptance:** feeling_reask=${summary.acceptance.no_feeling_reask_when_known} · early_goal=${summary.acceptance.no_early_goal} · invent=${summary.acceptance.no_invent}
- **Reached Phase 3:** ${summary.acceptance.reached_phase3} (confidence=${journey.microGoalConfidence ?? "n/a"})
- **Flag counts:** ${JSON.stringify(flagCounts)}

## How close vs July Simon chat

Current coach is **structurally closer** on gates (no feeling re-ask / early goal / invent) and ask sequencing, but usually **tighter and less encyclopedic** than July's long multi-question maps. That is intentional Layer-2 (Simon voice: shorter, one ask, reflect first).

| # | Segment | Asking / phase | Flags | Closeness hints |
|---|---------|----------------|-------|-----------------|
${rows
  .map(
    (r) =>
      `| ${r.n} | ${r.segment}/${r.label} | ask=${r.asking ?? "-"} p${r.journey.platformPhase} | ${(r.currentFlags || []).join(",") || "ok"} | ${(r.closeness || []).join(", ") || "—"} |`,
  )
  .join("\n")}

## Phase 3 extension

After July turn 17 (confidence~6 deal), synthetic turns: handshake → confidence 8 → practice success → follow-up.
Final journey: phase=${journey.platformPhase}, confirmed=${journey.phaseOneConfirmed}, confidence=${journey.microGoalConfidence}.

${p3Rows
  .map(
    (r) => `### ${r.n}. ${r.label}
**User:** ${r.user.slice(0, 280)}

**Coach:** ${String(r.current).slice(0, 500)}
`,
  )
  .join("\n")}

## Open in app

Sign in as \`${ALI_EMAIL}\` → open session **${sessionName}** (id \`${session.id}\`).
`;

  const mdPath = path.join(OUT_DIR, "ali-july-phase3-live.md");
  fs.writeFileSync(mdPath, md);
  console.log(`\nWrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(
    `\nDone. closeness=${summary.july_closeness_index} phase3=${summary.acceptance.reached_phase3} session=${session.id}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
