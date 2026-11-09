# ShiftED AI — Client Brief

**Date:** 25 July 2026  
**Prepared by:** Ali Attia (automated weekly assessment)  
**Repo:** empathy-coach-ai · branch `main`  
**Live stack:** React/Vite frontend · Netlify hosting · Supabase auth/data · RunPod vLLM (fine-tuned Qwen2.5-7B) with Groq fallback

---

## Executive summary

ShiftED AI MVP is **live and usable**: journeys, coach chat, tasks, sustainability path, trainer admin, and document upload all work. The Jul 15–21 sprint delivered the biggest UI gap (guidance widget, sustainability rail, uploads, context fixes).

The main work now is **protocol quality** (team sign-off + Simon testing), not greenfield building. Several pages (survey, progress dashboard) are **built but not wired** into navigation — a quick win when ready.

---

## What has been done

### Core platform (shipped)

| Area | Status |
|------|--------|
| Auth & multi-journey dashboard | ✅ |
| Session workspace (tasks + sustainability path) | ✅ |
| AI coach chat (3-phase protocol, goal ladder) | ✅ |
| Trainer admin panel + global feedback loop | ✅ |
| Crisis safety + GDPR consent | ✅ |
| Document upload in chat (PDF, Word, transcript) | ✅ |
| Transcript export for all users | ✅ |

### Recent delivery (15–21 Jul 2026)

- Guidance ladder widget, belief before/after, sustainability banner
- Sustainability Path right rail (Miro layout, unlockable skill nodes)
- Full-width session layout; reorderable/completable tasks
- Context-limit hardening; removed artificial upload caps

### AI / infrastructure

- Super-prompt stack live in production
- RunPod async inference with cold-start UI
- Fine-tuned Qwen2.5-7B v1 deployed (~221 training turns)
- Training export pipeline ready
- Knowledge base protocol drafted (`docs/KNOWLEDGE-BASE-PROTOCOL.md`)

---

## What is left to do

### Priority 1 — Coach brain (blocking)

| Item | Status |
|------|--------|
| Goal gate — no homework until clear outcome agreed | In progress |
| Plain-language mirroring | In progress |
| Knowledge base protocol — team sign-off | In progress |
| Sequential stage lock (stop re-looping) | In progress |
| Kara protocol walkthrough | Not started |
| Simon screenshot/feedback loop | Ongoing |

### Priority 2 — UI gaps

| Item | Status |
|------|--------|
| Session milestone checklist polish | Partial |
| Wire survey + progress dashboard routes | **Not wired** |
| Cross-journey progress overview | Not started |

### Priority 3+ — After protocol lock

- Retrain model on Simon-reviewed conversations
- Side-by-side fine-tuned vs Groq test (Aug)
- Production TTS voice (Aug)
- Avatar, roleplay, analytics (Sep+)

---

## Bottleneck issues

1. **Protocol sign-off** — highest impact. Blocks retrain, skills admin, and marketing claims.
2. **Trainer feedback throughput** — fine-tune quality needs continuous Simon review; target 100+ examples.
3. **RunPod cold starts** — use Groq hybrid for demos.
4. **Built-but-unlinked UI** — SurveyPage/ProgressPage exist but routes removed from App.tsx.
5. **Deploy discipline** — Netlify redeploy required after coach-rule changes.
6. **External deps** — calendar integration blocked on Joshua/Trello; Louise on Supabase issues.

---

## Suggested next week

1. Close P1 protocol items → deploy to Netlify
2. Simon test round with screenshots
3. Wire survey/dashboard routes (quick win)
4. Run training export count; schedule retrain if protocol stable
5. Set Groq fallback env on Netlify for demo reliability

---

*Next automated brief: Friday 1 August 2026*
