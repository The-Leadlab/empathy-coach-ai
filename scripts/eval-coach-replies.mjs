#!/usr/bin/env node
/**
 * Plays a ~10-turn Phase One intake against the coach and flags replies that leak reasoning,
 * talk about "the user", or (on intake turns) don't ask a question.
 *
 *   LLM_API_KEY=… VLLM_API_URL=https://api.runpod.ai/v2/dwmwweatrhzys4/openai/v1/chat/completions \
 *     node scripts/eval-coach-replies.mjs            # runs netlify/functions/chat.js locally
 *   node scripts/eval-coach-replies.mjs --app https://<deployment>   # hits the deployed /api/chat
 *   Add --pace 25 to wait 25s between turns (avoids Groq free-tier rate limits).
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { rejectReason, isMetaText } = require(path.join(root, "skills/coachReply.cjs"));

const USER_TURNS = [
  "I keep clashing with my manager. In Monday's team meeting she cut me off twice while I was presenting the quarterly numbers.",
  "Right before it, she said 'let's not get into the weeds' in front of everyone.",
  "I think if I don't get everything exactly right, then people will stop taking me seriously.",
  "Deep down I'm scared I'm just not good enough for this role.",
  "Honestly about 85.",
  "My chest gets tight, I go quiet and then I replay it all evening.",
  "Yes, that's pretty much it.",
  "I guess I'd like to be able to speak up calmly when it happens.",
  "Maybe by the next team meeting in two weeks.",
  "I could practise one sentence I'd say if she interrupts me again.",
];

const appIdx = process.argv.indexOf("--app");
const appUrl = appIdx !== -1 ? process.argv[appIdx + 1]?.replace(/\/$/, "") : null;
// Seconds between turns; Groq's free tier allows ~3 coach requests per minute.
const paceIdx = process.argv.indexOf("--pace");
const paceMs = paceIdx !== -1 ? Number(process.argv[paceIdx + 1]) * 1000 : 0;

/** Calls /api/chat either over HTTP or via the local Netlify handler. Returns {status, data}. */
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
  const res = await handler({ httpMethod: method, queryStringParameters: query, body: body ? JSON.stringify(body) : null });
  return { status: res.statusCode, data: JSON.parse(res.body || "{}") };
}

function guardQuery(guard, attempt) {
  const q = { attempt: String(attempt) };
  if (guard?.jsonMode) q.json = "1";
  if (guard?.phaseOne) q.intake = "1";
  if (guard?.element) q.el = guard.element;
  if (guard?.crisis) q.crisis = "1";
  return q;
}

/** Mirrors src/lib/fetchChatReply.ts: async submit + poll, one regenerate, then fallback. */
async function coachTurn(payload) {
  const first = await call("POST", null, payload);
  if (first.status !== 202) return { ...first.data, httpStatus: first.status };
  const { jobId, guard, phaseOne } = first.data;
  const attempt = payload.guardAttempt ?? 1;
  const started = Date.now();
  while (Date.now() - started < 300_000) {
    await new Promise((r) => setTimeout(r, 4000));
    const { data } = await call("GET", { jobId, waitedMs: String(Date.now() - started), ...guardQuery(guard, attempt) });
    if (data.regenerate) return coachTurn({ ...payload, guardAttempt: 2 });
    if (data.guardRejected) return { ...(await call("POST", null, { ...payload, provider: "fallback", guardRejected: true })).data };
    if (data.fallback) return { ...(await call("POST", null, { ...payload, provider: "fallback", cancelJobId: jobId })).data };
    if (data.status === "COMPLETED") {
      const captured = { ...(data.stateUpdate?.captured ?? {}), ...(phaseOne?.captured ?? {}) };
      return { ...data, phaseOne: phaseOne ? { captured, asking: phaseOne.asking } : null };
    }
    if (data.error && !data.retryable) return data;
  }
  return { error: "timed out" };
}

const history = [];
let phaseOneState = null;
let phaseOneStep = 1;
let failures = 0;

console.log(`Coach reply eval — ${appUrl ? `app ${appUrl}` : "local handler"}\n`);
for (const [i, userMessage] of USER_TURNS.entries()) {
  if (i > 0 && paceMs) await new Promise((r) => setTimeout(r, paceMs));
  const intake = phaseOneStep < 3;
  const result = await coachTurn({
    userMessage,
    chatHistory: history,
    journeyContext: {
      platformPhase: 1,
      phaseOneStep,
      phaseOneConfirmed: false,
      presentingChallenge: history.length ? USER_TURNS[0] : null,
      messageCount: history.length,
      phaseOneState,
    },
  });
  const reply = String(result.reply ?? "");
  const reason = result.error
    ? `error: ${result.error}`
    : rejectReason(reply, { phaseOne: intake, element: phaseOneState?.asking }) ||
      (isMetaText(reply, { phaseOne: intake }) ? "meta" : null);
  if (reason) failures += 1;
  console.log(`#${i + 1} [${result.provider ?? "?"}] asking=${phaseOneState?.asking ?? "-"} ${reason ? `FAIL (${reason})` : "ok"}`);
  console.log(`  user:  ${userMessage}`);
  console.log(`  coach: ${reply.replace(/\s+/g, " ")}\n`);
  history.push({ role: "user", content: userMessage }, { role: "assistant", content: reply });
  if (result.phaseOne) phaseOneState = result.phaseOne;
  if (phaseOneState?.asking === "summary") phaseOneStep = 2;
  if (/that's pretty much it/i.test(userMessage)) phaseOneStep = 3;
}

console.log(`${USER_TURNS.length - failures}/${USER_TURNS.length} replies clean.`);
process.exit(failures ? 1 : 0);
