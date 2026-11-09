# Phase 3 — Data integration (RAG + next SFT)

This is the **LLM training / data** meaning of Phase 3: curate SAFE corpus → chat RAG + JSONL for the next RunPod LoRA.  
It is **not** coach-protocol Phase Three (Sustainability) and **not** the Development Skills product UI.

## Architecture

- **RAG** for long-tail psychoeducation (US federal PD + Simon-owned).
- **LoRA/SFT** only for behaviour (tone, one-question, crisis routing).
- Do **not** bake multi-GB archives into model weights.

```
data/raw → ingest (licence gate) → chunks.jsonl → index (RAG)
                                      ↘ sft train/eval JSONL → RunPod Pod (when credits OK)
```

Feature flag: `PHASE3_RAG_ENABLED=true` (default **off**).  
Embeddings: `PHASE3_EMBEDDING_PROVIDER=hash` (default) or `openai_compat` (reserved).  
Optional external URI: `PHASE3_VECTOR_URI` (path to `phase3-index.json`).

## Local pipeline

```bash
node scripts/phase3/ingest.mjs
node scripts/phase3/build-index.mjs
node scripts/phase3/build-sft.mjs
npm run validate:training-jsonl -- data/sft/train.jsonl
node scripts/eval-phase3.mjs
```

Drop SAFE extracts under `data/raw/<part-id>/` (Parts 8–20, Simon subsets of 2a/2d). HOLD packs stay out.

## RunPod fine-tune (credits confirmed)

1. Validate: `node scripts/validate-training-jsonl.js data/sft/train.jsonl`
2. On a **GPU Pod** (not Serverless), upload `data/sft/train.jsonl` → `/workspace/train.jsonl` and `scripts/runpod-train-simon-lora.py`, then:

```bash
python runpod-train-simon-lora.py \
  --train /workspace/train.jsonl \
  --output /workspace/models/empathy-coach-qwen-phase3 \
  --epochs 2 --max-seq-length 4096 --batch-size 1
```

3. Merge/serve on the existing Serverless endpoint only after evals pass.

SFT JSONL is gitignored (~5 MB) — upload from your machine; do not commit user chats.

## Safety

- Louise Q2: serious self-harm → stop coaching / crisis resources; jokes stay in coaching mode when clearly non-serious.
- PCL-5 / safety-plan forms / kids-youth → excluded from RAG+SFT.
- Suicide patient workbooks → `red_flag_source_only` (not retrieved in normal turns).
- Part 20 IHS → cultural review cleared (Simon OK).
- Reply-leak contract unchanged: no thinking aloud, one question, no protocol names to users.

## Vercel / Netlify env

Production project: [vercel.com/the-lead-lab/shifted-ai](https://vercel.com/the-lead-lab/shifted-ai) (local link: `.vercel/project.json` → `prj_sBs1WWLh8SC1UqY3mO7APoY6pr1j`).

Set the same keys on **Vercel Project → Settings → Environment Variables** (and Netlify if still used):

| Variable | Default | Meaning |
|----------|---------|---------|
| `PHASE3_RAG_ENABLED` | unset/false | Turn on RAG injection |
| `PHASE3_EMBEDDING_PROVIDER` | `hash` | Embedding backend |
| `PHASE3_VECTOR_URI` | `data/index/phase3-index.json` | Index path |

## Current corpus status (9 Nov 2026)

- **Index** `data/index/phase3-index.json` — **5941** chunks (committed for deploy/RAG)
- **SFT** `data/sft/train.jsonl` — **4128** train / **459** eval (local; upload to RunPod)
- Licences: US-federal-PD + simon-owned + shifted-owned; Part 20 included
- HOLD packs stay out
- Demo: set `PHASE3_RAG_ENABLED=true` on Vercel after this branch is deployed

Re-run after adding more packs under `data/raw/`:

```bash
node scripts/phase3/ingest.mjs && node scripts/phase3/build-index.mjs && node scripts/phase3/build-sft.mjs
```

## Open human blockers

1. UK vs CH crisis numbers  
2. GDPR consent before any *user* chat SFT  
3. Deploy this branch → set `PHASE3_RAG_ENABLED=true` for demo smoke

## WhatsApp delay copy (send manually)

> Hey — quick update. Phase 3 data integration is underway (SAFE packs → searchable knowledge for chat + next fine-tune dataset). The corpus pull/clean is slower than expected, so I need a bit more time. Aiming to have everything ready **tomorrow**. I’ll ping as soon as RAG + the training set are green. Thanks for your patience.
