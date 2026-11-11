/**
 * Export training JSONL from Supabase:
 * - Simon's trainer feedback (chat_feedback)
 * - Final / selected assistant replies (active branch, starred, or feedback-reviewed variant)
 *
 * System prompt matches live /api/chat: coach prompt + LLM phases + skills + journey + trainer + stars.
 * See docs/SUPER-PROMPT-TRAINING-FULL-STACK.md
 *
 * Usage (CMD):
 *   set VITE_SUPABASE_URL=https://wxxwxvauseqftyorhkkp.supabase.co
 *   set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
 *   node scripts/export-training-simon-feedback.js --count-only
 *   node scripts/export-training-simon-feedback.js --mode=turns
 *
 * Modes: turns (default, one line per assistant reply), sessions (full chats), all (both).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const require = createRequire(import.meta.url);

/** Load gitignored .env / .env.local (same as build:simon-rules). */
function loadEnvFiles() {
  for (const name of [".env", ".env.local"]) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  }
}
loadEnvFiles();

const { buildProductionSystemPrompt, sessionRowToJourneyContext } = require("../skills/buildProductionSystemPrompt.cjs");
const {
  resolveLatestRegeneratedAssistant,
  buildTrainingBranchMessages,
} = require("../skills/messageVariants.cjs");
const {
  extractExactTargetFromText,
  formatTrainerRuleForPrompt,
} = require("../skills/regenerationHelpers.cjs");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const TRAINER_EMAIL = (process.env.TRAINER_EMAIL || "simon@admin.com").toLowerCase();
const COUNT_ONLY = process.argv.includes("--count-only");
const EXPORT_MODE = parseExportMode(process.argv);
const TRAINER_FEEDBACK_LIMIT = 25;
const STARRED_EXEMPLAR_LIMIT = 8;

/** turns = one JSONL line per assistant reply (recommended). sessions = one line per full chat. all = both. */
function parseExportMode(argv) {
  const flag = argv.find((a) => a.startsWith("--mode="));
  const mode = flag ? flag.split("=")[1] : "turns";
  if (!["turns", "sessions", "all"].includes(mode)) {
    console.error(`Invalid --mode=${mode}. Use turns, sessions, or all.`);
    process.exit(1);
  }
  return mode;
}

const SESSION_JOURNEY_SELECT =
  "id, active_message_id, platform_phase, phase_one_step, phase_one_confirmed, presenting_challenge, belief_strength_pct, conceptualisation_summary, target_outcome, active_micro_goal, micro_goal_confidence, sustainability_pivot_active, architectural_backtrack_active";

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const trainerUserId = await resolveTrainerUserId(supabase);
  if (!trainerUserId) {
    console.error(`Could not find trainer user for email: ${TRAINER_EMAIL}`);
    process.exit(1);
  }
  console.log(`Trainer: ${TRAINER_EMAIL} (${trainerUserId})`);

  const [trainerRules, exemplars] = await Promise.all([
    fetchTrainerGlobalInstructions(supabase),
    fetchStarredAssistantExemplars(supabase),
  ]);
  console.log(`Global trainer bullets: ${trainerRules ? trainerRules.split("\n").length : 0}`);
  console.log(`Starred exemplars:        ${exemplars ? exemplars.split("\n").filter(Boolean).length : 0}`);

  const { data: sessions, error: sessErr } = await supabase.from("chat_sessions").select(SESSION_JOURNEY_SELECT);
  if (sessErr) throw sessErr;

  const { data: allMessages, error: msgErr } = await supabase
    .from("chat_messages")
    .select(
      "id, session_id, role, content, created_at, parent_message_id, regenerated_from_message_id, branch_root_message_id, admin_quality_star",
    )
    .order("created_at", { ascending: true });
  if (msgErr) throw msgErr;

  const { data: allFeedback, error: fbErr } = await supabase
    .from("chat_feedback")
    .select(
      "id, conversation_id, message_id, admin_user_id, feedback_text, rating, tags, apply_to_global_instructions, created_at",
    )
    .eq("admin_user_id", trainerUserId)
    .order("created_at", { ascending: true });
  if (fbErr) throw fbErr;

  const messageById = {};
  for (const m of allMessages || []) messageById[m.id] = m;

  const feedbackByMessageId = {};
  for (const fb of allFeedback || []) {
    if (!feedbackByMessageId[fb.message_id]) feedbackByMessageId[fb.message_id] = [];
    feedbackByMessageId[fb.message_id].push(fb);
  }

  const messagesBySession = {};
  for (const m of allMessages || []) {
    if (!messagesBySession[m.session_id]) messagesBySession[m.session_id] = [];
    messagesBySession[m.session_id].push(m);
  }

  const starredAssistantIds = new Set(
    (allMessages || []).filter((m) => m.role === "assistant" && m.admin_quality_star).map((m) => m.id),
  );

  const sessionIdsWithSimonFeedback = new Set((allFeedback || []).map((f) => f.conversation_id));
  const sessionIdsWithStar = new Set(
    (allMessages || []).filter((m) => m.admin_quality_star && m.role === "assistant").map((m) => m.session_id),
  );

  const sessionById = {};
  for (const s of sessions || []) sessionById[s.id] = s;

  const sessionLines = [];
  const sessionTurnLines = [];
  let sessionTurnCount = 0;
  const seenTurnKeys = new Set();

  for (const session of sessions || []) {
    const qualifies =
      sessionIdsWithSimonFeedback.has(session.id) || sessionIdsWithStar.has(session.id);
    if (!qualifies) continue;

    const raw = messagesBySession[session.id] || [];
    if (raw.length < 2) continue;

    const display = buildTrainingBranchMessages(
      raw,
      session.active_message_id,
      feedbackByMessageId,
      starredAssistantIds,
    );
    const trainerNotes = collectTrainerNotesForSession(raw, feedbackByMessageId);

    const systemContent = buildExportSystemPrompt({
      sessionRow: sessionById[session.id],
      rawMessages: raw,
      trainerNotes,
      trainerRules,
      exemplars,
    });
    const messagesArr = [{ role: "system", content: systemContent }];
    const dialogue = [];

    for (const m of display) {
      if (m.role !== "user" && m.role !== "assistant") continue;
      dialogue.push(m);
      messagesArr.push({ role: m.role, content: m.content || "" });
      if (m.role === "assistant") sessionTurnCount++;
    }

    if (messagesArr.length >= 3) {
      sessionLines.push(
        JSON.stringify({
          messages: messagesArr,
          _export_type: "session",
          _session_id: session.id,
        }),
      );
    }

    for (const turnLine of expandSessionToTurnLines({
      session,
      sessionRow: sessionById[session.id],
      dialogue,
      trainerNotes,
      trainerRules,
      exemplars,
      rawMessages: raw,
      feedbackByMessageId,
      starredAssistantIds,
    })) {
      const key = turnLine._dedupe_key;
      if (seenTurnKeys.has(key)) continue;
      seenTurnKeys.add(key);
      sessionTurnLines.push(JSON.stringify(turnLine.payload));
    }
  }

  const turnLines = [];

  for (const fb of allFeedback || []) {
    const built = buildTurnFromFeedback(
      fb,
      messageById,
      messagesBySession,
      sessionById,
      trainerRules,
      exemplars,
      allMessages,
    );
    if (!built) continue;
    const key = built.payload._dedupe_key;
    if (seenTurnKeys.has(key)) continue;
    seenTurnKeys.add(key);
    turnLines.push(JSON.stringify(built.payload));
  }

  for (const starId of starredAssistantIds) {
    const built = buildTurnFromStarred(starId, messageById, messagesBySession, sessionById, trainerRules, exemplars);
    if (!built) continue;
    const key = built.payload._dedupe_key;
    if (seenTurnKeys.has(key)) continue;
    seenTurnKeys.add(key);
    turnLines.push(JSON.stringify(built.payload));
  }

  const allLines = [];
  if (EXPORT_MODE === "sessions" || EXPORT_MODE === "all") allLines.push(...sessionLines);
  if (EXPORT_MODE === "turns" || EXPORT_MODE === "all") {
    allLines.push(...sessionTurnLines, ...turnLines);
  }

  const typeCounts = {};
  let assistantTargets = 0;
  for (const line of allLines) {
    const obj = JSON.parse(line);
    const t = obj._export_type || "unknown";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
    assistantTargets += (obj.messages || []).filter((m) => m.role === "assistant").length;
  }

  console.log("\n--- Dataset summary ---");
  console.log(`Export mode:                      ${EXPORT_MODE}`);
  console.log(`Sessions total:                   ${(sessions || []).length}`);
  console.log(`Sessions with Simon feedback:     ${sessionIdsWithSimonFeedback.size}`);
  console.log(`Sessions with starred replies:    ${sessionIdsWithStar.size}`);
  console.log(`Simon feedback rows:              ${(allFeedback || []).length}`);
  console.log(`Starred assistant messages:       ${starredAssistantIds.size}`);
  console.log(`Full-session training examples:   ${sessionLines.length}`);
  console.log(`Per-turn from sessions:           ${sessionTurnLines.length}`);
  console.log(`Feedback / starred turn examples: ${turnLines.length}`);
  console.log(`Total JSONL lines for training:   ${allLines.length}`);
  console.log(`By export type:                   ${JSON.stringify(typeCounts)}`);
  console.log(`Assistant targets in export:      ${assistantTargets}`);
  console.log(`Assistant turns (session branch): ${sessionTurnCount}`);
  console.log(
    "\nNote: JSONL is one JSON object per line (looks compact in editors). Each line can hold a full multi-turn chat.",
  );

  if (allLines.length < 50) {
    console.warn("\nFewer than 50 total examples — fine-tune may be weak. Add more Simon reviews or stars.");
  } else {
    console.log("\nEnough examples to start LoRA fine-tune.");
  }

  if (COUNT_ONLY) return;

  const outPath = path.join(__dirname, "..", "train_simon_feedback.jsonl");
  const summaryPath = path.join(__dirname, "..", "train_simon_feedback.summary.json");
  fs.writeFileSync(outPath, allLines.join("\n") + (allLines.length ? "\n" : ""), "utf8");
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        export_mode: EXPORT_MODE,
        total_lines: allLines.length,
        by_export_type: typeCounts,
        assistant_targets: assistantTargets,
        session_branch_turns: sessionTurnCount,
        note: "JSONL = one training example per line. Use train_simon_feedback.summary.json to inspect counts.",
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\nWrote ${allLines.length} lines → ${outPath}`);
  console.log(`Summary → ${summaryPath}`);
  console.log("Copy for RunPod: copy train_simon_feedback.jsonl train.jsonl");
}

function expandSessionToTurnLines({
  session,
  sessionRow,
  dialogue,
  trainerNotes,
  trainerRules,
  exemplars,
  rawMessages,
  feedbackByMessageId,
  starredAssistantIds,
}) {
  const lines = [];
  const prior = [];

  for (const m of dialogue) {
    if (m.role === "user") {
      prior.push({ id: m.id, role: "user", content: (m.content || "").trim() });
      continue;
    }
    if (m.role !== "assistant" || !(m.content || "").trim()) continue;
    if (feedbackByMessageId[m.id]?.length || starredAssistantIds.has(m.id)) continue;

    const userTurn = prior.length && prior[prior.length - 1].role === "user" ? prior[prior.length - 1] : null;
    if (!userTurn) continue;

    const messageCount = countDialogueMessagesBefore(rawMessages, userTurn.id);
    const sessionTrainerNotes = trainerNotes.length ? trainerNotes.map((n) => `- ${n}`).join("\n") : "";
    const systemContent = buildProductionSystemPrompt({
      trainerRules,
      sessionTrainerNotes,
      exemplars,
      journeyContext: sessionRowToJourneyContext(sessionRow, messageCount),
    });

    const context = prior.slice(0, -1).slice(-6).map(({ role, content }) => ({ role, content }));
    const payload = {
      messages: [
        { role: "system", content: systemContent },
        ...context,
        { role: "user", content: userTurn.content },
        { role: "assistant", content: (m.content || "").trim() },
      ],
      _export_type: "session_turn",
      _session_id: session.id,
      _message_id: m.id,
      _dedupe_key: `msg:${m.id}`,
    };

    lines.push({ _dedupe_key: payload._dedupe_key, payload });
    prior.push({ id: m.id, role: "assistant", content: (m.content || "").trim() });
  }

  return lines;
}

function buildTurnFromFeedback(fb, messageById, messagesBySession, sessionById, trainerRules, exemplars, allMessages) {
  const originalAssistant = messageById[fb.message_id];
  if (!originalAssistant || originalAssistant.role !== "assistant") return null;

  const assistant = resolveLatestRegeneratedAssistant(originalAssistant, allMessages || Object.values(messageById));
  const user = assistant.parent_message_id ? messageById[assistant.parent_message_id] : null;
  if (!user || user.role !== "user" || !(user.content || "").trim()) return null;
  if (!(assistant.content || "").trim()) return null;

  const feedbackText = (fb.feedback_text || "").trim();
  // Prefer Simon's exact pasted reply as the assistant label (parity with feedback-exact).
  const exactTarget = extractExactTargetFromText(feedbackText);
  const assistantContent = (exactTarget || assistant.content || "").trim();
  if (!assistantContent) return null;

  const raw = messagesBySession[assistant.session_id] || [];
  const messageCount = countDialogueMessagesBefore(raw, user.id);

  // Exact pastes stay out of turnFeedback / global rules — they are the label.
  const turnFeedback = exactTarget ? undefined : feedbackText || undefined;

  const systemContent = buildProductionSystemPrompt({
    trainerRules,
    exemplars,
    journeyContext: sessionRowToJourneyContext(sessionById[assistant.session_id], messageCount),
    turnFeedback,
  });

  const prior = buildPriorContext(assistant.session_id, user.id, messagesBySession, messageById);
  const messages = [
    { role: "system", content: systemContent },
    ...prior,
    { role: "user", content: user.content.trim() },
    { role: "assistant", content: assistantContent },
  ];

  const exportType = exactTarget
    ? "exact_target_turn"
    : assistant.id !== originalAssistant.id
      ? "regeneration_turn"
      : "feedback_turn";

  return {
    payload: {
      messages,
      _export_type: exportType,
      _feedback_id: fb.id,
      _message_id: assistant.id,
      _source_message_id: originalAssistant.id,
      _exact_target: !!exactTarget,
      _dedupe_key: `msg:${assistant.id}:fb:${fb.id}`,
    },
  };
}

function buildTurnFromStarred(starId, messageById, messagesBySession, sessionById, trainerRules, exemplars) {
  const assistant = messageById[starId];
  if (!assistant || assistant.role !== "assistant") return null;

  const user = assistant.parent_message_id ? messageById[assistant.parent_message_id] : null;
  if (!user || user.role !== "user" || !(user.content || "").trim()) return null;

  const raw = messagesBySession[assistant.session_id] || [];
  const messageCount = countDialogueMessagesBefore(raw, user.id);

  const systemContent = buildProductionSystemPrompt({
    trainerRules,
    exemplars,
    journeyContext: sessionRowToJourneyContext(sessionById[assistant.session_id], messageCount),
  });

  const prior = buildPriorContext(assistant.session_id, user.id, messagesBySession, messageById);
  const messages = [
    { role: "system", content: systemContent },
    ...prior,
    { role: "user", content: user.content.trim() },
    { role: "assistant", content: (assistant.content || "").trim() },
  ];

  return {
    payload: {
      messages,
      _export_type: "starred_turn",
      _message_id: assistant.id,
      _dedupe_key: `msg:${starId}`,
    },
  };
}

function buildPriorContext(sessionId, beforeUserId, messagesBySession, messageById) {
  const raw = messagesBySession[sessionId] || [];
  const prior = [];
  for (const m of raw) {
    if (m.id === beforeUserId) break;
    if (m.role === "user" || m.role === "assistant") {
      if ((m.content || "").trim()) prior.push({ role: m.role, content: m.content.trim() });
    }
  }
  return prior.slice(-6);
}

function collectTrainerNotesForSession(allMessages, feedbackByMessageId) {
  const notes = [];
  for (const m of allMessages) {
    if (m.role !== "assistant") continue;
    for (const fb of feedbackByMessageId[m.id] || []) {
      if (fb.feedback_text?.trim()) notes.push(fb.feedback_text.trim());
    }
  }
  return [...new Set(notes)];
}

function buildExportSystemPrompt({ sessionRow, rawMessages, trainerNotes, trainerRules, exemplars }) {
  const messageCount = (rawMessages || []).filter((m) => m.role === "user" || m.role === "assistant").length;
  const sessionTrainerNotes = trainerNotes.length ? trainerNotes.map((n) => `- ${n}`).join("\n") : "";

  return buildProductionSystemPrompt({
    trainerRules,
    sessionTrainerNotes,
    exemplars,
    journeyContext: sessionRowToJourneyContext(sessionRow, messageCount),
  });
}

function countDialogueMessagesBefore(rawMessages, beforeMessageId) {
  let count = 0;
  for (const m of rawMessages || []) {
    if (m.id === beforeMessageId) break;
    if (m.role === "user" || m.role === "assistant") count++;
  }
  return count;
}

async function fetchTrainerGlobalInstructions(supabase) {
  const { data: rows, error } = await supabase
    .from("chat_feedback")
    .select("feedback_text, apply_to_global_instructions, created_at")
    .order("created_at", { ascending: false })
    .limit(TRAINER_FEEDBACK_LIMIT);
  if (error) throw error;

  const seen = new Set();
  const lines = [];
  for (const r of rows || []) {
    if (r.apply_to_global_instructions === false) continue;
    const text = (r.feedback_text || "").trim();
    if (!text || seen.has(text)) continue;
    const bullet = formatTrainerRuleForPrompt(text, 180);
    if (!bullet) continue;
    seen.add(text);
    lines.push(bullet);
  }
  return lines.join("\n");
}

async function fetchStarredAssistantExemplars(supabase) {
  const { data: rows, error } = await supabase
    .from("chat_messages")
    .select("content, admin_starred_at")
    .eq("admin_quality_star", true)
    .eq("role", "assistant")
    .order("admin_starred_at", { ascending: false })
    .limit(STARRED_EXEMPLAR_LIMIT);
  if (error) throw error;

  const truncate = (s, max = 480) => {
    const t = String(s || "")
      .trim()
      .replace(/\s+/g, " ");
    if (t.length <= max) return t;
    return `${t.slice(0, max)}…`;
  };

  return (rows || [])
    .map((r, i) => (typeof r.content === "string" && r.content.trim() ? `${i + 1}. ${truncate(r.content)}` : ""))
    .filter(Boolean)
    .join("\n");
}

async function resolveTrainerUserId(supabase) {
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = (data.users || []).find((u) => (u.email || "").toLowerCase() === TRAINER_EMAIL);
    if (match) return match.id;
    if ((data.users || []).length < perPage) break;
    page++;
  }
  return null;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
