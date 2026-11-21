#!/usr/bin/env node
/**
 * Replays Simon's best pre-Oct golden chat user turns against the live coach
 * and writes a side-by-side gap report (July assistant vs current).
 *
 * Offline (default): scores July replies + writes turn matrix without calling LLM.
 * Live: add --app https://<host> or omit --offline to hit local netlify/functions/chat.js
 *
 *   node scripts/replay-simon-golden.mjs
 *   node scripts/replay-simon-golden.mjs --live --pace 20
 *   node scripts/replay-simon-golden.mjs --live --app https://shifted-ai.vercel.app --pace 25
 *   node scripts/replay-simon-golden.mjs --max 8
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { rejectReason, isMetaText, prepareCoachTurn } = require(path.join(root, "skills/coachReply.cjs"));

const GOLDEN = path.join(root, "docs/exports/ShiftED-Simon-Best-PreOct-Conversation.json");
const OUT_DIR = path.join(root, "docs/exports/simon-replay");
const LIVE = process.argv.includes("--live");
const appIdx = process.argv.indexOf("--app");
const appUrl = appIdx !== -1 ? process.argv[appIdx + 1]?.replace(/\/$/, "") : null;
const paceIdx = process.argv.indexOf("--pace");
const paceMs = paceIdx !== -1 ? Number(process.argv[paceIdx + 1]) * 1000 : LIVE ? 20_000 : 0;
const maxIdx = process.argv.indexOf("--max");
const maxTurns = maxIdx !== -1 ? Number(process.argv[maxIdx + 1]) : Infinity;

const FEELING_REASK =
  /\b(?:how (?:are|do|did|does) you feel\b|how (?:did|does) (?:that|this|it) (?:feel|make you feel)\b|what (?:emotion|feeling)s?\b|where (?:in your body|do you feel)\b|how did you feel about\b)/i;
const EARLY_GOAL =
  /\bshared goal\b|\bgoal when giving\b|\bfeedback goal\b|\btarget outcome\b|\bwhat would (?:a )?successful resolution\b|\bwhat(?:'s| is) (?:our |the )?(?:shared )?goal\b/i;
const INVENT =
  /\b(?:tim(?:'s)?\b|world mental health|performance evaluation|new manager)\b/i;

function pairTurns(messages) {
  const pairs = [];
  let pendingUser = null;
  for (const m of messages) {
    if (m.role === "user") {
      pendingUser = m;
    } else if (m.role === "assistant" && pendingUser) {
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

async function call(method, query, body) {
  if (appUrl) {
    const qs = query ? `?${new URLSearchParams(query)}` : "";
    const res = await fetch(`${appUrl}/api/chat${qs}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }
  const { handler } = require(path.join(root, "netlify/functions/chat.js"));
  const res = await handler({
    httpMethod: method,
    queryStringParameters: query,
    body: body ? JSON.stringify(body) : null,
  });
  return { status: res.statusCode, data: JSON.parse(res.body || "{}") };
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
      };
    }
    if (data.fallback) {
      return {
        ...(await call("POST", null, {
          ...payload,
          provider: "fallback",
          cancelJobId: jobId,
        })).data,
      };
    }
    if (data.status === "COMPLETED") {
      const captured = { ...(data.stateUpdate?.captured ?? {}), ...(phaseOne?.captured ?? {}) };
      return { ...data, phaseOne: phaseOne ? { captured, asking: phaseOne.asking } : null };
    }
    if (data.error && !data.retryable) return data;
  }
  return { error: "timed out" };
}

const raw = JSON.parse(fs.readFileSync(GOLDEN, "utf8"));
const pairs = pairTurns(raw.messages).slice(0, maxTurns);
fs.mkdirSync(OUT_DIR, { recursive: true });

const rows = [];
let feelingsKnown = false;
const history = [];
let phaseOneState = null;
let phaseOneStep = 1;

console.log(
  `Simon golden replay — ${pairs.length} user→assistant pairs — ${LIVE ? (appUrl || "local handler") : "offline July-only score"}\n`,
);

for (const [i, pair] of pairs.entries()) {
  const julyFlags = scoreReply(pair.july, { feelingsKnown });
  let current = null;
  let currentFlags = [];
  let turnMeta = null;

  if (LIVE) {
    if (i > 0 && paceMs) await new Promise((r) => setTimeout(r, paceMs));
    const result = await coachTurn({
      userMessage: pair.user,
      chatHistory: history,
      journeyContext: {
        platformPhase: 1,
        phaseOneStep,
        phaseOneConfirmed: false,
        presentingChallenge: history.length ? pairs[0].user : null,
        messageCount: history.length,
        phaseOneState,
      },
    });
    current = String(result.reply ?? result.error ?? "");
    currentFlags = scoreReply(current, { feelingsKnown });
    turnMeta = {
      provider: result.provider ?? null,
      asking: result.phaseOne?.asking ?? phaseOneState?.asking ?? null,
      error: result.error ?? null,
    };
    history.push({ role: "user", content: pair.user }, { role: "assistant", content: current });
    if (result.phaseOne) {
      phaseOneState = result.phaseOne;
    }
    if (result.phaseOne?.handshakeConfirmed) {
      phaseOneStep = 3;
    } else if (phaseOneState?.asking === "summary") {
      phaseOneStep = 3;
    } else if (phaseOneState?.asking) {
      phaseOneStep = 2;
    }
    turnMeta.protocolState = result.protocolState ?? null;
    turnMeta.asking = result.phaseOne?.asking ?? phaseOneState?.asking ?? null;
  } else {
    // Offline: still run prepareCoachTurn to see what the server would ask next.
    turnMeta = prepareCoachTurn({
      mode: "chat",
      userMessage: pair.user,
      history,
      journeyContext: {
        platformPhase: 1,
        phaseOneStep,
        phaseOneConfirmed: false,
        presentingChallenge: history.length ? pairs[0].user : null,
        messageCount: history.length,
        phaseOneState,
      },
    });
    history.push({ role: "user", content: pair.user }, { role: "assistant", content: pair.july });
    if (turnMeta.phaseOne) phaseOneState = turnMeta.phaseOne;
    if (phaseOneState?.asking === "summary") phaseOneStep = 3;
    else if (phaseOneState?.asking) phaseOneStep = 2;
  }

  if (/\b(feel|foggy|exhausted|guilt|crushing|heavy|paralyz)/i.test(pair.user)) feelingsKnown = true;
  if (phaseOneState?.captured?.coping) feelingsKnown = true;

  rows.push({
    n: i + 1,
    user: pair.user,
    july: pair.july,
    current,
    julyFlags,
    currentFlags,
    asking: turnMeta?.asking ?? turnMeta?.phaseOne?.asking ?? null,
    protocolState: turnMeta?.protocolState ?? null,
    feelingsKnown,
  });

  console.log(
    `#${i + 1} asking=${rows[i].asking ?? "-"} july[${julyFlags.join(",") || "ok"}]${
      LIVE ? ` now[${currentFlags.join(",") || "ok"}]` : ""
    }`,
  );
  console.log(`  user: ${pair.user.slice(0, 120).replace(/\s+/g, " ")}`);
  if (LIVE) console.log(`  now:  ${String(current).slice(0, 140).replace(/\s+/g, " ")}`);
  console.log("");
}

const summary = {
  exported_at: new Date().toISOString(),
  session_id: raw.session?.id,
  mode: LIVE ? "live" : "offline",
  app: appUrl || (LIVE ? "local" : null),
  pair_count: rows.length,
  july_flag_counts: rows.reduce((acc, r) => {
    for (const f of r.julyFlags) acc[f] = (acc[f] || 0) + 1;
    return acc;
  }, {}),
  current_flag_counts: LIVE
    ? rows.reduce((acc, r) => {
        for (const f of r.currentFlags) acc[f] = (acc[f] || 0) + 1;
        return acc;
      }, {})
    : null,
  acceptance: {
    no_feeling_reask_when_known: LIVE
      ? !rows.some((r) => r.feelingsKnown && r.currentFlags.includes("feeling_reask"))
      : null,
    no_early_goal: LIVE ? !rows.some((r) => r.currentFlags.includes("early_goal")) : null,
  },
  rows,
};

const jsonPath = path.join(OUT_DIR, LIVE ? "replay-live.json" : "replay-offline.json");
fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

const md = `# Simon golden replay — ${summary.mode}

Session \`${summary.session_id}\` · ${summary.pair_count} pairs · ${summary.exported_at}

## Flag counts (July baseline)
${Object.entries(summary.july_flag_counts)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n") || "- (none)"}

${
  LIVE
    ? `## Flag counts (current live)
${Object.entries(summary.current_flag_counts || {})
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n") || "- (none)"}

## Acceptance
- no feeling re-ask when known: ${summary.acceptance.no_feeling_reask_when_known}
- no early goal: ${summary.acceptance.no_early_goal}
`
    : "## Offline note\nRun with `--live` (and optional `--app`) once LLM keys / deployment are available to compare current replies.\n"
}

## Turns
${rows
  .map(
    (r) => `### Turn ${r.n} (asking=${r.asking ?? "-"}, feelingsKnown=${r.feelingsKnown})
**User:** ${r.user.slice(0, 280)}

**July:** ${r.july.slice(0, 280)}
_flags:_ ${r.julyFlags.join(", ") || "ok"}
${
  LIVE
    ? `
**Now:** ${String(r.current).slice(0, 280)}
_flags:_ ${r.currentFlags.join(", ") || "ok"}
`
    : ""
}`,
  )
  .join("\n")}
`;
const mdPath = path.join(OUT_DIR, LIVE ? "replay-live.md" : "replay-offline.md");
fs.writeFileSync(mdPath, md);
console.log(`Wrote ${jsonPath}\nWrote ${mdPath}`);
