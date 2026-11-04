# ShiftED — Simon’s Workbooks tab

What this is: a new tab, only for admins. Simon stays an admin. There is no new role.

He picks a topic and a method, then chats with the model in that tab. The model drafts the workbook one section at a time. Simon edits the text, saves it, and exports a PDF or a Word file. Those files stay with him. Clients do not see them. Later, the team can put a finished workbook back into the training system.

The live coach chat is not part of this. Phase 1 and 2 stay as they are.

The RunPod model (`empathy-coach-qwen`, Qwen 2.5 7B) is the coach. Its context is about 4,096 tokens unless the server is set higher, and it was trained to coach, not to write a long document. Draft the workbook with a larger model instead. One setting switches it: `WORKBOOK_LLM_PROVIDER=fallback` uses the existing Groq-style backup (set `FALLBACK_LLM_MODEL` to `llama-3.3-70b-versatile` or `qwen3-32b`). That API is in the US and costs a few pennies per workbook. If the draft must stay in the EU, run a larger Qwen (32B) on RunPod and point `WORKBOOK_LLM_API_URL` at it. Do not put real patient stories into this tool.

Simon has not signed the resource review. Until he does, the writer may use only US public-domain material. The allowed list is a settings file, so it can change after he signs without a code change.

Built on branch `cursor/workbooks-tab`. See `docs/WORKBOOKS_TAB.md`. Migration file is in the repo but not applied to production.

---

## Paste this into a Cursor cloud agent

Repo: aliattia10/empathy-coach-ai (ShiftED AI, shiftedai.netlify.app). First `git pull origin main` (latest includes `51b80ef` responsive shell and `b6ed3b5` Simon's resource review PDF — knowledge base stays on hold until he signs). Create branch `cursor/workbooks-tab` and open ONE pull request to `main`. Do NOT run migrations against production. Do NOT change live coach chat behaviour. Do NOT commit secrets or `.env` files.

### Goal

Add a Workbooks tab where Simon (existing admin role — no new role) chats with a writing model to create his own CBT-style workbooks: choose topic and method, then the model drafts an outline, then each section one by one, grounded only in allowed sources. Simon edits, saves, and exports PDF and DOCX. Finished workbooks are private to their owner and other admins (saved and exportable) so the team can later feed them back into the system. They are never shown to clients in this PR.

### Read first

- LLM transport: `netlify/functions/chat.js` (RunPod Serverless vLLM via `VLLM_API_URL`, `VLLM_MODEL` default `empathy-coach-qwen` = Qwen2.5-7B-Instruct + LoRA, `LLM_API_KEY`). Async RunPod job poll/cancel is in `skills/runpodAsync.cjs`. Context trimming is in `skills/llmChatHelpers.cjs` (`VLLM_MAX_CONTEXT_TOKENS`, often 4096). See `docs/SUPER-PROMPT-CONTEXT-LIMIT-FIX.md` and `docs/GROQ-VS-RUNPOD-DECISION.md`.
- Existing backup provider: `skills/fallbackLlm.cjs`. OpenAI-compatible. Env: `FALLBACK_LLM_API_KEY` or `GROQ_API_KEY`, `FALLBACK_LLM_API_URL` (defaults to Groq), `FALLBACK_LLM_MODEL` (default `llama-3.1-8b-instant`). Reuse it. Do not add a new SDK.
- Local server mirror: `server/server.js` (`/api/chat`).
- Client coaching prompts: `skills/buildProductionSystemPrompt.cjs`, `skills/coachSystemPrompt.cjs`, `skills/llmEnginePhases.cjs`. These are for clients (one question per turn, no jargon, phase lock). Phase 1 and 2 behaviour is already trained into the coach model. Do not modify them and do not reuse them for authoring. Reuse only the crisis regex/protocol from `skills/knowledgeBase.cjs` and the skill/workbook vocabulary from `skills/skillsLibrary.cjs` and `skills/workbooksLibrary.cjs`.
- Retrieval today: rule-based keyword scoring over `knowledge-base/index.json` (`skills/knowledgeBase.cjs`).
- Auth and roles: Supabase. `src/hooks/useAuth.tsx`, `src/components/auth/RequireAuth.tsx`, `RequireAdmin.tsx`. `public.user_roles`, `public.has_role(uid,'admin')`. Routes in `src/App.tsx` under `/testing`.

### Tasks

**Model switch — new `skills/llmProvider.cjs`**

- `callLlm({ messages, sampling, purpose })` where `purpose` is `coach` or `workbook`.
- Provider chosen by env: `WORKBOOK_LLM_PROVIDER` = `runpod` | `fallback` | `auto` (default `auto`).
- Optional overrides: `WORKBOOK_LLM_API_URL`, `WORKBOOK_LLM_MODEL`, `WORKBOOK_LLM_API_KEY`, `WORKBOOK_MAX_TOKENS` (default 1500), `WORKBOOK_MAX_CONTEXT_TOKENS` (default from `VLLM_MAX_CONTEXT_TOKENS`, else 8192).
- `runpod` uses the existing RunPod path. `fallback` uses `skills/fallbackLlm.cjs` (`callFallbackChat`). For workbook drafts, document that `FALLBACK_LLM_MODEL` should be `llama-3.3-70b-versatile` or `qwen3-32b`, not the 8B default.
- `auto` tries the workbook-specific provider if set, otherwise RunPod, and falls back on timeout, queue, or failure the same way `chat.js` does.
- Move the RunPod call code out of `chat.js` into this module so `chat.js` uses it with `purpose: 'coach'`. Coach behaviour must stay identical. Add regression tests.
- Return `{ text, provider, model }` so the UI can show which model drafted each section.

**Allowed-sources config**

- `config/workbookSources.json`:

```json
{
  "allowedLicences": ["us_public_domain", "owner_authored"],
  "allowedAgencies": ["VA NCPTSD", "VA MIRECC", "VA/DoD", "SAMHSA", "NIMH", "NIAAA", "NIDA", "HHS"],
  "blockedSources": ["NHS CNTW", "CCI", "CEDAR", "Berkshire NHS", "PositivePsychology.com"]
}
```

- These are the safe defaults until Simon signs the resource review (`docs/SIMON-RESOURCE-REVIEW-BEFORE-BUILD.pdf`). Allow an env override `WORKBOOK_SOURCES_CONFIG` (path or JSON) so the list can change after he signs, without a code change.
- `skills/safeCorpus.cjs` loads passages, then filters by the config. A passage passes only if its licence is allowed and its source is not blocked. Unit tests prove blocked sources never reach a prompt.
- `scripts/build-safe-corpus.mjs <textDir> <map.csv>` splits extracted text into passages of about 600–800 tokens with metadata `{id, agency, title, part, file, url, licence}` and writes `knowledge-base/safe-corpus/passages.jsonl` plus an index. Commit only a small sample fixture, not the full corpus.
- Search: keyword or BM25 (for example minisearch), returning the top passages for each section query.

**Database migration (file only)**

`supabase/migrations/<timestamp>_clinician_workbooks.sql`

- `clinician_workbooks`: id, owner_id, title, topic, method, audience, status `draft` or `final`, created_at, updated_at.
- `clinician_workbook_sections`: id, workbook_id, position, kind, title, body_md, sources jsonb, provider, model, updated_at.
- `clinician_workbook_messages`: id, workbook_id, role, content, sources jsonb, created_at.
- RLS: the owner can create, read, update, and delete only if `has_role(auth.uid(),'admin')`. Other admins can read. No access for anyone who is not an admin.
- Do not apply this migration to production. Put the SQL in the PR description for Ali to run by hand.

**API**

`netlify/functions/workbook-author.js` and the same route `/api/workbook-author` in `server/server.js`.

- Verify the Supabase JWT and the admin role. Anyone else gets 403.
- Actions: `outline`, `draft_section`, `rewrite_section`, `chat`.
- `outline` returns JSON only: 5–10 sections, each with kind, title, purpose, and a search query.
- `draft_section` retrieves the top passages for that one section, then sends the authoring prompt, a compact outline, a short summary of the previous section (not the full text), and the passages. Stay inside `WORKBOOK_MAX_CONTEXT_TOKENS`. One section, up to `WORKBOOK_MAX_TOKENS`.
- Long sections continue with a `continue` flag. Never generate the whole workbook in one call.
- RunPod async: return a `jobId` and let the client poll, same pattern as chat.

**Prompt `skills/workbookAuthorPrompt.cjs`**

- The reader is the clinician. British English. Clinician-style language is allowed.
- Every factual claim must come from the provided passages, cited as `[S#]`. Paraphrase. Do not quote more than two sentences.
- Never use blocked sources.
- Self-harm and suicide topics get a crisis box: 999, Samaritans 116 123, NHS 111.
- Every section ends with: `Draft — clinician review required`.

**UI**

Admin only, behind `RequireAdmin`. Nav item: Workbooks.

- `/testing/workbooks` — list of this admin’s workbooks.
- `/testing/workbooks/new` — wizard. Topic (low mood, worry, panic, sleep, PTSD, alcohol, anger, stress, and similar). Method (thought record / HCPR, behavioural activation, graded exposure, problem solving, mindfulness, relapse prevention). Audience (adult client or clinician). Length.
- `/testing/workbooks/:id` — editor.
  - Left: chat with the writing model.
  - Right: outline, with Generate, Regenerate, and Continue on each section, a markdown editor, reorder, and accept or reject of the model’s text.
  - A sources drawer with agency, title, and link. A provider and model badge on each section. Autosave.
- Match the existing shell (solid dark chrome, 44px controls, bottom nav until the `lg` breakpoint). Phone, tablet, and desktop.
- Export PDF and DOCX. Title page, sections, worksheet tables for exercises, and a last page: “Adapted from US public-domain materials (agency list). Not an official product of these agencies. Draft for clinician use.”

**Tests**

- Vitest: provider selection and fallback (mock fetch), coach regression, licence and config guard, retrieval, section prompt stays inside the token budget, outline JSON parsing, export snapshot.
- Playwright: an admin creates a workbook, gets an outline, drafts two sections, edits, and exports, with the model mocked. A non-admin cannot see the tab.
- Run `npm run lint && npm test && npm run build`.

**Docs `docs/WORKBOOKS_TAB.md`**

Env vars, how to build the corpus, how to change allowed sources after Simon signs, the manual migration step, and how to export finished workbooks for later training (`scripts/export-clinician-workbooks.mjs` writes JSONL, admin only).

### Acceptance

- Simon, as an admin, can create a workbook, generate it section by section, edit, save, and export PDF and DOCX. Non-admins and clients see nothing.
- Blocked sources never enter the prompt (tested). The allowed list can change via config or env.
- `WORKBOOK_LLM_PROVIDER=fallback` drafts through the existing Groq or other OpenAI-compatible backup. `runpod` uses `empathy-coach-qwen`. `auto` falls back when RunPod fails.
- Coach chat is unchanged. Regression tests pass.
- The pull request lists changed files, the migration to run by hand, and the new env vars.
