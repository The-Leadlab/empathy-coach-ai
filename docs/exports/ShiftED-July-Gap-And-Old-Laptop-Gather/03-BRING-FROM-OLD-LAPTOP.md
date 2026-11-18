# What to bring from the old laptop (already known + still to hunt)

## Already on THIS laptop (from Recoverable zip / prior transfer)

Do **not** re-copy unless you want a second archive. Verified present:

| Asset | Path on this machine |
|-------|----------------------|
| Simon feedback JSONL (221) | `data/sft/external/llm-training-old/TRANSFER-TO-MACBOOK-LLM-TRAINING/data/train_simon_feedback.jsonl` |
| Old HOW_IT_WORKS / research | Desktop: `ShiftED-old-laptop-snap-20261118/` |
| July skill snapshots | Same snap `05_skills_snapshot_july/` |
| Knowledge scrape (Manus) | Snap `08_knowledge_scrape/` + repo `data/processed/` |
| July full prompt text | Snap `03_prompts_and_skills/` + comparison pack |
| Transfer README / RunPod notes | Snap + `llm-training-old/` |

## Still worth hunting on the OLD laptop (weights + leftovers)

Run **`04-SUPER-PROMPT-OLD-LAPTOP-GATHER.md`** there. Priority targets:

1. Any folder named `empathy-coach-qwen*` **without** `14` in the name  
2. `adapter_model.safetensors` / `adapter_config.json` under July training dirs  
3. Hugging Face cache: `~/.cache/huggingface/hub/*empathy*`  
4. RunPod CLI downloads, `runpodctl`, Docker volumes, Time Machine / external disks  
5. Email / Drive / USB with filenames containing `merged-v1`, `salty`, `qwen-7b`, `lora`  
6. Older Git remotes / private HF repos you may have pushed to  

## Bring back to this laptop if found

Copy into:

```
models/archives/july-7b-recover/
  README.md          # where found, date, size, SHA256
  <weights or adapters>/
```

Then tell the new-laptop agent: path + SHA256. Do **not** overwrite `models/empathy-coach-qwen14-merged-v1`.

## Soft bring (no weights) — do these on THIS laptop now

1. Re-export Supabase feedback + stars → new JSONL  
2. Diff July full prompt vs condensed; restore only Adaptive Escalation / mirror / one-question density that was cut  
3. Keep hard gates (already better than July)  
4. Optional: continued SFT of **14B** on re-exported Jul–Nov gold turns (not a new 7B unless weights found)
