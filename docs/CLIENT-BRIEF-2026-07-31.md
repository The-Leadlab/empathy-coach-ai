# Client Brief — Weekly Status (31 Jul 2026)

**Project:** ShiftED AI — Empathy Coach  
**Prepared by:** Ali Attia  
**For:** ShiftED team (Simon, Kara, Louise, Joshua)

---

## 1. Client Brief

ShiftED AI is a **practice-based empathy training platform** for first-time managers and leaders. Users rehearse difficult workplace conversations with an AI coach that uses **Socratic questioning** — not therapy, not prescriptive advice.

**Current product state (MVP live):**

| Area | Status |
|------|--------|
| Auth & accounts | Live (Supabase) |
| Journeys dashboard | Live — multiple topic threads |
| Coach chat | Live — RunPod fine-tuned model + Groq fallback |
| Tasks per journey | Live — coach-suggested + user-added, tickable |
| Sustainability path | Live — right-rail skill nodes, unlockable |
| Admin panel | Live — Simon feedback, quality stars, global instructions |
| Document upload in chat | Live — PDF, Word, transcripts |
| Transcript export | Live — PDF/TXT for all users |
| Voice (browser) | Basic — mic in, browser TTS out |
| Survey & analytics pages | Built but **not wired** in app routes |
| Avatar / roleplay | Not started |

**North star:** EI Learning Loop — trigger → Socratic exploration → insight → practice → feedback → reinforcement. Strongest today on steps 1–3 in chat.

---

## 2. What has been done?

### Shipped 20–21 Jul 2026 (last dev sprint)

- **15 Jul meeting items:** guidance widget, belief before/after ratings, sustainability banner, transcript download for all users
- **Sustainability path:** Miro-matched right rail with unlockable skill nodes; reorderable and completable
- **Session layout:** full-width workspace
- **Document upload:** PDF, Word, and transcript files in chat for coach analysis
- **Context handling:** removed artificial upload caps; hardened 4k context packing for large docs

### Already live from earlier sprints

- Multiple journeys, goal-ladder coaching, task sync from chat
- Trainer global feedback loop (Simon shapes all users)
- Admin quality-star system
- Crisis triage guardrails
- Netlify deploy with serverless chat function

### Since 21 Jul

- No new code commits — previous sprint items deployed and stabilised
- Backlog doc last updated 15 Jul; feature set above reflects live product cross-check

---

## 3. What is left to do?

### Quick wins (days)

| Item | Notes |
|------|-------|
| Wire SurveyPage + ProgressPage routes | Pages exist; not in `App.tsx` menu — ~1 day |
| Netlify redeploy after any coach rule change | Required for live site to update |

### This month (Jul–Aug)

| Item | Notes |
|------|-------|
| Milestone checklist UI in session | Partial — users see tasks but not full protocol ticks |
| KB/protocol team sign-off | `docs/KNOWLEDGE-BASE-PROTOCOL.md` awaiting review |
| Model retrain | After protocol stable; needs 100+ Simon-reviewed examples |
| Simon vs cloud model side-by-side test | Not started — Aug target |
| Production voice (TTS/STT) | ElevenLabs/Deepgram or free-tier path — Aug target |

### Later (Aug–Sep+)

| Item | Notes |
|------|-------|
| Wellbeing survey on login path | Survey built; not on main user flow |
| Recommended training paths from survey | Not started |
| Analytics dashboard (3 emotional areas) | Old dashboard page not linked |
| Admin skills editor (no-code) | After KB approved |
| Avatar with lip-sync | Sep+ |
| Roleplay mode (e.g. "Alex" character) | Sep+ |
| Italian + German language options | Deferred |

---

## 4. Bottleneck issues

| Bottleneck | Impact | Mitigation |
|------------|--------|------------|
| **Protocol/KB team sign-off** | Blocks model retrain, analytics foundation, skills admin | Kara-led Friday walkthrough; team comments on `KNOWLEDGE-BASE-PROTOCOL.md` |
| **RunPod cold starts** | Slow first reply in demos | Use Groq hybrid for live demos; keep RunPod for fine-tuned quality |
| **Simon testing feedback loop** | Coach tone/direction tuning stalled without screenshots | Ongoing Tuesday testing; regenerate is preview-only — must save feedback |
| **Orphaned Survey/Progress pages** | Users can't reach wellbeing check or analytics | Quick route wiring — no new build needed |
| **Deploy vs push gap** | GitHub push alone doesn't update live site | Netlify must redeploy after coach changes |

---

## Reference docs

- Backlog: `docs/FEATURE-BACKLOG-AND-TIMELINE.md`
- Protocol: `docs/KNOWLEDGE-BASE-PROTOCOL.md`
- WhatsApp copy: `docs/WEEKLY-WHATSAPP-2026-07-31.md`

---

*ShiftED AI · Weekly client brief · 31 Jul 2026*
