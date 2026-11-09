# ShiftED AI — Client Brief (21 Aug 2026)

**Prepared by:** Ali Attia  
**For:** Weekly team update (WhatsApp + backlog alignment)  
**Repo:** empathy-coach-ai

---

## 1. Client Brief

ShiftED AI is a **practice-based empathy training platform** for first-time managers. Users rehearse difficult workplace conversations with an AI coach that uses Socratic questioning — training, not therapy.

**MVP status (live on Netlify):**

| Area | Status |
|------|--------|
| Journeys & session workspace | ✅ Live |
| Coach chat (RunPod fine-tuned + Groq fallback) | ✅ Live |
| Tasks per journey (coach-suggested + user-added) | ✅ Live |
| Sustainability path (Miro-style right rail) | ✅ Live |
| Guidance widget + belief before/after | ✅ Live |
| Document upload in chat (PDF/Word) | ✅ Live |
| Transcript export (PDF/TXT) | ✅ Live |
| Admin panel (Simon feedback + quality star) | ✅ Live |
| Thinking… latency UX (Aug 2026) | ✅ Shipped 5 Aug |

**Positioning:** Build empathetic leaders, one conversation at a time.

---

## 2. What has been done

### Since last weekly (7 Aug)

No new code shipped. Production remains on the **5 Aug** release (Thinking indicator). Fortnight used for team review and planning rather than dev sprint.

### Still live from Jul 20–21 sprint

- Guidance ladder widget + sustainability path with unlockable skill nodes
- Belief before/after ratings and recovery banner when stuck
- PDF/Word/transcript uploads in chat for coach analysis
- Full-width session layout; reorderable and completable tasks
- 4k context packing fixes for large uploads
- Transcript download for all users (not only trainers)

**Latest commit on main:** `4f0fcd7` — Thinking indicator (5 Aug 2026).

---

## 3. What is left to do

| Priority | Item | Notes |
|----------|------|-------|
| **Quick win** | Wire Survey + Progress pages | `SurveyPage.tsx` and `ProgressPage.tsx` exist; sidebar links to `/testing/survey` and `/testing/dashboard` but routes not in `App.tsx` (~1 day) |
| **P2** | Milestone checklist UI in session | Protocol steps visible alongside tasks — partial |
| **P3** | Model retrain | Blocked until KB/protocol sign-off; need 100+ Simon-reviewed examples |
| **P4** | Production voice (TTS/STT) | August target slipping; browser voice works today |
| **P5** | Wellbeing survey on login path | Survey built; not on main user flow |
| **P5** | Analytics dashboard | Emotional skills / development tracking — not started |
| **Later** | Avatar + roleplay (e.g. "Alex") | September+ |

---

## 4. Bottleneck issues

| Severity | Issue | Impact | Mitigation |
|----------|-------|--------|------------|
| 🔴 High | **Protocol/KB team sign-off** | Blocks model retrain, skills admin UI, analytics foundation | Team review of `docs/KNOWLEDGE-BASE-PROTOCOL.md`; schedule walkthrough with Kara |
| 🔴 High | **RunPod cold starts** | 30s–3min wait when GPU scales to zero | Use Groq hybrid for live demos; Thinking UI improves perceived wait; optional min workers during demo hours (cost) |
| 🟡 Medium | **Simon testing feedback loop** | Coach tone/direction tuning needs real screenshots | Simon sends email feedback on live replies |
| 🟡 Medium | **Orphaned Survey/Progress routes** | Users can't reach built pages from nav | Quick route wiring in next dev slot |
| 🟡 Medium | **Dev bandwidth gap** | Two weeks without new deploys | Prioritise route wiring + Simon feedback next sprint |
| 🟢 Low | **Backlog doc drift** | `FEATURE-BACKLOG-AND-TIMELINE.md` last updated 15 Jul | Refresh after next sprint |

---

## Suggested focus for next week

1. Wire Survey + Progress routes (fast user-visible win)
2. Collect Simon screenshot feedback on live coach replies
3. Push protocol/KB review to unblock retrain pipeline

---

*ShiftED AI · Client brief · 21 Aug 2026*
