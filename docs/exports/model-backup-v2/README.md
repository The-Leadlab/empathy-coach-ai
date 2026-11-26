# ShiftED model backup — Qwen2.5-14B merged v2

**Do not upload the weight files to the public GitHub repo** (`The-Leadlab/empathy-coach-ai`). They are gitignored under `models/` (~28 GB).

## What is backed up on this Mac

| Item | Path |
|------|------|
| Merged weights (complete, verified) | `/Users/attia/Desktop/Paginas web/New folder/empathy-coach-ai/models/empathy-coach-qwen14-merged-v2` |
| Checksums | `SHA256SUMS.txt` (this folder) |
| Live RunPod volume | `lo3n0gefun` (`empathy-coach-phase3`, EU-RO-1) |
| Path on volume | `/runpod-volume/models/empathy-coach-qwen14-merged-v2` |
| Serverless endpoint | `ukbtc1h97b2y2h` |

## Verify integrity

```bash
cd "/Users/attia/Desktop/Paginas web/New folder/empathy-coach-ai/models/empathy-coach-qwen14-merged-v2"
shasum -a 256 -c "/Users/attia/Desktop/ShiftED-MODEL-BACKUP-v2/SHA256SUMS.txt"
```

## Restore to a new RunPod volume (if current volume is lost)

1. Create a new network volume in **EU-RO-1** (same region as the endpoint).
2. Attach a GPU pod with that volume mounted at `/runpod-volume`.
3. Upload or `rsync` the local folder to `/runpod-volume/models/empathy-coach-qwen14-merged-v2`.
4. Point Serverless `MODEL_NAME` at that path; keep `OPENAI_SERVED_MODEL_NAME_OVERRIDE` as needed.
5. Redeploy / restart workers.

## Why not GitHub for the weights

GitHub (even LFS / Releases) is a poor home for a 28 GB merge: quotas, slow, and the public coach repo must stay free of secrets and giant binaries. Keep weights on **this laptop + RunPod volume**; keep only this **index card** in GitHub private docs if desired.

## Private vault (chat without Groq)

| Layer | Where |
|-------|--------|
| Live serve (Option 5) | Mac MLX 4-bit + session scripts — [`docs/MAC-VAULT-SESSION.md`](../../MAC-VAULT-SESSION.md) |
| Start / stop | `bash scripts/start-mac-vault-session.sh` / `bash scripts/stop-mac-vault-session.sh` |
| App | Netlify `LLM_PROVIDER=vault` + `VAULT_LLM_*` + `COACH_DISABLE_FALLBACK=1` |
| MLX weights | `models/empathy-coach-qwen14-merged-v2-mlx-4bit` (~8GB, local) |
| Cold storage only | **Private** HF `Virtualy/empathy-coach-qwen14-merged-v2` (`scripts/upload-model-to-private-hf-sequential.py`) — not for live serve |
| Not used | Public HF Space / community GPU grant (withdrawn); free ZeroGPU create blocked (402); Modal; RunPod for coach |
| Training archive | RunPod volume `lo3n0gefun` (leave in place) |

Operator doc: [`docs/MAC-VAULT-SESSION.md`](../../MAC-VAULT-SESSION.md).

## V3 training — keep this backup forever

Do **not** overwrite this merge when training V3. New folders only (`*-merged-v3`). Full policy: [`docs/MODEL-CHECKPOINT-BACKUP-V3.md`](../../MODEL-CHECKPOINT-BACKUP-V3.md).

```bash
bash scripts/verify-model-checkpoint-v2.sh
bash scripts/snapshot-model-checkpoint.sh v2
```

## Related

- Admin login card (separate): `~/Desktop/ShiftED-ali-admin-login.txt`
- Timeline: `docs/exports/ShiftED-Project-Timeline-Full.pdf`
