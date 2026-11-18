# ShiftED missing-hunt — Yes/No answers (PHASE 4)

**Machine:** old Windows laptop · **Date:** 2026-11-18  
Evidence details: `ShiftED-MISSING-HUNT-20261118.md`

| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 1 | Local copy of July 7B merge? | **No** | Targeted `*.safetensors` = ZERO under `.cache`, `.lmstudio`, Downloads, Desktop, Documents, `runpod-tts-pipeline`. No folder named `empathy-coach-qwen-merged*`. Disk free ~22 GB; docs say merge was ~14 GB **on RunPod volume only**. |
| 2 | July LoRA that can re-attach to Qwen2.5-7B-Instruct? | **No** | Zero `adapter_config.json` / `adapter_model.safetensors` in same roots. |
| 3 | HF cache copy of that merge/adapter? | **No** | Hub lists only faster-whisper + Dia-1.6B. Path: `%USERPROFILE%\.cache\huggingface\hub`. |
| 4 | Docker / runpodctl leftover of that model? | **No** | `runpodctl` not installed; no `~/.runpod`; Docker unavailable / no matching images. |
| 5 | External disk / Time Machine hit? | **No** | Only volume C:; no USB mounted; Windows (no Time Machine). |
| 6 | Private HF repo that might still host it? (name only) | **Unknown / none local** | No `huggingface-cli`; no local hub folder names suggesting a private empathy-coach merge repo. Remotes: only `github.com/aliattia10/empathy-coach-ai.git`. |
| 7 | Extra Simon/training JSONL beyond known 221-line Jun export? | **No** | Only `train_simon_feedback.jsonl` / `train.jsonl` (+ transfer + snapshot copies). SHA256 `2B013FABD529D04CB959BBF0C88B47C4373C41BF5D096C3BAD888B5A7B157ED3`, 221 lines, 2026-06-19. Manus scrape JSONL is knowledge crawl, not Simon SFT. |
| 8 | Older July prompt/skills files not in the Recoverable zip? | **Mostly no / already covered** | Live `skills/*.cjs` mtimes Jun–Jul 2026 and 31 Jul prompt export were already packaged in Recoverable zip. Copied again into FINDS for convenience. **Extra vs Recoverable:** July Gemini meeting notes + Simon feedback-prompt docx/pdf from Downloads. |
| 9 | wandb/mlflow july run artifacts? | **No** | No `wandb/`, `mlruns/`, `runs/` under empathy-coach-ai. |
| 10 | Anything else that would improve tone/similarity on new 14B without 7B weights? | **Yes — docs only** | (a) Jul 8/15/22 meeting Gemini notes; (b) `ShiftED_AI_LLM_Training_Feedback_Prompt`; (c) continue July prompt-depth + hard gates on 14B; (d) retrain/light SFT from known JSONL if needed — still not the deleted binary. |

---

## Handoff

AirDrop or USB to the new Mac:

`C:\Users\attia\Desktop\ShiftED-MISSING-FINDS.zip`

Then on the new Mac open the empathy-coach-ai Cursor chat and say:

> Old laptop missing-hunt results attached — see Desktop ShiftED-MISSING-FINDS.zip
