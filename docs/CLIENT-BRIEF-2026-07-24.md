# ShiftED AI — Client Brief

**Date:** 24 July 2026  
**Prepared by:** Ali Attia (automated weekly assessment)  
**Repo:** empathy-coach-ai · branch `main`  
**Live stack:** React/Vite frontend · Netlify hosting · Supabase auth/data · RunPod vLLM (fine-tuned Qwen2.5-7B) with Groq fallback

---

## Executive summary

ShiftED AI is a **working MVP** for manager empathy coaching: authenticated users can run **multi-journey coaching sessions** with a **three-phase AI protocol**, **task tracking**, **sustainability-path UI**, **trainer quality controls**, and **document upload**. The product is strongest on **chat + journey persistence + trainer feedback loop**.

The main gap is **not missing infrastructure** — it is **locking the coaching protocol** (team review + Simon testing) before fine-tuning, analytics, voice, and avatar work pay off. Several UI surfaces (survey, progress dashboard) are **built but not wired** into the live navigation.

---

## What has been done

### Core platform (shipped)

| Area | Status | Notes |
|------|--------|-------|
| Auth & accounts | ✅ Shipped | Supabase email/password |
| Landing page | ✅ Shipped | `/` marketing entry |
| Multi-journey dashboard | ✅ Shipped | `/testing/journeys` — create, rename, delete, continue threads |
| Session workspace | ✅ Shipped | Per-journey tasks + sustainability path |
| AI coach chat | ✅ Shipped | Text + basic browser voice/STT |
| Phase 1–3 engine | ✅ Shipped | Adaptive Escalation Loop; journey state persisted in DB |
| Goal ladder & tasks | ✅ Shipped | Coach-suggested tasks sync from chat; user can add/reorder/complete |
| Crisis safety | ✅ Shipped | Fixed escalation message; GDPR consent modal |
| Admin trainer panel | ✅ Shipped | `/adminchat` — monitor sessions, star replies, export transcripts, translate |
| Global trainer feedback | ✅ Shipped | Simon's saved feedback affects all users on next message |
| Quality-star exemplars | ✅ Shipped | Starred replies injected into live prompt |

### Recent delivery (15–21 Jul 2026)

| Feature | Shipped |
|---------|---------|
| Guidance ladder widget (visible protocol steps) | ✅ 20 Jul |
| Sustainability Path right rail (unlockable skill nodes) | ✅ 20 Jul |
| Belief before/after tracking in session | ✅ 20 Jul |
| Transcript download for all users (PDF/TXT) | ✅ 20 Jul |
| Full-width session layout | ✅ 20 Jul |
| Reorderable / completable tasks & sustainability items | ✅ 20 Jul |
| PDF, Word, and transcript upload in chat | ✅ 20 Jul |
| Context-limit hardening (message packing, upload handling) | ✅ 21 Jul |
| Remove artificial upload caps | ✅ 21 Jul |

### AI / infrastructure (shipped or operational)

| Area | Status | Notes |
|------|--------|-------|
| Super-prompt stack | ✅ Live | Coach rules, phases, skills, journey context, trainer rules |
| RunPod async inference | ✅ Live | Scale-to-zero; cold-start spinner in UI |
| Fine-tuned model v1 | ✅ Deployed | Qwen2.5-7B + LoRA (~221 training turns) |
| Training export pipeline | ✅ Ready | `export-training-simon-feedback.js` uses same prompt builder as production |
| Knowledge base protocol doc | ✅ Drafted | `docs/KNOWLEDGE-BASE-PROTOCOL.md` — awaiting team sign-off |
| Feature backlog & timeline | ✅ Maintained | `docs/FEATURE-BACKLOG-AND-TIMELINE.md` |

### Documentation & ops

- 16 super-prompt guides covering coach behaviour, admin, training, RunPod, crisis, uploads, etc.
- Cloud/voice/avatar budget roadmap (`docs/NEXT-STEPS-AND-BUDGET.md`)
- Groq vs RunPod decision doc with hybrid recommendation
- Production build verified (24 Jul 2026)

---

## What is left to do

### Priority 1 — Coach brain (blocking everything else)

| ID | Item | Status | Owner |
|----|------|--------|-------|
| P1.1 | Goal gate — no homework/skills until clear outcome agreed | In progress | Ali |
| P1.2 | Plain-language mirroring (no clinical jargon) | In progress | Ali |
| P1.3 | Knowledge base protocol — team review & sign-off | In progress | Ali → Group |
| P1.4 | Live protocol walkthrough with Kara | Not started | Kara |
| P1.5 | Simon screenshot/feedback loop on live replies | Ongoing | Simon |
| P1.6 | Sequential stage lock — stop re-looping earlier phases | In progress | Ali |

**Team decision (8 Jul):** Implement stages → tone → skills **in that order**. Changing all three at once causes rework.

### Priority 2 — Journeys & progress UI

| ID | Item | Status |
|----|------|--------|
| P2.3 | Session milestone checklist fully visible in session | Partial (Guidance Ladder shipped; polish/testing ongoing) |
| P2.4 | Wire survey + analytics dashboard into app navigation | **Not wired** — pages exist (`SurveyPage`, `ProgressPage`, `OnboardingPage`) but routes removed from `App.tsx`; sidebar links are stale |
| P2.5 | Cross-journey progress overview | Not started |

### Priority 3 — Trainer quality & model

| ID | Item | Status |
|----|------|--------|
| P3.3 | Retrain model on Simon-reviewed conversations | Blocked on P1 protocol sign-off |
| P3.4 | Side-by-side test: fine-tuned vs Groq 70B | Not started (target Aug) |

### Priority 4 — Voice & avatar (after protocol stable)

| ID | Item | Status |
|----|------|--------|
| P4.1 | Reliable production LLM (RunPod + Groq hybrid) | Ongoing |
| P4.2 | Basic STT (browser) | Shipped |
| P4.3 | Production TTS (ElevenLabs / Deepgram etc.) | Not started (target Aug) |
| P4.4 | Visible avatar with lip-sync | Not started (Sep+) |
| P4.5 | Roleplay mode ("Alex" character) | Not started (Sep+) |

### Priority 5 — Platform roadmap (Miro vision)

| ID | Item | Status |
|----|------|--------|
| P5.1 | Wellbeing check on login path | Survey built; not on main user flow |
| P5.2 | Recommended training paths from survey | Not started |
| P5.3 | Analytics dashboard (3 emotional skill areas) | Not started |
| P5.4 | Automatic empathy/validation scoring | Not started |
| P5.5 | Reflection tool (alternative responses) | Not started |
| P5.6 | Admin UI to edit skills in DB | Not started (after KB approved) |

### Priority 6 — Other owners

| ID | Item | Owner | Status |
|----|------|-------|--------|
| P6.1 | Marketing website improvements | Louise | In progress |
| P6.2 | Supabase technical issues | Louise | In progress |

### Deferred / blocked

- **P1.9** Italian + German language options — deferred
- **P1.10** Four external calendars (Spinella) — blocked on Joshua/Trello links
- **Revolving-door stage tabs** — deferred until core engine is stable (15 Jul decision)

---

## Bottleneck issues

### 1. Protocol sign-off (highest impact)

The knowledge base and three-phase playbook are drafted but **not yet locked by the team**. Until Simon/Kara sign off:

- Prompt changes risk rework
- Model retrain (P3.3) should not proceed
- Skills admin UI (P5.6) is premature
- Marketing can only claim "beta quality" coaching

**Mitigation:** Finish P1.1–P1.6; hold Friday testing cadence with Simon; Kara walkthrough (P1.4).

### 2. Trainer feedback throughput

Fine-tuning quality depends on **Simon’s ongoing review** (screenshots, saved feedback, starred exemplars). Export pipeline expects **100+ training conversations**; current corpus is ~221 turns but needs continuous growth as protocol evolves.

**Mitigation:** Simon saves feedback (not just regenerate preview); weekly export count check via `npm run export:simon-training:count`.

### 3. RunPod reliability vs product demos

Self-hosted inference has **cold starts (1–3+ min)**, occasional **GPU unavailability**, and **worker restarts**. App mitigates with async jobs + warming UI, but demos suffer if endpoint is cold.

**Mitigation (documented):** Hybrid strategy — **Groq `llama-3.3-70b-versatile` for demos/reliability**; **RunPod fine-tuned model for quality differentiation**. Switch via Netlify env vars only.

### 4. Context window pressure (recurring)

Long chat history + full super prompt + uploaded documents repeatedly hit **token limits**. Jul 21 fixes improved packing and removed upload caps, but this will resurface with large PDFs and long journeys.

**Mitigation:** Continue smart truncation; consider summarisation layer for old turns; monitor per-session token usage.

### 5. Built-but-unlinked UI (quick win)

`SurveyPage`, `ProgressPage`, and `OnboardingPage` exist. `AppSidebar` still links to `/testing/survey` and `/testing/dashboard`, but **`App.tsx` only routes journeys + chat + admin**. Users cannot reach survey/analytics without code changes.

**Mitigation:** Re-add routes to `App.tsx` and align TopNav/MobileNav (currently journeys-only).

### 6. Deploy discipline

**Git push ≠ live update.** Netlify must redeploy after coach-rule or env changes. Team should test on production URL after each protocol deploy.

### 7. External dependencies

- **Joshua/Trello** — calendar integration blocked
- **Louise** — Supabase issues paused some work
- **No automated test suite in CI** — `vitest` configured but dependencies/tests not run in pipeline; regressions caught manually

---

## Suggested next 2 weeks (engineering)

1. **Close P1 loop** — goal gate + stage lock + mirroring; deploy to Netlify; Simon test round  
2. **Wire survey/dashboard routes** — low-effort unlock of existing pages (P2.4)  
3. **Run training export count** — confirm ≥100 examples; schedule retrain if protocol stable  
4. **Set Groq fallback env** on Netlify for demo reliability  
5. **Update backlog doc** — mark Jul 15–21 items done; reprioritise August voice work  

---

## Product maturity snapshot

| Layer | Maturity |
|-------|----------|
| Auth & data | Production-ready |
| Journey UX | Production-ready |
| Coach chat (text) | Beta — protocol tuning ongoing |
| Tasks & sustainability UI | Production-ready |
| Trainer/admin tools | Production-ready |
| Fine-tuned model | v1 deployed; needs retrain after protocol lock |
| Voice (production TTS/STT) | Not started |
| Avatar / roleplay | Not started |
| L&D analytics | Not started |

---

## Reference documents

| Doc | Purpose |
|-----|---------|
| `docs/FEATURE-BACKLOG-AND-TIMELINE.md` | Full backlog with owners |
| `docs/KNOWLEDGE-BASE-PROTOCOL.md` | Coach playbook for team review |
| `docs/NEXT-STEPS-AND-BUDGET.md` | Cloud, voice, avatar budget |
| `docs/GROQ-VS-RUNPOD-DECISION.md` | LLM strategy |
| `docs/SUPER-PROMPT-JUL15-MEETING.md` | Latest meeting decisions |

---

*Next automated brief: Friday 31 July 2026*
