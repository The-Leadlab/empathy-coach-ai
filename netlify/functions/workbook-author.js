/**
 * Admin-only workbook authoring endpoint.
 * Actions: outline | draft_section | rewrite_section | continue_section | chat | poll
 */
const { createClient } = require("@supabase/supabase-js");
const { runAuthorAction } = require("../../skills/workbookAuthorService.cjs");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status, body) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
    body: JSON.stringify(body),
  };
}

async function requireAdmin(authHeader) {
  const token = String(authHeader || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: "Missing authorization.", status: 401 };

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon) return { error: "Supabase is not configured.", status: 500 };

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) return { error: "Invalid session.", status: 401 };

  const adminClient = createClient(url, service || anon);
  const { data: roles, error: roleErr } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .limit(1);

  if (roleErr || !roles?.length) return { error: "Admin role required.", status: 403 };
  return { user: userData.user };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const auth = await requireAdmin(event.headers.authorization || event.headers.Authorization);
    if (auth.error) return json(auth.status, { error: auth.error });

    const body = JSON.parse(event.body || "{}");
    const result = await runAuthorAction(body);
    return json(200, { ok: true, ...result });
  } catch (err) {
    console.error("workbook-author:", err);
    return json(500, { error: err.message || "Workbook author failed." });
  }
};
