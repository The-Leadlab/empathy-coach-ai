# Client Brief — Weekly Status (2 Oct 2026)

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
| Thinking indicator | Live — ChatGPT-style status while coach replies (5 Aug) |
| Voice (browser) | Basic — mic in, browser TTS out |
| Survey & analytics pages | Built but **not wired** in `App.tsx` routes |
| Avatar / roleplay | Not started |

**North star:** EI Learning Loop — trigger → Socratic exploration → insight → practice → feedback → reinforcement. Strongest today on steps 1–3 in chat.

---

## 2. What has been done?

### Shipped 5 Aug 2026 (last code commit)

- **Thinking indicator:** ChatGPT-style "Thinking…" label while coach generates a reply
- **Cold-start UX:** "Still thinking" / "Getting ready" copy + progress bar for RunPod warm-up

### Shipped 20–21 Jul 2026 (still live)

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

### Since 5 Aug

- **No new code commits** — eight weeks without a dev deploy
- Production stable; backlog items below remain open

---

## 3. What is left to do?

### Quick wins (days)

| Item | Notes |
|------|-------|
| Wire SurveyPage + Dashboard/Progress routes | Pages exist; sidebar links to `/testing/survey` and `/testing/dashboard` but routes missing in `App.tsx` — ~1 day |
| Netlify redeploy after any coach rule change | Required for live site to update |

### This month (Aug–Oct)

| Item | Notes |
|------|-------|
| Milestone checklist UI in session | Partial — users see tasks but not full protocol ticks |
| KB/protocol team sign-off | `docs/KNOWLEDGE-BASE-PROTOCOL.md` awaiting review |
| Model retrain | After protocol stable; needs 100+ Simon-reviewed examples |
| Simon vs cloud model side-by-side test | Not started |
| Production voice (TTS/STT) | ElevenLabs/Deepgram or free-tier path — August target slipped |

### Later (Oct+)

| Item | Notes |
|------|-------|
| Analytics dashboard | Emotional skills tracking over time |
| Wellbeing survey on login path | Onboarding survey built; not on main user flow |
| Avatar + lip-sync | Depends on production voice |
| Roleplay scenarios (e.g. "Alex") | Separate from empathy coach |

---

## 4. Bottleneck issues

| Issue | Impact | Mitigation |
|-------|--------|------------|
| **Protocol/KB team sign-off** | Blocks model retrain, analytics design, and admin skills editor | Kara-led review of `KNOWLEDGE-BASE-PROTOCOL.md`; Friday walkthrough still pending |
| **RunPod cold starts** | 30s–3min wait on first message after idle | Use Groq hybrid for live demos; Thinking UI sets expectations |
| **Simon testing feedback** | Coach tone/direction tuning needs real screenshots | Simon to send email with specific reply examples |
| **Orphaned Survey/Dashboard pages** | Users can't reach built features from sidebar | ~1 day dev to wire routes — recommended next sprint |
| **No dev sprint for 8 weeks** | Backlog items ageing; August voice target slipped | Prioritise route wiring + Simon feedback round |

---

## Recommended next sprint

1. Wire Survey + Dashboard routes (~1 day)
2. Simon screenshot feedback round on live coach
3. Kara protocol review session → unlock retrain pipeline
4. Netlify redeploy + smoke test as Simon and Nikki

---

*ShiftED AI · Client brief · 2 Oct 2026*
