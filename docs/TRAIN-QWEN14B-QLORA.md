# Train Qwen2.5-14B QLoRA (GTM)

**Goal:** Fine-tune a stronger base on the full merged corpus, merge to the network volume, swap Serverless, then **terminate the train pod** so credits stop.

**Budget rule:** Never leave a training pod idle. Stop → terminate as soon as merge + smoke succeed.

---

## 0. Prepare data (laptop)

```bash
# Fresh Simon export (needs Supabase service role)
npm run export:simon-training

# Merge Phase 3 + Simon (+ data/sft/external/*.jsonl if you drop old-laptop files)
npm run merge:training-corpus

# Validate
npm run validate:training-jsonl -- data/sft/train_14b_gtm.jsonl
```

Outputs:

- `data/sft/train_14b_gtm.jsonl`
- `data/sft/eval_14b_gtm.jsonl`
- `data/sft/train_14b_gtm.summary.json`

---

## 1. Create one train pod

Preferred GPU: **A100 80GB** (Unsloth 14B 4-bit + seq 4096). Fallback: 48GB class if it fits.

Quote the hourly price **before** create. Attach the existing network volume (`lo3n0gefun` / current ShiftED volume).

Upload to the pod:

- `data/sft/train_14b_gtm.jsonl` → `/workspace/train_14b_gtm.jsonl`
- `scripts/runpod-train-qwen14b-qlora.py`
- or run `bootstrap-runpod-train-14b.py` once both files are on the pod

---

## 2. Train + merge

```bash
python /workspace/runpod-train-qwen14b-qlora.py \
  --train /workspace/train_14b_gtm.jsonl \
  --output /runpod-volume/models/empathy-coach-qwen14-merged-v1 \
  --base unsloth/Qwen2.5-14B-Instruct-bnb-4bit \
  --epochs 2 \
  --max-seq-length 4096 \
  --batch-size 1 \
  --grad-accum 8 \
  --lora-r 32 \
  --lora-alpha 32 \
  --lr 1e-4
```

Expect merged weights under:

`/runpod-volume/models/empathy-coach-qwen14-merged-v1` (~28GB class, 16-bit merge).

---

## 3. Smoke on the pod (before kill)

Quick vLLM or Unsloth generate:

1. Phase One: user mentions desk stuckness → no World Mental Health Day / invented names.
2. Short reply (1–3 sentences, one question).
3. Exact-target style: model should follow tight instructions better than 7B.

---

## 4. Terminate train pod

```text
pod-action stop → delete-pod
```

Do this **immediately** after merge + smoke. Serving stays on Serverless (scale-to-zero).

---

## 5. Serverless cutover

On the Serverless endpoint worker env:

- `MODEL_NAME=/runpod-volume/models/empathy-coach-qwen14-merged-v1`
- `OPENAI_SERVED_MODEL_NAME_OVERRIDE=empathy-coach-qwen14`
- Confirm `min workers = 0`

On Vercel:

- `VLLM_MODEL=empathy-coach-qwen14`
- Keep Groq fallback + `RUNPOD_FALLBACK_AFTER_MS`

Smoke https://shifted-ai-mauve.vercel.app — check `generation_metadata.provider`.

---

## 6. Continued training (batch only)

After Simon/Louise feedback batches:

1. `npm run export:simon-training`
2. Drop any other-laptop JSONL into `data/sft/external/`
3. `npm run merge:training-corpus`
4. Spin a **new** short pod → train → merge as `…-v2` → swap → **kill pod**

Do not keep GPU warm between batches.

---

## Related

- Export stack: `docs/SUPER-PROMPT-TRAINING-FULL-STACK.md`
- Serving decision: `docs/GROQ-VS-RUNPOD-DECISION.md`
- Runtime guards: `skills/humanCoachVoice.cjs`, exact-target in `skills/regenerationHelpers.cjs`
