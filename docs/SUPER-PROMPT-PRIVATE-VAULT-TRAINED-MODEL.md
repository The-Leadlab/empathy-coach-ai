# SUPER-PROMPT — Private vault + trained 14B (no Groq coach)

**Goal:** Put `empathy-coach-qwen14-merged-v2` in a **private Hugging Face vault**, serve it for free (Mac MLX 4-bit + Cloudflare tunnel; or HF Space ZeroGPU once the HF account is ≥30 days old), point **Netlify** at that host, and **turn off Groq** for coach chat. Leave RunPod volume `lo3n0gefun` + Vercel for **training** only. **Do not use Modal** (paid).

**Do not** push weight files to the public GitHub repo.

---

## Paste into a new Cursor chat (after credentials exist)

```
You are cutting ShiftED Netlify coach chat over to a private vault that serves the FULL trained merge (not Groq).

CONTEXT
- Local merge (source of truth): models/empathy-coach-qwen14-merged-v2 (~28 GB)
- Checksums: docs/exports/model-backup-v2/SHA256SUMS.txt
- RunPod archive (do NOT delete): volume lo3n0gefun → /runpod-volume/models/empathy-coach-qwen14-merged-v2 ; endpoint ukbtc1h97b2y2h (training only)
- Netlify already has LLM_PROVIDER=vault; without VAULT_LLM_* it uses Groq dummy
- App: skills/llmProvider.cjs resolveVaultEndpoint(); netlify/functions/chat.js
- Helpers in repo: scripts/upload-model-to-private-hf.sh , scripts/modal_vault_serve.py
- Full runbook: docs/SUPER-PROMPT-PRIVATE-VAULT-TRAINED-MODEL.md

LOCKED
1. Vault storage = private HF model repo
2. Inference = Modal vLLM OpenAI /v1/chat/completions, scale-to-zero
3. VAULT_BASE_MODEL=empathy-coach-qwen14 (served-model-name)
4. After smoke: COACH_DISABLE_FALLBACK=1 on Netlify
5. Do not change Vercel coach routing; do not delete RunPod volume

STEPS (stop if a step fails)
A. Verify: cd models/empathy-coach-qwen14-merged-v2 && shasum -a 256 -c ../../docs/exports/model-backup-v2/SHA256SUMS.txt
B. Export HF_TOKEN (write) + HF_REPO_ID=org-or-user/empathy-coach-qwen14-merged-v2-private
C. Run: bash scripts/upload-model-to-private-hf.sh
D. modal secret create huggingface-secret HF_TOKEN=... (if needed); set MODAL_VAULT_API_KEY; modal deploy scripts/modal_vault_serve.py
E. Capture Modal URL ending in /v1/chat/completions (or /v1 + path Netlify expects)
F. netlify env:set LLM_PROVIDER vault ; VAULT_LLM_API_URL ; VAULT_LLM_API_KEY ; VAULT_BASE_MODEL empathy-coach-qwen14 ; then COACH_DISABLE_FALLBACK=1
G. netlify deploy --prod
H. Smoke: POST /api/chat → provider must be "vault"; warm mode skipped; no Groq in logs
I. Document HF_REPO_ID + Modal URL in docs/exports/model-backup-v2/README.md (no secrets)

Later LoRA: train short adapter on RunPod → push adapter → set VAULT_LORA_ADAPTER only (no full re-merge).
```

---

## Manual checklist (same order)

### 1. Verify local weights

```bash
cd "/Users/attia/Desktop/Paginas web/New folder/empathy-coach-ai/models/empathy-coach-qwen14-merged-v2"
shasum -a 256 -c "../../docs/exports/model-backup-v2/SHA256SUMS.txt"
```

### 2. Private HF vault (cold storage)

1. Create a **private** model repo on Hugging Face (e.g. `YOUR_ORG/empathy-coach-qwen14-merged-v2`).
2. Token with **write** access: https://huggingface.co/settings/tokens
3. Upload:

```bash
export HF_TOKEN=hf_...
export HF_REPO_ID=YOUR_ORG/empathy-coach-qwen14-merged-v2
bash scripts/upload-model-to-private-hf.sh
```

### 3. RunPod volume (archive only)

Confirm path still exists; **do not delete** `lo3n0gefun`. Training stays here / on Vercel.

### 4. Modal scale-to-zero host

```bash
# once: pip install modal && modal setup
export HF_REPO_ID=YOUR_ORG/empathy-coach-qwen14-merged-v2
export VAULT_BASE_MODEL=empathy-coach-qwen14
export MODAL_VAULT_API_KEY=$(openssl rand -hex 24)   # save this for Netlify
modal secret create huggingface-secret HF_TOKEN="$HF_TOKEN"
modal secret create shifted-vault-auth VAULT_API_KEY="$MODAL_VAULT_API_KEY"
modal deploy scripts/modal_vault_serve.py
```

Smoke Modal directly:

```bash
curl -sS "$MODAL_CHAT_URL" \
  -H "Authorization: Bearer $MODAL_VAULT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"empathy-coach-qwen14","messages":[{"role":"user","content":"Reply with exactly: vault live"}],"max_tokens":8}'
```

Cold start can take 1–3+ minutes the first time.

### 5. Netlify cutover (drop Groq for coach)

```bash
npx netlify env:set LLM_PROVIDER vault --force --context production --context deploy-preview --context branch-deploy
npx netlify env:set VAULT_LLM_API_URL "https://…/v1/chat/completions" --force --context production --context deploy-preview --context branch-deploy
npx netlify env:set VAULT_LLM_API_KEY "$MODAL_VAULT_API_KEY" --force --context production --context deploy-preview --context branch-deploy
npx netlify env:set VAULT_BASE_MODEL empathy-coach-qwen14 --force --context production --context deploy-preview --context branch-deploy
# After vault smoke succeeds:
npx netlify env:set COACH_DISABLE_FALLBACK 1 --force --context production --context deploy-preview --context branch-deploy
npx netlify deploy --prod
```

### 6. Verify production

```bash
curl -sS -X POST https://shiftedai.netlify.app/api/chat \
  -H 'content-type: application/json' \
  -d '{"userMessage":"I froze when my manager shut me down.","chatHistory":[]}'
# expect: "provider":"vault"
```

Warm must not boot RunPod:

```bash
curl -sS -X POST https://shiftedai.netlify.app/api/chat \
  -H 'content-type: application/json' -d '{"mode":"warm"}'
# expect: skipped / runpod_not_configured
```

### 7. Easy updates later (LoRA)

1. Short QLoRA job on RunPod (training lane).
2. Push adapter to a private HF repo or Modal volume.
3. Set `VAULT_LORA_ADAPTER=<adapter-served-name>` on Netlify (preferred over base when set).
4. Redeploy Netlify functions (env change + deploy). No full 14B retrain required for small behaviour tweaks.

---

## Related

- Upload: `scripts/upload-model-to-private-hf.sh`
- Serve: `scripts/modal_vault_serve.py`
- Backup card: `docs/exports/model-backup-v2/README.md`
- Env: `.env.example` (`VAULT_*`, `COACH_DISABLE_FALLBACK`)
