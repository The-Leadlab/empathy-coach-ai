# Improve current 14B to match July — with Phase 3 kept

**Status (19 Nov 2026 morning):** Continued SFT **v2 is live** on Serverless (`MODEL_NAME` → `empathy-coach-qwen14-merged-v2`). Coach chat is **RunPod-only** (no Groq). Journey voice playback defaults off. Waiting UI says **Thinking** (no GPU copy).

Assumption: July 7B weights stay missing. We close the quality gap on **this** stack.

---

## Done

| Item | Result |
|------|--------|
| P0 wait longer / stop Groq as default voice | Groq removed from coach path; trained 14B only |
| Condensed July / Simon density in live prompt | Shipped earlier (canon + speaking bar) |
| STATES 1–6 + Hot Cross Bun | Live |
| Trainer gold / stars in prompt | Live |
| Continued SFT v2 (221×3 + gold + hard-negs) | Trained, on volume, endpoint pointed |
| Journey mute by default | Live |

---

## New timeline (next)

### Now — verify live feel (1–2 days)

1. Run Simon scripts on production against **v2** (handshake, one question, no jargon, Hot Cross Bun).
2. Star / flag turns that still feel “wrong” vs July — feed `chat_feedback` + `admin_quality_star`.
3. Confirm cold-start still only shows **Thinking** (no backup / GPU messaging).

### Next — quality loop (this week)

1. Export new gold from flagged turns → append to SFT mix (don’t retrain from zero).
2. Keep Phase 3 RAG gated until Handshake; one micro-action max mid-intake.
3. Optional: short continued adapter pass **only** if blind preference vs July still fails on ≥3 scripts.

### Later — only if needed

1. If old-laptop adapters appear → A/B vs current v2 (don’t retrain 7B from scratch).
2. Preference pairs (July teacher → 14B) only after script failures are logged.

---

## Acceptance tests (Simon scripts)

| Check | Target |
|-------|--------|
| Handshake before Goal | 100% |
| Hot Cross Bun order | Coping before Rule |
| Confidence gate | No Goal until ≥7 |
| Questions per turn | ≤1 |
| Clinical jargon | 0 |
| Blind preference (Simon) | ≥ July on 8/10 clips |
| Phase3 pivot on stuck | Present without dumping KB |
| Provider | RunPod 14B v2 only (never Groq) |

---

## What NOT to do

- Re-enable Groq (or any third-party) as coach fallback
- Retrain 7B from scratch “to be July” unless weights/adapters found
- Expand condensed prompt back to full 50k every turn
- Revert Hot Cross Bun to July map order
- Delete Phase 3 to match July surface area
