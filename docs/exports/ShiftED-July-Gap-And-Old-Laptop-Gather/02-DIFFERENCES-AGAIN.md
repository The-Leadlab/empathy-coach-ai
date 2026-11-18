# Differences again — July vs Now vs Old-laptop Recoverable zip

## Model binary

| | July live | Now (Vercel) | Old-laptop zip |
|--|-----------|--------------|----------------|
| Base | Qwen2.5-**7B** | Qwen2.5-**14B** | No weights |
| Name | `empathy-coach-qwen` | `empathy-coach-qwen14` | — |
| Volume | `salty_sapphire…` **DELETED** | `lo3n0gefun` | — |
| Endpoint | `dwmwweatrhzys4` | `ukbtc1h97b2y2h` | — |
| Local weights | Gone from RunPod | ~29G merge + 2 LoRA ckpts | None in zip |

## Protocol

| | July | Now |
|--|------|-----|
| Phases | Soft Phase1/2/3 + Adaptive Escalation in prompt | Soft phases **+** hard STATES 1–6 |
| Hot Cross Bun order | Trigger→Rule→Belief→Strength→Coping | Trigger→**Coping**→Rule→Belief→Strength |
| Confidence | Soft “≥7” text | Hard gate + `PHASE_2_GATE_LOCKED` |
| Handshake | Soft | Hard |

## Training data

| Corpus | Lines | Where |
|--------|------:|------|
| Simon Jun 19 | 221 | Old zip + this repo (same SHA) |
| train.jsonl | 4128 | This repo |
| phase3+simon clean | 4183 | This repo |
| **14B GTM train** | **6716** | This repo (used for current FT) |

## Live ops

| | July | Now |
|--|------|-----|
| Host | Netlify era in old docs | **Vercel** |
| Inference | RunPod primary | RunPod + **heavy Groq fallback** |
| Supabase project | Same family | `wxxwxvauseqftyorhkkp` |

## Old zip vs This Mac comparison pack

| Content | Old Recoverable zip | July-vs-Now Comparison Pack |
|---------|---------------------|-----------------------------|
| HOW_THE_SYSTEM_WORKS | Yes | Overlaps with restore brief |
| Simon JSONL | Yes | Point to repo copy |
| July full prompt archive | Yes (`coachSystemPrompt-FULL.txt`) | Yes (`current-full` + July extract) |
| Skills Jul snapshot | Yes | Diffed in pack |
| Weights | **No** | **No** |
| Supabase live | No (export script only) | Counts audited live |
| Git tag | Documented | `july-2026-best` |
