# ShiftED missing-hunt — old Windows laptop

**NO JULY 7B WEIGHTS FOUND ON THIS MACHINE**

**Machine:** Windows 10/11 NT 10.0.26200 · PowerShell 5.1  
**Date:** 2026-11-18  
**Disk:** C: only (`Windows-SSD` ~475 GB, ~22 GB free) — no external / USB volumes mounted  
**Note:** Hunt adapted from macOS checklist (`mdfind`/`sw_vers`/`/Volumes`) to Windows equivalents.

---

## Executive verdict

| Priority | Result |
|----------|--------|
| **P0 July 7B merge / LoRA / checkpoints** | **NOT FOUND** — no `*.safetensors`, no `adapter_config.json`, no `empathy-coach-qwen-merged*` tree |
| **P1 extra Simon JSONL beyond Jun 19 221-line export** | **NOT FOUND** — only duplicates of known `train_simon_feedback.jsonl` |
| **P1 meeting / feedback docs in Downloads** | **FOUND** — copied to FINDS |
| **P2 July-era skills + prompt export** | **FOUND** in repo (mtimes Jul 2026) — copied to FINDS (Mac may already have these) |
| **P2 redacted endpoint/model notes** | **FOUND** in docs / `.env.example` — written to FINDS |
| **P3 HF / Docker / runpodctl / Time Machine / external disk** | **NOT FOUND** for July merge |

This laptop never held the multi‑GB RunPod volume contents. Docs say weights lived on `salty_sapphire_parakeet_volume` only.

---

## Phase 1 — Machine inventory (evidence)

### OS / disk

```
Microsoft Windows NT 10.0.26200.0
Drive C: Used ~453 GB / Free ~22 GB
Volumes: C: Windows-SSD only (no D:/E:/USB)
```

### Desktop / Documents / Downloads

- Desktop: empty (aside from hunt outputs created this session)
- Documents: near-empty (`reset.txt` + library links)
- Downloads: many project folders; ShiftED PDFs/docx + Recoverable zip present

### Directory name hits (`empathy|shifted|qwen|lora|unsloth|runpod|salty`, depth≤4)

| Path | Relevance |
|------|-----------|
| `...\empathy-coach-ai` | Main repo |
| `C:\Users\attia\runpod-tts-pipeline` | TTS project — **not** coach 7B |
| `...\lmstudio-community\Qwen3.5-9B-GGUF` | Incomplete GGUF **parts** (~16–20 MB), Mar 2026 — **not** July merge |
| `...\fonts\lora` | Font family — ignore |
| VALORANT paths | Name false positive — ignore |

### Weight-like files

Targeted `dir /s /b *.safetensors` on:

`.cache`, `.lmstudio`, `runpod-tts-pipeline`, Downloads, Desktop, Documents, AppData huggingface/torch

**Result: ZERO hits in every root checked.**

Full-home `*.safetensors` scan: **TIMEOUT after 90s** (OneDrive recursion); combined with targeted zeros + 22 GB free disk (a ~14 GB merge would be tight/unlikely left behind), confidence is high that July weights are absent.

`adapter_config.json`: **ZERO** in same targeted roots.

### HF hub cache (`%USERPROFILE%\.cache\huggingface\hub`)

Present:

- `models--Systran--faster-whisper-base`
- `models--Systran--faster-whisper-small`
- `models--nari-labs--Dia-1.6B-...`

**No** `empathy-coach-qwen`, `merged`, or `salty` entries.

### RunPod / Docker

- `runpodctl`: not installed
- `~/.runpod`: not present
- `docker`: not available / no images matching qwen|empathy|vllm|unsloth
- `huggingface-cli`: not installed

### Cloud / external

- No Google Drive / Dropbox / iCloud roots found under typical paths
- OneDrive present (hosts the repo) — no weight trees discovered by name search
- No non-system volumes mounted

### Git (empathy-coach-ai)

```
origin  https://github.com/aliattia10/empathy-coach-ai.git
tags: (none listed)
git lfs: no tracked safetensors observed
```

Recent commits are feature/UI/prompt work — no weight commits.

### Documented historical IDs (from markdown only — not files on disk)

| ID | Source |
|----|--------|
| Volume `salty_sapphire_parakeet_volume` | TRANSFER README, GROQ-VS-RUNPOD-DECISION |
| Path `/runpod-volume/models/empathy-coach-qwen-merged-v1` (~14 GB) | same |
| Endpoint `dwmwweatrhzys4` | TRAIN-ON-SIMON-FEEDBACK.md |
| Endpoint `ukbtc1h97b7y7h` | TRANSFER README |
| Served name `empathy-coach-qwen` | `.env.example` comment / server example |

---

## Phase 2 — Candidate classification table

| path | size | mtime | 7B vs 14B? | type | sha256 | copy to FINDS? |
|------|------|-------|------------|------|--------|----------------|
| *(no merge/adapter tree)* | — | — | — | — | — | N/A |
| `train_simon_feedback.jsonl` (repo) | 11,384,877 B | 2026-06-19 | n/a | jsonl (known Jun export, 221 lines) | `2B013FABD529D04CB959BBF0C88B47C4373C41BF5D096C3BAD888B5A7B157ED3` | **No** — Mac already has |
| TRANSFER / snapshot duplicates of same JSONL | same | same | n/a | jsonl duplicate | same | No |
| Manus `chunks.jsonl` / manifests | various | 2026-08-13 | n/a | knowledge scrape | not hashed | No — already in Recoverable zip |
| Downloads July meeting docx ×3 | ~11 KB each | Jul 8–22 2026 | n/a | meeting notes | — | **Yes** P1 |
| `ShiftED_AI_LLM_Training_Feedback_Prompt.(docx\|pdf)` | ~11–78 KB | 2026-04-21 | n/a | Simon feedback prompt template | — | **Yes** P1 |
| ShiftED AI PDFs (requirements / deck) | ~0.2–2.1 MB | Feb–Jul 2026 | n/a | stakeholder docs | — | **Yes** P1 |
| `skills/*.cjs` Jul mtimes | ~3–12 KB | Jun–Jul 2026 | n/a | prompt stack | — | **Yes** P2 (evidence pack) |
| `docs/exports/ShiftED-Internal-Coach-System-Prompt.*` | ~25–30 KB | 2026-07-31 | n/a | prompt export | — | **Yes** P2 |
| LM Studio Qwen3.5-9B `.part` | ~16–20 MB | 2026-03-24 | neither (9B GGUF incomplete) | other | not hashed | Note only P3 |
| HF whisper / Dia caches | — | 2025–2026 | n/a | unrelated | — | Note only |

---

## Phase 3 — Package contents

Created:

- `C:\Users\attia\Desktop\ShiftED-MISSING-FINDS\`
- `C:\Users\attia\Desktop\ShiftED-MISSING-HUNT-20261118.md` (this file)
- `C:\Users\attia\Desktop\ShiftED-MISSING-HUNT-20261118-ANSWERS.md`
- `C:\Users\attia\Desktop\ShiftED-MISSING-FINDS.zip`

FINDS layout:

```
P0_weights_NONE/README.txt
P1_docs_meetings/          ← July Gemini meeting notes + ShiftED PDFs
P1_feedback_prompt/        ← Simon training feedback prompt docx/pdf
P2_env_notes_redacted/     ← endpoint/model names, no secrets
P2_prompt_skills_snapshot/ ← Jul skills + 31 Jul prompt export
P3_other/                  ← HF + LMStudio negative evidence notes
```

---

## What would still help tone on 14B (without 7B weights)

From this machine, the only incremental value beyond the Recoverable zip / Mac pack:

1. **July weekly meeting Gemini notes** (8 / 15 / 22 Jul) — product intent for protocol  
2. **Simon LLM Training Feedback Prompt** (Apr) — how Simon was instructed to review  
3. **Redacted historical endpoint IDs** — for archaeology only, not restore  

No weight file here can restore July LoRA voice.
