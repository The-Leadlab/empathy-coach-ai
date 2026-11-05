# Environment Variables — Linked to Netlify & Local

**Use:** One place for all env vars. Set the same keys in **Netlify** (for the live site) and in **local `.env`** (for dev). Supabase vars are required for auth, survey storage, and exporting data for training.

**Do not put API keys in GitHub.** Use Netlify’s environment variables for the live site, and local `.env` files (which are in `.gitignore`) for development. Never commit `.env` or paste real keys into any file that is pushed to the repo.

---

## Link OpenRouter API (quick guide)

**Where to put the key:**  
- **Live site (Netlify):** Netlify → your site → **Site configuration** → **Environment variables**.  
- **Local dev:** In a **`server/.env`** file (create from `server/.env.example`). This file is in `.gitignore` and must **not** be committed to GitHub.

**Steps:**

1. **Get an API key:** Sign up at [openrouter.ai](https://openrouter.ai) and create an API key (free tier available, no card).
2. **For the live site (Netlify):**  
   - Open Netlify → your project → **Site configuration** → **Environment variables**.  
   - Click **Add a variable** (or **Edit** if they already exist).  
   - Add:  
     - **Key:** `LLM_API_KEY` → **Value:** your OpenRouter API key.  
     - Optional: `VLLM_API_URL` = `https://openrouter.ai/api/v1/chat/completions`, `VLLM_MODEL` = `meta-llama/llama-3.2-3b-instruct:free`.  
   - Save, then trigger a **new deploy** so the serverless chat function gets the key.
3. **For local development:**  
   - Copy `server/.env.example` to `server/.env`.  
   - In `server/.env` set `LLM_API_KEY=your-openrouter-api-key`.  
   - Do **not** commit `server/.env` to GitHub (it’s already in `.gitignore`).

**Other guides in this repo:**  
- **Full env list and Netlify:** this file (`docs/ENV-VARIABLES-AND-NETLIFY.md`).  
- **Test LLM and voice (local + Netlify):** `docs/TEST-LLM-AND-VOICE.md`.  
- **Cloud LLM options (OpenRouter, Groq, self-hosted):** `docs/LINK-CLOUD-LLM.md`.

---

## Netlify (deployed app)

**Where:** Netlify → your site → **Site configuration** → **Environment variables** → **Add a variable** / **Edit**.

Add these so the **live site** works:

| Variable | Required | Description |
|----------|----------|-------------|
| **LLM_API_KEY** | Yes (for RunPod chat) | RunPod API key for `/api/chat` (primary coach). |
| **VLLM_API_URL** | Yes (for RunPod) | RunPod OpenAI-compatible URL, e.g. `https://api.runpod.ai/v2/<endpoint-id>/openai/v1/chat/completions`. |
| **VLLM_MODEL** | No (has default) | Served model name on RunPod (e.g. `empathy-coach-qwen`). |
| **FALLBACK_LLM_API_KEY** | Recommended | OpenAI-compatible API key used when RunPod is queued/failed. Falls back to `GROQ_API_KEY` if set. |
| **FALLBACK_LLM_API_URL** | No | Default `https://api.groq.com/openai/v1/chat/completions` when `GROQ_API_KEY` is set. |
| **FALLBACK_LLM_MODEL** | No | Default `llama-3.1-8b-instant`. |
| **RUNPOD_FALLBACK_AFTER_MS** | No | Wait this long on `IN_QUEUE` before switching to fallback (default `75000`). |
| **GROQ_API_KEY** | Optional | Used for voice transcription and as fallback chat key when `FALLBACK_LLM_API_KEY` is unset. |
| **VITE_SUPABASE_URL** | Yes | Supabase project URL, e.g. `https://wxxwxvauseqftyorhkkp.supabase.co`. Needed for auth, survey, chat storage. |
| **VITE_SUPABASE_PUBLISHABLE_KEY** | Yes | Supabase anon/public key. Needed for auth and Supabase client in the browser. |

Optional (for the chat function):

| Variable | Description |
|----------|-------------|
| LLM_PROVIDER | `runpod` (default) or `openai_compat`. `openai_compat` sends a plain sync request to `VLLM_API_URL` without vLLM-only fields (`chat_template_kwargs`); any other value is treated as `runpod`. |
| VLLM_TEMPERATURE | Default `0.6` (regenerate uses at least `0.78`) |
| VLLM_MAX_TOKENS | Default `250` (`350` for the Phase One summary turn) |
| VLLM_REPETITION_PENALTY | Default `1.1` |
| VLLM_TIMEOUT_MS | e.g. `60000` |
| RUNPOD_ASYNC | Set `false` to disable async RunPod submit/poll |

**Coach reply guard.** Every chat reply passes through `skills/coachReply.cjs` before it reaches the user: `<think>` blocks and `reasoning_content` are dropped, Qwen thinking is disabled (`enable_thinking: false`, `/no_think`, `<think>` stop sequence), and replies that read like planning ("We need to…", "the user", phase/step names) or — during Phase One intake — contain no question are rejected. A rejected reply is regenerated once with a stricter reminder, then sent to the fallback provider once, then replaced by a fixed question for the current intake element. Phase One intake turns ask the model for `{"state_update":…,"reply":…}` JSON; the server tracks which element (situation, trigger, rule, belief, strength, coping) comes next and the client stores that state in `chat_messages.generation_metadata.phaseOne`. Replies are not streamed; `createThinkStreamFilter()` exists for when streaming is added. Check behaviour against a deployment with `node scripts/eval-coach-replies.mjs --app https://<host>`.

**Important:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are **baked into the frontend at build time**. If they’re missing in Netlify, the deployed app won’t be able to reach Supabase (login, survey, saving chats). Add them in Netlify with the same values as in your local `.env`.

---

## Local development

**Frontend (Vite):** Use a `.env` file in the **project root** (or `env` in the Vite config). Vite only exposes variables that start with `VITE_`.

**Backend (server):** Use `server/.env` for the Express server (or copy from `server/.env.example`).

### Root `.env` (frontend + scripts)

```env
# Supabase (required for auth, survey, chat storage)
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

### `server/.env` (local backend / LLM)

```env
# Primary: RunPod (async)
VLLM_API_URL=https://api.runpod.ai/v2/YOUR_ENDPOINT/openai/v1/chat/completions
LLM_API_KEY=your-runpod-api-key
VLLM_MODEL=empathy-coach-qwen

# Fallback when RunPod is cold / queued (OpenAI-compatible, e.g. Groq)
# FALLBACK_LLM_API_KEY=your-fallback-key
# FALLBACK_LLM_API_URL=https://api.groq.com/openai/v1/chat/completions
# FALLBACK_LLM_MODEL=llama-3.1-8b-instant
# RUNPOD_FALLBACK_AFTER_MS=75000
# GROQ_API_KEY=your-groq-api-key
```

### Scripts (generate data, export Supabase)

- **Generate synthetic training data:** `OPENROUTER_API_KEY` or `LLM_API_KEY`; optional: `VLLM_API_URL`, `VLLM_MODEL`.
- **Export Supabase to JSONL:** `VITE_SUPABASE_URL` (or `SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY` if you only have anon key).

---

## Where each variable is used

| Variable | Used by |
|----------|--------|
| LLM_API_KEY | Netlify function `netlify/functions/chat.js`, `server/server.js`, `scripts/generate-training-data-openrouter.js` |
| VLLM_API_URL | Same as above |
| VLLM_MODEL | Same as above |
| VITE_SUPABASE_URL | Frontend `src/integrations/supabase/client.ts`, `scripts/export-supabase-to-jsonl.js` |
| VITE_SUPABASE_PUBLISHABLE_KEY | Frontend `src/integrations/supabase/client.ts` |
| SUPABASE_SERVICE_ROLE_KEY | `scripts/export-supabase-to-jsonl.js` only (for full export; not needed in Netlify) |

---

## Checklist: link Netlify to your setup

1. **Netlify → Environment variables:** Add (or confirm) **VITE_SUPABASE_URL** and **VITE_SUPABASE_PUBLISHABLE_KEY** with the same values as in your root `.env`.
2. **Redeploy** (or trigger a new deploy) so the new build gets the Supabase vars.
3. **LLM:** You already have **LLM_API_KEY**, **VLLM_API_URL**, **VLLM_MODEL** in Netlify; no change needed unless you switch provider or model.

After that, the live site will have both **chat (OpenRouter/open-source LLM)** and **Supabase (auth, survey, storage)** correctly linked.

---

## If chat still fails (500 / “I didn’t get a response”)

1. **Redeploy after changing env vars**  
   Netlify functions only see environment variables from the deploy that was active when they ran. After adding or editing **LLM_API_KEY** (or any var), go to **Deploys** → **Trigger deploy** → **Deploy site** so the chat function gets the new values.

2. **Variable name must be exact**  
   The chat function expects **`LLM_API_KEY`** (not `OPENROUTER_API_KEY` or `VLLM_API_KEY`). In Netlify → Environment variables, the key must be exactly `LLM_API_KEY`.

3. **Check function logs**  
   In Netlify → **Logs** (or **Functions** → select the chat function → **Logs**), look for messages such as:
   - `LLM not connected: LLM_API_KEY is not set` → add the key and redeploy.
   - `OpenRouter error: 401 ...` → invalid or expired API key; create a new key at openrouter.ai and update **LLM_API_KEY**.
   - `OpenRouter error: 404 ...` → wrong **VLLM_MODEL**; use a valid model id from [OpenRouter models](https://openrouter.ai/docs#models), e.g. `meta-llama/llama-3.2-3b-instruct:free`.

4. **OpenRouter Activity shows 0 requests**  
   That usually means the request never reaches OpenRouter: either **LLM_API_KEY** is missing/empty in the deploy, or the function crashes before `fetch`. Fix env + redeploy and check Netlify function logs as above.

---

## 429 Rate limit (free model “temporarily rate-limited”)

If the logs show **OpenRouter error: 429** and a message like *"meta-llama/llama-3.2-3b-instruct:free is temporarily rate-limited upstream"*:

- **What it means:** The free model on OpenRouter has a shared rate limit; when traffic is high, requests are throttled.
- **What we do:** The chat function **retries once** after 2 seconds when it gets a 429. If it still gets 429, the user sees: *"The AI is in high demand. Please try again in a moment."*
- **What you can do:**
  1. **Try again shortly** — Limits usually reset after a short time.
  2. **Use another free model** — In Netlify set **VLLM_MODEL** to a different [OpenRouter free model](https://openrouter.ai/docs#models) (e.g. another listed free model), then redeploy.
  3. **Add your own key (BYOK)** — At [OpenRouter → Settings → Integrations](https://openrouter.ai/settings/integrations) you can add your own provider key (e.g. OpenAI, Anthropic). That can give you better rate limits for the same or other models.

---

## See also

- **Root:** `.env.example` — Supabase vars for frontend; copy to `.env` for local dev.
- **Server:** `server/.env.example` — LLM vars for local backend and for reference (Netlify uses its own env for the function).
