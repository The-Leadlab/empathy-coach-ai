# Old-laptop missing hunt — verdict (18 Nov 2026)

Source: `/Users/attia/Downloads/drive-download-20261118T162735Z-1-001`  
Extracted useful files: `/Users/attia/Desktop/ShiftED-old-laptop-missing-hunt-20261118/`

## July 7B weights

**Confirmed not on the old Windows laptop.** No merge, no LoRA, no HF cache, no Docker/runpodctl leftovers. Docs only: lived on deleted RunPod volume `salty_sapphire_parakeet_volume` at `/runpod-volume/models/empathy-coach-qwen-merged-v1`.

**Close the weight hunt.** Continue July quality via 14B + prompts + gold SFT mix (already prepared).

## What the zip actually contained (useful)

| Item | Action |
|------|--------|
| Jul 8 / 15 / 22 Gemini meeting notes | Extracted → `EXTRACTED-NOTES.md` — decisions already largely in live code (goal-before-tactics, sequential lock, mirroring, Sustainability Path) |
| Simon `ShiftED_AI_LLM_Training_Feedback_Prompt` | Same bar as current coach rules (one question, no jargon, no leading examples, conceptualization first) |
| July skills + 31 Jul prompt export | Already on new Mac / Recoverable pack |
| Redacted endpoint notes | Archaeology only |

## Path forward (unchanged)

1. Deploy gap-close (90s RunPod wait, condensed July tone, Handshake KB gate)  
2. Set `RUNPOD_FALLBACK_AFTER_MS=90000` on Vercel  
3. Optional: train adapter from `data/sft/exports/train_july_match_mix.jsonl`  
4. Simon: star more gold replies (still only 1 in Supabase)
