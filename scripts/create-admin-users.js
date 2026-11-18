/**
 * Create/update admin users in Supabase Auth with confirmed emails.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-admin-users.js
 *
 * Optional:
 *   ADMIN_USERS_JSON='[{"email":"a@admin.com","password":"secret"}]'
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

function parseAdminUsers() {
  const raw = process.env.ADMIN_USERS_JSON;
  if (!raw) {
    throw new Error(
      "ADMIN_USERS_JSON is required. Provide an array like " +
      '[{"email":"admin@example.com","password":"<strong-password>"}]',
    );
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some((u) => !u?.email || !u?.password)) {
      throw new Error("ADMIN_USERS_JSON must be an array of { email, password }");
    }
    return parsed;
  } catch (error) {
    throw new Error(`Invalid ADMIN_USERS_JSON: ${error.message}`);
  }
}

async function listAllUsers(adminApi) {
  const all = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await adminApi.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users ?? [];
    all.push(...users);

    if (users.length < perPage) break;
    page += 1;
  }

  return all;
}

async function upsertAdminUser(adminApi, email, password) {
  const users = await listAllUsers(adminApi);
  const existing = users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());

  if (existing) {
    const { error } = await adminApi.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { app_role: "admin" },
    });
    if (error) throw error;
    return { action: "updated", id: existing.id };
  }

  const { data, error } = await adminApi.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { app_role: "admin" },
  });
  if (error) throw error;

  return { action: "created", id: data?.user?.id || "unknown" };
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Missing env vars: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const adminUsers = parseAdminUsers();
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  console.log(`Processing ${adminUsers.length} admin user(s)...`);
  for (const user of adminUsers) {
    const result = await upsertAdminUser(supabase.auth.admin, user.email, user.password);
    if (result.id && result.id !== "unknown") {
      const { error: roleErr } = await supabase.from("user_roles").upsert(
        { user_id: result.id, role: "admin" },
        { onConflict: "user_id,role" },
      );
      if (roleErr) {
        // Fallback if unique constraint name differs — try plain insert ignore
        const { error: insErr } = await supabase
          .from("user_roles")
          .insert({ user_id: result.id, role: "admin" });
        if (insErr && !/duplicate|unique/i.test(insErr.message || "")) {
          console.warn(`user_roles warn for ${user.email}: ${roleErr.message || insErr.message}`);
        }
      }
    }
    console.log(`${result.action.toUpperCase()}: ${user.email} (${result.id})`);
  }
  console.log("Done.");
}

main().catch((error) => {
  console.error("Failed to create/update admin users:", error.message || error);
  process.exit(1);
});
