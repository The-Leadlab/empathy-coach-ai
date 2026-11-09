#!/usr/bin/env node
/**
 * Apply supabase/manual/repair_missing_schema.sql to ShiftED project via PostgREST SQL
 * is not available; uses Supabase Management API Database query when credentials exist.
 *
 * Required env:
 *   VITE_SUPABASE_URL=https://wxxwxvauseqftyorhkkp.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * The repair file ends with a diagnostic SELECT; we strip that and run DDL via
 * the Postgres REST is unavailable for arbitrary SQL from JS client.
 *
 * Practical path: print instructions + exit 2 if keys missing; if
 * SUPABASE_DB_URL is set, use `psql` when available.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SQL_PATH = path.join(ROOT, "supabase/manual/repair_missing_schema.sql");

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";

if (!fs.existsSync(SQL_PATH)) {
  console.error("Missing", SQL_PATH);
  process.exit(1);
}

const fullSql = fs.readFileSync(SQL_PATH, "utf8");
// Drop trailing diagnostic SELECT (informational only in SQL Editor)
const ddl = fullSql.replace(/\n-- Check:[\s\S]*$/m, "\n").trim() + "\n";

if (dbUrl) {
  const psql = spawnSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-c", ddl], {
    encoding: "utf8",
  });
  if (psql.error) {
    console.error("psql not available:", psql.error.message);
    process.exit(1);
  }
  if (psql.status !== 0) {
    console.error(psql.stderr || psql.stdout);
    process.exit(psql.status || 1);
  }
  console.log("OK — repair applied via SUPABASE_DB_URL");
  process.exit(0);
}

console.log(`BLOCKED: cannot apply repair automatically.
Project expected: wxxwxvauseqftyorhkkp (${url || "set VITE_SUPABASE_URL"})

Do this once:
1. Open https://supabase.com/dashboard/project/wxxwxvauseqftyorhkkp/sql/new
2. Paste contents of supabase/manual/repair_missing_schema.sql
3. Run, then verify tables: profiles, survey_results, and function set_chat_message_admin_star

Or set SUPABASE_DB_URL (postgres connection string) and re-run:
  node scripts/apply-supabase-repair.mjs
`);
process.exit(2);
