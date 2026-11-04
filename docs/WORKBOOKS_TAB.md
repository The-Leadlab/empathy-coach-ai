# Workbooks tab (admin / Simon)

Private CBT workbook drafting for admins. Clients never see these drafts.

## Routes

- `/testing/workbooks` — list
- `/testing/workbooks/new` — topic / method wizard
- `/testing/workbooks/:id` — chat + section editor, PDF / Word export

Nav item **Workbooks** appears only for trainer admins (`useTrainerAdmin`).

## Model

Coach chat is unchanged (RunPod `empathy-coach-qwen`).

Workbook drafting uses `skills/llmProvider.cjs` with:

| Env | Purpose |
| --- | --- |
| `WORKBOOK_LLM_PROVIDER` | `fallback` (recommended), `runpod`, or `auto` |
| `FALLBACK_LLM_API_KEY` / `GROQ_API_KEY` | OpenAI-compatible key |
| `FALLBACK_LLM_MODEL` | Prefer `llama-3.3-70b-versatile` or `qwen3-32b` |
| `WORKBOOK_MAX_TOKENS` | Default 1500 |
| `WORKBOOK_SOURCES_CONFIG` | Path or JSON override for allowed sources |

## Safe sources

Until Simon signs the resource review, only US public-domain agencies in `config/workbookSources.json` are used. Sample passages live in `knowledge-base/safe-corpus/passages.jsonl`.

## Database

Migration file (do **not** auto-apply):

`supabase/migrations/20261103200000_clinician_workbooks.sql`

Until it is applied, drafts fall back to `localStorage` so the UI still works for Simon.

## API

`POST /api/workbook-author` (Netlify function + local `server/server.js`)

Admin JWT required. Actions: `outline`, `draft_section`, `rewrite_section`, `continue_section`, `chat`, `poll`.

## Export

Client-side PDF (`jspdf`) and DOCX (`jszip`). Credits footer lists agencies used.
