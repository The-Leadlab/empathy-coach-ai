# ShiftED AI — Client Brief (7 Aug 2026)

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

### Shipped since last weekly (31 Jul)

| Date | Change |
|------|--------|
| **5 Aug** | ChatGPT-style **Thinking…** indicator in chat transcript and top status badge; escalates to "Still thinking" / "Taking a bit longer" / cold-start progress bar during RunPod scale-to-zero |

### Still live from Jul 20–21 sprint

- Guidance ladder widget + sustainability path with unlockable skill nodes
- Belief before/after ratings and recovery banner when stuck
- PDF/Word/transcript uploads in chat for coach analysis
- Full-width session layout; reorderable and completable tasks
- 4k context packing fixes for large uploads
- Transcript download for all users (not only trainers)

**Code activity:** One commit since 31 Jul (`4f0fcd7` — Thinking indicator). Prior sprint work stable in production.

---

## 3. What is left to do

| Priority | Item | Notes |
|----------|------|-------|
| **Quick win** | Wire Survey + Progress pages | `SurveyPage.tsx` and `ProgressPage.tsx` exist; sidebar links to `/testing/survey` and `/testing/dashboard` but routes not in `App.tsx` (~1 day) |
| **P2** | Milestone checklist UI in session | Protocol steps visible alongside tasks — partial |
| **P3** | Model retrain | Blocked until KB/protocol sign-off; need 100+ Simon-reviewed examples |
| **P4** | Production voice (TTS/STT) | August target; browser voice works today |
| **P5** | Wellbeing survey on login path | Survey built; not on main user flow |
| **P5** | Analytics dashboard | Emotional skills / development tracking — not started |
| **Later** | Avatar + roleplay (e.g. "Alex") | September+ |

---

## 4. Bottleneck issues

| Severity | Issue | Impact | Mitigation |
|----------|-------|--------|------------|
| 🔴 High | **Protocol/KB team sign-off** | Blocks model retrain, skills admin UI, analytics foundation | Team review of `docs/KNOWLEDGE-BASE-PROTOCOL.md`; Friday walkthrough with Kara |
| 🔴 High | **RunPod cold starts** | 30s–3min wait when GPU scales to zero | Use Groq hybrid for live demos; Thinking UI improves perceived wait; optional min workers during demo hours (cost) |
| 🟡 Medium | **Simon testing feedback loop** | Coach tone/direction tuning needs real screenshots | Simon sends email feedback on live replies |
| 🟡 Medium | **Orphaned Survey/Progress routes** | Users can't reach built pages from nav | Quick route wiring in next dev slot |
| 🟢 Low | **Backlog doc drift** | `FEATURE-BACKLOG-AND-TIMELINE.md` last updated 15 Jul | Refresh after next sprint |

---

## Suggested focus for next week

1. Wire Survey + Progress routes (fast user-visible win)
2. Chase KB/protocol sign-off — unblocks retrain
3. Simon screenshot round on goal-establishment and mirroring
4. Begin production voice provider shortlist (ElevenLabs / Deepgram per budget doc)

---

*ShiftED AI · Client brief · 7 Aug 2026*
