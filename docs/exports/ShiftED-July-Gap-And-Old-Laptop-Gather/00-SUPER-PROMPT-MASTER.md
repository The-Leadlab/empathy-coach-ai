# Super Prompt — Close the July Gap (This Laptop + Old Laptop)

**Date:** 18 November 2026  
**Goal:** Make the **current 14B + Phase 3** system match July quality on **tone, protocol, user-similarity, and knowledge** — without pretending the deleted 7B merge file still exists.

---

## How to use this pack

| File | Who runs it | Purpose |
|------|-------------|---------|
| `01-MISSING-VS-JULY.md` | Ali / Simon (read) | Exact gaps: weights, prompt, data, knowledge, tone |
| `02-DIFFERENCES-AGAIN.md` | Stakeholders | One-page July vs Now vs Old-laptop zip |
| `03-BRING-FROM-OLD-LAPTOP.md` | Ali (this Mac) | Copy list already available from the Recoverable zip |
| `04-SUPER-PROMPT-OLD-LAPTOP-GATHER.md` | **Run on the OLD laptop** | Hunt deleted model + any leftover adapters/checkpoints |
| `05-SUPER-PROMPT-THIS-LAPTOP-AUDIT.md` | **Run on THIS laptop** | Verify local backups, SFT corpora, adapters |
| `06-IMPROVE-14B-TO-MATCH-JULY-PLUS-PHASE3.md` | Engineering plan | Knowledge / tone / similarity / Phase 3 path |

---

## Non-negotiable facts (audited this machine)

1. **July 7B merge is not on this laptop, not in either zip, not on RunPod volumes.**  
2. **This laptop has** `models/empathy-coach-qwen14-merged-v1` (~29 GB) + LoRA adapters at `checkpoints/checkpoint-840` and `checkpoint-1680` (~550 MB each).  
3. **Old-laptop Recoverable zip** has Simon JSONL (**221** examples, Jun 19) — **identical** to `data/sft/external/.../train_simon_feedback.jsonl`.  
4. **14B was already trained** on a much larger mix (`train_14b_gtm.jsonl` = **6716** rows: phase3+simon 4352, expanded simon export 2436, simon 510).  
5. **Supabase** still has live chats (**1159** msgs), feedback (**~32** rows: 22 in Jul, 10 in Nov), stars column exists.  
6. **Git tag** `july-2026-best` → `0de3a31` freezes July app code. Prompt text archives exist in both packs.

**Therefore:** “Match July” = restore **behaviour + data loops + knowledge**, optionally **continued SFT on 14B** — not “undelete salty_sapphire.” Only the old-laptop gather prompt can still find a hidden weight backup.
