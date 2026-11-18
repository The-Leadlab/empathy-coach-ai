# SUPER PROMPT — Paste into Cursor / Claude on the OLD laptop

**How to use:** On the old laptop, open a new Cursor chat in any folder (Desktop is fine). Copy **everything inside the fenced block below** (from `You are helping…` through the last line). Paste once. Do not edit. Let it run to the end.

A Desktop copy also lives at: `~/Desktop/COPY-PASTE-ON-OLD-LAPTOP-Gather-Prompt.md` (on the new Mac — AirDrop that file if easier).

---

```
You are recovering everything still MISSING for ShiftED / Empathy Coach that may exist only on THIS old laptop.

Do not invent files. Do not claim weights exist without `ls` + size + sha256. Prefer shell evidence over memory.

════════════════════════════════════════
WHAT THE NEW MAC ALREADY HAS (do NOT waste time re-copying unless newer)
════════════════════════════════════════
- Simon JSONL Jun 19: train_simon_feedback.jsonl (221 lines) — already transferred
- July prompts / skills snapshots / HOW_THE_SYSTEM_WORKS
- Current 14B merge + LoRA checkpoints (qwen14) — IGNORE these; we do not need 14B from this machine
- Supabase live data (chats, 32 feedback rows, 1 star) — already exported on new Mac
- Gap-close code (90s RunPod wait, condensed July tone, Handshake KB gate) — already on new Mac

════════════════════════════════════════
WHAT IS STILL MISSING (priority order — find ALL of these)
════════════════════════════════════════
P0 — MODEL WEIGHTS (highest value; deleted from RunPod volume salty_sapphire_parakeet_volume)
  • July 7B merge: names like empathy-coach-qwen, empathy-coach-qwen-merged-v1, *merged* without "14"
  • July LoRA / Unsloth adapters: adapter_model.safetensors + adapter_config.json near july/simon/qwen (7B)
  • Any checkpoint-* folders from July training (trainer_state.json, optimizer optional)
  • Tokenizer / chat_template sitting next to that merge
  • Hugging Face hub cache copies of the same
  • Docker / runpodctl / vLLM local downloads of that model
  Historical IDs (search strings): dwmwweatrhzys4, salty_sapphire, empathy-coach-qwen (NOT qwen14), lo3n0gefun is NEW — skip

P1 — TRAINING / FEEDBACK ARTIFACTS newer or different than the Recoverable zip
  • Extra *.jsonl (simon, starred, feedback, sft, train_*) not already in TRANSFER-TO-MACBOOK packs
  • wandb / mlflow / tensorboard / unsloth logs for july runs
  • Screenshots or docs of July eval / Simon blind tests
  • Private HF repo names or clone leftovers (do NOT print tokens)

P2 — PROMPT / CODE SNAPSHOTS that never made it to the new Mac
  • Older coachSystemPrompt, llmEnginePhases, skillsLibrary, chat.js from Jul 2026
  • .env.example or notes listing July VLLM_MODEL / endpoint (redact keys)
  • Any "Recoverable" / "TRANSFER" / "llm-training" folders not yet zipped

P3 — BACKUPS OUTSIDE the main project
  • Time Machine local snapshots, external disks, USB, Google Drive / Dropbox / iCloud mirrors
  • Email Downloads: zip/tar with qwen, lora, merged, empathy, shifted
  • Browser download history folders if accessible

════════════════════════════════════════
OUTPUT (create these on Desktop)
════════════════════════════════════════
1. Report:  ~/Desktop/ShiftED-MISSING-HUNT-$(date +%Y%m%d).md
2. Finds:   ~/Desktop/ShiftED-MISSING-FINDS/   (copy candidates here; preserve relative structure)
3. Zip:     ~/Desktop/ShiftED-MISSING-FINDS.zip  (finds folder + the hunt md)

Also write a short checklist file:
  ~/Desktop/ShiftED-MISSING-HUNT-$(date +%Y%m%d)-ANSWERS.md
with Yes/No + path for every question in PHASE 4.

════════════════════════════════════════
PHASE 1 — MACHINE INVENTORY (run and paste key evidence into the hunt md)
════════════════════════════════════════
Run:
  uname -a; sw_vers 2>/dev/null; df -h
  ls -lah ~/Desktop ~/Documents ~/Downloads 2>/dev/null | head -80

Find project / training trees:
  mdfind "kMDItemFSName == '*empathy*'c" 2>/dev/null | head -150
  mdfind "kMDItemFSName == '*shifted*'c" 2>/dev/null | head -150
  mdfind "kMDItemFSName == '*qwen*'c" 2>/dev/null | head -150
  find ~ -maxdepth 5 -type d \( -iname '*empathy*' -o -iname '*shifted*' -o -iname '*qwen*' -o -iname '*lora*' -o -iname '*unsloth*' \) 2>/dev/null | head -300

Find weight-like files (path + human size). Cap listing at 300 hits; do not hang forever:
  find ~ -type f \( -iname 'adapter_model.safetensors' -o -iname 'adapter_config.json' -o -iname 'model*.safetensors' -o -iname 'pytorch_model*.bin' -o -iname 'model.safetensors.index.json' \) 2>/dev/null | head -300

For EVERY interesting hit, also:
  ls -lah "$(dirname PATH)"
  # and note mtime

Hugging Face / caches:
  ls -lah ~/.cache/huggingface/hub 2>/dev/null | head -100
  find ~/.cache/huggingface ~/.cache/torch ~/.cache/huggingface/transformers -iname '*empathy*' -o -iname '*qwen*merged*' -o -iname '*salty*' 2>/dev/null | head -200

RunPod / Docker leftovers:
  which runpodctl; runpodctl --help >/dev/null 2>&1; ls -lah ~/.runpod 2>/dev/null
  docker volume ls 2>/dev/null; docker images 2>/dev/null | egrep -i 'qwen|empathy|vllm|unsloth' || true

External volumes (if any mounted):
  ls /Volumes
  # For each non-system volume, find maxdepth 5 for same name patterns (timeout 120s per volume)

Cloud sync roots if present:
  find ~/Library/CloudStorage ~/Google\ Drive* ~/Dropbox ~/iCloud* -maxdepth 4 -iname '*empathy*' 2>/dev/null | head -100
  find ~/Library/CloudStorage ~/Google\ Drive* ~/Dropbox -maxdepth 6 \( -iname '*merged*' -o -iname '*lora*' -o -iname '*qwen*' \) 2>/dev/null | head -100

Git LFS / remotes in every empathy|shifted repo found:
  git remote -v; git tag -l; git lfs ls-files 2>/dev/null | head -50
  git log --oneline --all --grep=july -i 2>/dev/null | head -20
  git log --oneline --all -- '*safetensors' 2>/dev/null | head -20

HF CLI (no secrets):
  command -v huggingface-cli; huggingface-cli whoami 2>/dev/null || true
  # List only repo NAMES if cached: ls ~/.cache/huggingface/hub | egrep -i 'empathy|qwen' || true
  # DO NOT print tokens or .env values

════════════════════════════════════════
PHASE 2 — CLASSIFY EACH CANDIDATE
════════════════════════════════════════
For each candidate file/folder, add a table row in the hunt md:

| path | size | mtime | 7B vs 14B? | type (merge/adapter/jsonl/prompt/other) | sha256 (largest safetensors or adapter only) | copy to FINDS? |

Rules:
- If name/path contains 14 / qwen14 / empathy-coach-qwen14 → mark SKIP (unless literally nothing else exists — then note as "14B leftover only")
- Prefer July / jun / simon / merged-v1 / salty / 7b
- sha256: `shasum -a 256 FILE | awk '{print $1}'` — one hash per weight tree is enough

════════════════════════════════════════
PHASE 3 — PACKAGE
════════════════════════════════════════
mkdir -p ~/Desktop/ShiftED-MISSING-FINDS

Copy into FINDS (do not move originals):
- All P0 weight/adapter trees that look July/7B
- Any NEW jsonl / prompt snapshots not clearly duplicates of the Recoverable transfer
- A REDACTED note of July endpoint/model env names if found (strip API keys)

Then:
  cd ~/Desktop
  zip -r ShiftED-MISSING-FINDS.zip ShiftED-MISSING-FINDS ShiftED-MISSING-HUNT-*.md

If FINDS is empty of weights, the hunt md MUST say in bold at the top:
  **NO JULY 7B WEIGHTS FOUND ON THIS MACHINE**

════════════════════════════════════════
PHASE 4 — ANSWER YES/NO WITH EVIDENCE (ANSWERS.md)
════════════════════════════════════════
1. Local copy of July 7B merge?
2. July LoRA that can re-attach to Qwen2.5-7B-Instruct?
3. HF cache copy of that merge/adapter?
4. Docker / runpodctl leftover of that model?
5. External disk / Time Machine hit?
6. Private HF repo that might still host it? (name only)
7. Extra Simon/training JSONL beyond the known 221-line Jun export?
8. Older July prompt/skills files not in the Recoverable zip?
9. wandb/mlflow july run artifacts?
10. Anything else that would improve tone/similarity on the new 14B without the 7B weights?

════════════════════════════════════════
CONSTRAINTS
════════════════════════════════════════
- Do NOT delete, overwrite, or upload secrets
- Redact API keys, tokens, passwords everywhere
- Do NOT confuse 14B with July 7B
- Do NOT stop after the first empty find — finish all phases
- If a command will take >5 minutes, run with a timeout and report partial results

════════════════════════════════════════
HANDOFF LINE (say this to the human when done)
════════════════════════════════════════
AirDrop or USB to the new Mac:
  ~/Desktop/ShiftED-MISSING-FINDS.zip
Then on the new Mac open the empathy-coach-ai Cursor chat and say:
  "Old laptop missing-hunt results attached — see Desktop ShiftED-MISSING-FINDS.zip"
```

---

## After you get the zip on the new Mac

1. Put it in `models/archives/july-7b-recover/` (create folder if needed).  
2. Tell the new-laptop agent the path.  
3. If adapters/merge found → restore or distill. If empty → July weights are gone; keep improving 14B only.
