# Model checkpoint backup — never lose v2 again (V3 train policy)

**Why:** In October a RunPod volume delete wiped the live merge. We will not overwrite `empathy-coach-qwen14-merged-v2` during V3 training.

## Immutable rule

| Rule | Detail |
|------|--------|
| **Never delete** volume `lo3n0gefun` | Keep until a second verified copy exists offline |
| **Never overwrite** `…/merged-v2` | Train and merge into a **new** folder name |
| **Always keep ≥2 copies of the live coach** | Laptop + RunPod (and ideally private HF) |
| **A/B before cutover** | RunPod stays on **v2**; Mac/Netlify vault can trial **v3** |

## Current freeze (v2 — production checkpoint)

| Copy | Path / id |
|------|-----------|
| Laptop full merge (~28 GB) | `models/empathy-coach-qwen14-merged-v2` |
| Laptop MLX 4-bit (~8 GB) | `models/empathy-coach-qwen14-merged-v2-mlx-4bit` |
| RunPod volume | `lo3n0gefun` → `/runpod-volume/models/empathy-coach-qwen14-merged-v2` |
| RunPod endpoint (keep on v2) | `ukbtc1h97b2y2h` |
| Index / checksums | `docs/exports/model-backup-v2/` |
| Optional cold HF | Private `Virtualy/empathy-coach-qwen14-merged-v2` (upload script — do not replace until v2 is verified again) |

## V3 training layout (new paths only)

```
/runpod-volume/models/
  empathy-coach-qwen14-merged-v2/     ← FROZEN (do not touch)
  empathy-coach-qwen14-sft-v3/        ← adapters / checkpoints during train
  empathy-coach-qwen14-merged-v3/     ← new merge when train succeeds
```

Local mirror after download:

```
models/empathy-coach-qwen14-merged-v2/          ← keep
models/empathy-coach-qwen14-merged-v3/          ← new
models/empathy-coach-qwen14-merged-v3-mlx-4bit/ ← after convert
```

## Before any V3 train job

1. Run `bash scripts/verify-model-checkpoint-v2.sh` — must pass.
2. Optional: `bash scripts/snapshot-model-checkpoint.sh v2` — copies restore card + checksums to Desktop dated folder.
3. Confirm endpoint `ukbtc1h97b2y2h` still points at **merged-v2**.
4. Start train writing only under `…-v3` / `…-sft-v3` paths.

## After V3 merge succeeds

1. Download `merged-v3` to the laptop **without deleting v2**.
2. Convert MLX 4-bit to `…-merged-v3-mlx-4bit`.
3. Point **Mac vault** at v3 for trial; leave RunPod endpoint on **v2**.
4. Blind-test North Star (Handshake → Goal → return to Goal).
5. Only then: new endpoint or env switch for RunPod → v3; keep v2 folder forever as rollback.

## Rollback (if V3 is bad)

1. Mac vault: set MLX model path back to `…-merged-v2-mlx-4bit`.
2. RunPod: `MODEL_NAME` back to `…/merged-v2` (folder still on volume).
3. Redeploy app env if you changed `VAULT_*` / model override.

## What Layer-2 fix covers (both “models” in the app)

Local vault (`LLM_PROVIDER=vault` → Mac MLX) and Vercel → RunPod both call the same `netlify/functions/chat.js` + `skills/*`. North Star gates, `repeat_question`, and journey Goal pinning apply to **both** once this code is deployed — weights stay v2 until V3 merge.
