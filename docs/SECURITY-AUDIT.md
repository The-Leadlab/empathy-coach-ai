# Security audit — ShiftED AI (empathy-coach-ai)

- **Repo:** The-Leadlab/empathy-coach-ai
- **Commit:** `ab400c3` (`main` at audit time)
- **Date:** 2026-11-06
- **Stack:** Vite + React + TypeScript SPA; Netlify Functions (canonical) + Vercel `api/` adapters + local Express `server/server.js`; Supabase Auth + Postgres (RLS); LLM via RunPod / OpenRouter / Groq / OpenAI. No Stripe/Paystack.
- **Skill:** `.cursor/skills/security-audit/SKILL.md`
- **Scope:** Source-only. No production probes, no live credentials, no secret values printed.

No private live secret (service_role JWT, LLM key, Stripe secret, private key) was found in the current tree. A historical `.env` in git still contains the **Supabase publishable (anon) JWT** — public-by-design, but it should not live in git history. See check 6.

## Results

| Check | Result | Severity | Evidence | Notes |
| --- | --- | --- | --- | --- |
| 1. No secrets in frontend / client bundle | **PASS** | — | `src/integrations/supabase/client.ts:5-6` reads only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Other `src/` `import.meta.env.VITE_*` hits: `src/pages/SettingsPage.tsx:13` (`VITE_FEATURE_REFERRALS`), `src/test/setup.ts:4-10` (test stubs). `rg` of `src/` + `public/` found no `SERVICE_ROLE`, `LLM_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `sk_live_`, `whsec_`. No `dist/` in the worktree. | Docs still mention `VITE_ADMIN_CHAT_PASSWORD` (`docs/SUPER-PROMPT-ADMIN-PANEL.md:10`); current code does not read it (`docs/ADMIN-LOGIN-CREDENTIALS.md:18-20` warns against it). `.env.example:5` names a real project URL (not a secret). |
| 2. Database RLS on; no public read/write | **FAIL** | medium | Catalog SELECT policies do not restrict to `authenticated`: `supabase/migrations/20260520120000_skills_library.sql:27-29` (`using (is_active = true)`), `supabase/migrations/20261006120000_phase3_development_skills.sql:32-34` (same for `workbooks`). User tables do enable RLS (e.g. `supabase/migrations/20260309183836_31db7670-02da-483b-a802-53766741b4f1.sql:18,31,42,61,71,83` plus later chat/consent/clinician migrations). `Notification` RLS-off was addressed in `supabase/migrations/20261103193000_notification_rls.sql:1-11`. | Catalog content is not user PII, but the policy name says “authenticated” while `USING` is open to `anon` with the publishable key. Hosted Advisor drift is **needs validation**. `clinician_*` tables are in SQL but not in `src/integrations/supabase/types.ts` — confirm the migration was applied. |
| 3. Server-side auth **and** authorization on APIs + admin pages | **FAIL** | high | Unauthenticated LLM proxies: `netlify/functions/chat.js:183` (GET/POST/DELETE, no JWT); `netlify/functions/transcribe.js:9-24`; `netlify/functions/translate.js:14-32`. Client callers send no `Authorization`: `src/lib/fetchChatReply.ts:275-278`, `src/lib/fetchAdminTranslation.ts:23-30`. `/adminchat` is outside `RequireAuth`/`RequireAdmin`: `src/App.tsx:59-61`. Email allowlist skips `user_roles`: `src/lib/adminAccess.ts:7-16`, `src/components/auth/RequireAdmin.tsx:32-38`, `netlify/functions/workbook-author.js:40-42`, `server/server.js:402-412`. | `workbook-author` **does** verify JWT + admin role (`netlify/functions/workbook-author.js:25-66`) and the client sends a bearer (`src/lib/workbookAuthorApi.ts:31-38`). `/testing/*` is behind `RequireAuth` (`src/App.tsx:62`); `/testing/workbooks` behind `RequireAdmin` (`src/App.tsx:76-80`). Admin chat UI checks role in the page (`src/pages/AdminChatPage.tsx:107-123`) — client-only. |
| 4. Rate limiting on auth, AI, costly endpoints | **FAIL** | high | `rg rateLimit\|rate-limit\|RATE_LIMIT` over `netlify/functions`, `api`, `server`, `src` (excluding tests) is empty. `server/server.js:8` accepts `express.json({ limit: "15mb" })` for all routes including `/api/chat`. | Anyone who can hit `/api/chat` or `/api/transcribe` can spend RunPod/Groq/OpenAI quota. No limiter on login/signup either. |
| 5. Input validation / XSS / CSRF / injection | **FAIL** | medium | Zod is in `package.json:79` but `rg from 'zod'\|z.object` in app/server/functions is empty. Hand-rolled checks only (e.g. `netlify/functions/chat.js` body fields, `netlify/functions/translate.js:26-32`, `netlify/functions/transcribe.js:21-24`). Open CORS: `server/server.js:7` (`cors()`), `netlify/functions/workbook-author.js:12` (`Access-Control-Allow-Origin: *`). | Supabase JS usage is parameterized (no concatenated SQL found). `dangerouslySetInnerHTML` only in `src/components/ui/chart.tsx:70` (CSS variables). SPA + bearer APIs: no CSRF token layer; unauthenticated POST endpoints make CSRF less relevant than open abuse. |
| 6. No secrets committed | **PASS** (warn) | low | Current tree: only `.env.example` and `server/.env.example` tracked. `.gitignore:14-18,34` ignores `.env*`. No `sk-` / `sk_live_` / `whsec_` / private-key / `SERVICE_ROLE_KEY=eyJ` matches in the worktree. | **History:** `.env` added in `959f349` (keys: `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`) and deleted in `4a6b853`. Blob still reachable via `git show 959f349:.env`. That JWT is the anon/publishable key, not service_role. No gitleaks/trufflehog and no `.github` workflows. |
| 7. Paid features / webhooks verified server-side | **N/A** | — | `rg stripe\|paystack\|webhook\|isPremium` in app/server (excluding docs/lockfile) is empty. | When payments are added, verify on the server; do not trust a client flag. |

**Overall:** not launch-ready for a public internet surface. Highest-impact gap is unauthenticated, unlimited LLM routes plus a client-only admin monitor.

## Top findings

1. **Unauthenticated costly LLM APIs (high).** `/api/chat`, `/api/transcribe`, and `/api/translate` (Netlify + Express) accept unauthenticated requests. Chat also exposes unauthenticated RunPod job poll (`GET`) and cancel (`DELETE`). An outsider can drain GPU/API budget and drive the coach on arbitrary prompts.
2. **No rate limits (high).** Same routes, plus a 15 MB JSON body on Express, have no per-IP or per-user throttle.
3. **Admin monitor is a client gate (high/medium).** `/adminchat` is not wrapped in `RequireAdmin`. Cross-user reads still depend on RLS + `has_role`, but named trainer emails (`NAMED_TRAINER_ADMINS`) skip the `user_roles` check in `RequireAdmin` and `workbook-author`.
4. **Catalog RLS is public SELECT (medium).** `skills` and `workbooks` policies named “authenticated” do not use `TO authenticated` / `auth.uid() IS NOT NULL`, so the anon key can read active rows.
5. **No zod on the wire (medium).** Request bodies are loosely checked; open CORS on the local server and workbook-author increases cross-origin call risk.
6. **Historical `.env` in git (low).** Publishable key + project URL remain in object history. Optional: rotate the anon key if the project treats it as confidential; add gitleaks to CI.

## Commands run

```bash
rg -n "import.meta.env.VITE_|SERVICE_ROLE|LLM_API_KEY|GROQ_API_KEY|OPENAI_API_KEY" src public
rg -n "create table|enable row level security|create policy" supabase/migrations --glob '*.sql'
rg -n "exports.handler|requireAdmin|auth.getUser|Authorization" netlify/functions api server/server.js
rg -n "RequireAuth|RequireAdmin|/adminchat|NAMED_TRAINER_ADMINS" src
rg -n "rateLimit|rate-limit|RATE_LIMIT|from 'zod'|z.object|dangerouslySetInnerHTML|Access-Control-Allow-Origin|app.use(cors" netlify/functions api server src
rg -n "stripe|paystack|webhook|isPremium" --glob '!node_modules/**' --glob '!package-lock.json' --glob '!docs/**'
git ls-files | rg '\.env'
git log --all --pretty=format:'%h %s' -- .env
# Historical .env keys only (values redacted): git show 959f349:.env | sed 's/=.*/=<REDACTED>/'
```
