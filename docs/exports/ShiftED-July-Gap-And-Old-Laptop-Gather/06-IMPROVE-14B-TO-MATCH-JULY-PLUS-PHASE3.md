# Improve current 14B to match July — with Phase 3 kept

**Status (18 Nov 2026 evening):** P0–P2 live in code. Old-laptop hunt closed (**no 7B weights**). July meeting + Simon feedback prompt distilled into `data/july-product-canon.json` and injected via Simon canon. Gold export + SFT mix ready. Admin test user: `ali@admin.com`. Set `RUNPOD_FALLBACK_AFTER_MS=90000` on Vercel + redeploy.

Assumption: July 7B weights stay missing. We close the quality gap on **this** stack.

---

## Priority order (do in sequence)

### P0 — Make live answers sound like July (no train)

1. **Stop Groq from being the default voice**  
   Cold-start / timeout → Wait longer for RunPod 14B; Groq only for crisis/timeout last resort. July feel dies on fallback.

2. **Restore condensed prompt density** from July full archive  
   Bring back into the *live condensed* path (without blowing context):  
   - one-question / plain-language / mirror rules (tight)  
   - Adaptive Escalation: Sustainability Pivot → Architectural Backtrack (short)  
   - tonality / user-similarity bullets from Simon global standards  

3. **Keep hard STATES 1–6** (Hot Cross Bun order, handshake, confidence ≥7, `PHASE_2_GATE_LOCKED`) — these already beat July soft gates.

4. **Re-inject trainer gold every turn**  
   Export all `chat_feedback` where `apply_to_global_instructions` + all `admin_quality_star` messages → ensure prompt builder still loads them with a sane token budget.

### P1 — Knowledge without drowning tone

1. **Do not dump full KB every turn.** Intent-route Phase 3 resources (July research rule: FT=tone, RAG=knowledge, Prompt=orchestration).  
2. Fill or ignore empty Supabase `skills` / `workbooks` — until filled, keep **code** `skillsLibrary` as SSOT.  
3. Phase 3 practice steps: one micro-action; no workbook lecture mid-Handshake.

### P2 — User-similarity data loop

1. Export Jul–Nov Supabase threads that Simon starred or rated high → `data/sft/exports/gold_jul_nov.jsonl`  
2. Diff against `train_simon_feedback.jsonl` — add only **new** gold turns  
3. Optional continued SFT on **14B** (or adapter-only) with mix:  
   - 40% Simon-style short coach turns  
   - 40% Phase3+protocol compliance turns  
   - 20% hard-negative (jargon, multi-question, skipped handshake)  

### P3 — Only if old-laptop hunt finds adapters

1. Merge July LoRA onto base 7B → A/B vs 14B on same Simon scripts  
2. Or use July replies as **teacher** to distill into 14B (preference pairs)

---

## Acceptance tests (Simon scripts)

Same scripts as July testing. Pass when:

| Check | Target |
|-------|--------|
| Handshake before Goal | 100% |
| Hot Cross Bun order | Coping before Rule |
| Confidence gate | No Goal until ≥7 |
| Questions per turn | ≤1 |
| Clinical jargon | 0 |
| Blind preference (Simon) | ≥ July on 8/10 clips |
| Phase3 pivot on stuck | Present without dumping KB |

---

## What NOT to do

- Retrain 7B from scratch “to be July” unless weights/adapters found — expensive, duplicates 14B work  
- Expand condensed prompt back to full 50k every inference turn  
- Revert Hot Cross Bun to July map order (clinical conflict already resolved)  
- Delete Phase 3 to match July surface area
