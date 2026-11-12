---
name: security-audit
description: Pre-launch security audit for this repo against the 7 ShiftED / Cursor security rules. Use when asked to audit, review launch readiness, check secrets/RLS/auth/rate-limits, or write docs/SECURITY-AUDIT.md.
---

# Pre-launch security audit

Run this as a **read-only** source audit. Do not probe production URLs, do not use live credentials, and do not print secret values. Quote `file:line` evidence. Write `docs/SECURITY-AUDIT.md` when the user wants a saved report.

Stack this skill expects: Vite SPA (`src/`), Netlify functions (`netlify/functions/`), Vercel adapters (`api/`), optional Express (`server/server.js`), Supabase (`supabase/migrations/`).

## Output

A markdown report with:

1. Header: repo, commit SHA, date, stack one-liner.
2. **ROTATE NOW** banner at the top only if a live private secret is in git (service_role JWT, `sk-` / `sk_live_` / `whsec_` / `LLM_API_KEY` value, private key). Do not print the value. Publishable/anon Supabase JWTs are public-by-design — note them, do not banner-rotate unless the user treats them as confidential.
3. A table with one row per check below: **PASS** / **FAIL** / **N/A**, severity, `path:line` evidence, notes.
4. Top findings (highest severity first).
5. Commands that were run.

Do not fix application code unless the user asks. Rules/skill/report-only PRs are expected.

## Checks

### 1. No secrets in the frontend bundle

```bash
# Client env reads — only VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, non-secret flags allowed
rg -n "import\\.meta\\.env\\.(VITE_|NEXT_PUBLIC_)|process\\.env\\.(VITE_|NEXT_PUBLIC_)" src public --glob '!*.test.*'

# Private names must not appear in client code
rg -n "SERVICE_ROLE|LLM_API_KEY|GROQ_API_KEY|OPENAI_API_KEY|FALLBACK_LLM|sk_live_|sk_test_|whsec_|VITE_ADMIN_.*PASSWORD" src public

# Built bundle (if dist/ exists)
rg -n "sk-[A-Za-z0-9]{20,}|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+" dist 2>/dev/null || true
```

FAIL if a secret-capable name is read via `VITE_` / `NEXT_PUBLIC_`, or if a private key value appears under `src/` or `dist/`.

### 2. Database RLS on by default

```bash
rg -n "create table|CREATE TABLE" supabase/migrations docs --glob '*.sql'
rg -n "enable row level security|ENABLE ROW LEVEL SECURITY" supabase/migrations docs --glob '*.sql'
rg -n "create policy|CREATE POLICY|USING \\(true\\)|WITH CHECK \\(true\\)" supabase/migrations --glob '*.sql'
```

For each `create table public.X`, require a matching `enable row level security` in the same or a later migration. FAIL if a policy is `USING (true)` for SELECT/INSERT/UPDATE/DELETE on user data, or if a catalog SELECT applies to `anon` without `TO authenticated`.

List tables in `src/integrations/supabase/types.ts` (`public.Tables`) and confirm each has an enable + owner/admin policy.

Cannot see live Advisor from source — say **needs validation** for hosted RLS drift.

### 3. Server-side auth and authorization

```bash
rg -n "exports\\.handler|app\\.(get|post|put|delete)|requireAdmin|auth\\.getUser|Authorization" netlify/functions api server/server.js
rg -n "RequireAuth|RequireAdmin|/adminchat" src/App.tsx src/components/auth
rg -n "NAMED_TRAINER_ADMINS|isNamedTrainerAdmin|@admin\\.com" src netlify/functions server
rg -n "fetch\\(\"/api/" src --glob '!*.test.*'
```

PASS only if every `/api/*` handler and the Express clones verify a Supabase JWT, and admin routes/pages also check `user_roles`. FAIL if chat/translate/transcribe omit auth, if `/adminchat` is outside `RequireAdmin`, or if an email allowlist skips the role query.

### 4. Rate limiting

```bash
rg -n "rateLimit|rate-limit|RATE_LIMIT|upstash|lru" netlify/functions api server src --glob '!*.test.*'
```

FAIL if `/api/chat`, `/api/transcribe`, `/api/translate`, `/api/workbook-author`, or auth endpoints have no limiter. Note oversized `express.json({ limit })` as FAIL/warn.

### 5. Validation, XSS, CSRF, injection

```bash
rg -n "from [\"']zod[\"']|z\\.object" netlify/functions api server src --glob '!*.test.*'
rg -n "dangerouslySetInnerHTML|innerHTML|eval\\(|document\\.write" src --glob '!*.test.*'
rg -n "Access-Control-Allow-Origin|app\\.use\\(cors" netlify/functions server
rg -n "\\$\\{|query\\(`|execute\\(.*\\+" supabase server scripts --glob '*.{js,sql,cjs}'
```

FAIL if LLM/admin bodies are hand-rolled `typeof` only (zod is already in `package.json`). FAIL on open CORS for authenticated/LLM routes. Parameterized Supabase client calls PASS for injection.

### 6. Secrets not committed

```bash
git ls-files | rg '\\.env($|\\.)' || true
git log --all --pretty=format:'%h %s' -- '.env' '**/.env' '*.pem'
rg -n --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!package-lock.json' \
  -e 'sk-[A-Za-z0-9]{10,}' -e 'sk_live_' -e 'whsec_' -e 'BEGIN (RSA |OPENSSH )?PRIVATE KEY' \
  -e 'SERVICE_ROLE_KEY\\s*[:=]\\s*["'\'']eyJ'
# Optional if installed
gitleaks detect --no-git -v || true
```

Redact values when inspecting historical blobs (`sed 's/=.*/=<REDACTED>/'`). FAIL if a private secret is in the current tree. If only a deleted historical `.env` held the **publishable** key, record WARN + commit SHA, not ROTATE NOW.

Confirm `.gitignore` has `.env`, `.env.*`, `!.env.example`.

### 7. Payments verified server-side

```bash
rg -n "stripe|paystack|webhook|checkout.session|isPremium|is_premium" --glob '!node_modules/**' --glob '!package-lock.json' --glob '!docs/**'
```

N/A if no payment provider exists. FAIL if a client flag gates paid features or webhooks skip signature check.

## Severity

| Severity | Use when |
| --- | --- |
| critical | Unauthenticated access to all user data, or a private key in git |
| high | Unauthenticated costly LLM route, admin authz bypass, RLS off on user tables |
| medium | Missing rate limit, open CORS, catalog public-read, client-only admin route wrap |
| low | Unused zod, docs describing a `VITE_` password, missing CI secret scan |

## Report table columns

`Check | Result | Severity | Evidence | Notes`
