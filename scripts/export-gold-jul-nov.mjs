#!/usr/bin/env node
/**
 * Export Jul–Nov gold turns for continued SFT / prompt QA.
 * Sources: admin_quality_star assistants + chat_feedback (global + rated).
 *
 *   node scripts/export-gold-jul-nov.mjs
 *   node scripts/export-gold-jul-nov.mjs --count-only
 *
 * Writes: data/sft/exports/gold_jul_nov.jsonl
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

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

const COUNT_ONLY = process.argv.includes("--count-only");
const OUT = path.join(root, "data/sft/exports/gold_jul_nov.jsonl");
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error("Need SUPABASE_URL / VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function sha1(s) {
  // lightweight stable key without crypto import ceremony
  let h = 0;
  const t = String(s || "");
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return `h${(h >>> 0).toString(16)}`;
}

async function fetchAll(table, select, filterFn) {
  const page = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    let q = supabase.from(table).select(select).range(from, from + page - 1);
    if (filterFn) q = filterFn(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < page) break;
    from += page;
  }
  return rows;
}

async function main() {
  const starred = await fetchAll(
    "chat_messages",
    "id,session_id,role,content,created_at,admin_quality_star,admin_starred_at",
    (q) => q.eq("admin_quality_star", true).eq("role", "assistant").order("admin_starred_at", { ascending: false }),
  );

  const feedback = await fetchAll(
    "chat_feedback",
    "id,conversation_id,message_id,feedback_text,rating,tags,created_at,apply_to_global_instructions",
    (q) => q.order("created_at", { ascending: false }),
  );

  // Prior user message for each starred assistant (same conversation, earlier).
  const gold = [];
  const seen = new Set();

  for (const row of starred) {
    const content = String(row.content || "").trim();
    if (!content) continue;
    const keyId = `star:${row.id}`;
    if (seen.has(keyId)) continue;
    seen.add(keyId);

    let priorUser = "";
    if (row.session_id) {
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("role,content,created_at")
        .eq("session_id", row.session_id)
        .lt("created_at", row.created_at)
        .order("created_at", { ascending: false })
        .limit(6);
      const u = (msgs || []).find((m) => m.role === "user");
      priorUser = String(u?.content || "").trim();
    }

    gold.push({
      export_type: "gold_starred",
      source: "supabase.chat_messages.admin_quality_star",
      message_id: row.id,
      session_id: row.session_id,
      created_at: row.created_at,
      messages: [
        ...(priorUser ? [{ role: "user", content: priorUser }] : []),
        { role: "assistant", content },
      ],
    });
  }

  for (const fb of feedback) {
    const text = String(fb.feedback_text || "").trim();
    if (!text) continue;
    // Keep global standards + any rated row (Simon quality signal).
    if (fb.apply_to_global_instructions === false && !(typeof fb.rating === "number" && fb.rating >= 4)) {
      continue;
    }
    const keyId = `fb:${fb.id}`;
    if (seen.has(keyId)) continue;
    seen.add(keyId);

    let assistant = "";
    let priorUser = "";
    if (fb.message_id) {
      const { data: msg } = await supabase
        .from("chat_messages")
        .select("id,role,content,session_id,created_at")
        .eq("id", fb.message_id)
        .maybeSingle();
      if (msg?.role === "assistant") {
        assistant = String(msg.content || "").trim();
        const { data: prev } = await supabase
          .from("chat_messages")
          .select("role,content,created_at")
          .eq("session_id", msg.session_id)
          .lt("created_at", msg.created_at)
          .order("created_at", { ascending: false })
          .limit(6);
        priorUser = String((prev || []).find((m) => m.role === "user")?.content || "").trim();
      }
    }

    gold.push({
      export_type: "gold_feedback",
      source: "supabase.chat_feedback",
      feedback_id: fb.id,
      rating: fb.rating ?? null,
      apply_to_global_instructions: fb.apply_to_global_instructions !== false,
      created_at: fb.created_at,
      trainer_note: text,
      messages: assistant
        ? [
            ...(priorUser ? [{ role: "user", content: priorUser }] : []),
            { role: "assistant", content: assistant },
          ]
        : [{ role: "system", content: `Trainer standard: ${text}` }],
      content_hash: sha1(text + "|" + assistant),
    });
  }

  console.log(
    JSON.stringify(
      {
        starred: starred.length,
        feedback_rows: feedback.length,
        gold_lines: gold.length,
        out: OUT,
      },
      null,
      2,
    ),
  );

  if (COUNT_ONLY) return;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, gold.map((g) => JSON.stringify(g)).join("\n") + (gold.length ? "\n" : ""));
  console.log(`Wrote ${gold.length} lines → ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
