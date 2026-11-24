# ShiftED full audit report — July LLM · Miro · research · resources

**Date:** 2026-11-24  
**Skills:** karpathy-guidelines  
**Production app:** https://shifted-ai-mauve.vercel.app  
**Model under test:** RunPod `empathy-coach-qwen14` on endpoint `ukbtc1h97b2y2h` (volume `lo3n0gefun`)  
**Audit harness:** `scripts/structure-audit-runpod.mjs` (Layer-2 + same 14B; bypasses Vercel 60s sync timeouts)

---

## Executive verdict

| Axis | Score | Notes |
|------|-------|--------|
| **Structure vs July / Miro (this loop)** | **1.00 (14/14)** | Handshake → Goal → lock gates all pass after Layer-2 fix |
| **July closeness (prior ali@ golden + Phase 3)** | **0.91** | Session `b7225b7e-…` · no feeling_reask / early_goal / invent hard flags |
| **Weights vs July 7B timbre** | Partial | July LoRA on deleted volume; 14B + Layer-2 restores **structure**, not exact July voice |
| **Ops (warm / timeout)** | Watch | Workers often throttled; Vercel sync can `FUNCTION_INVOCATION_TIMEOUT` — `maxDuration` raised 60→120 |

**Bottom line:** The coach now follows the July/Miro **phase machine** (conceptualisation → Reflective Handshake → Goal → steps → confidence ≥7 → Phase Three). Lou-style failures (chase last message; steal strength from “three clients”; never set Goal) are gated in code. Remaining gap is **tone similarity to July 7B**, not structure.

---

## 1. Resources inventory (organized)

### A. Miro (live board)

| Item | Detail |
|------|--------|
| Board | [ShiftED AI](https://miro.com/app/board/uXjVLT4US0c=/) · ~488 items |
| Frames | AI Avatar Framework, Architecture, Phase 1 Build, Model Framework, Categories, Learning Engine, Competitor Testing, Training the Model, Lead Generation, … |
| **Protocol canon (widget)** | Backend System Workflow Architecture — Adaptive Escalation Loop |
| **Phase One** | Scenario Extraction → Core Component Breakdown (rules/assumptions, beliefs, 0–100 strength, coping) → **Reflective Handshake** (hard gate; no Phase Two until explicit confirm) |
| **Phase Two** | Target outcome → Socratic micro-stepping → confidence 1–10; **&lt;7 → downscale** |
| **Phase Three** | Check-in → success next micro / friction → **Sustainability Pivot** → Core skill + Architectural Backtrack → re-activate |

Code mirror: `skills/coachProtocolStates.cjs` STATES 1–6 + Hot Cross Bun order.

### B. July LLM era (what “July” means)

| Layer | July (~10–24 Jul 2026) | Now (24 Nov 2026) |
|-------|------------------------|-------------------|
| Weights | Qwen2.5-7B LoRA merge `empathy-coach-qwen` on `salty_sapphire_parakeet_volume` | Qwen2.5-14B v2 `empathy-coach-qwen14` on `lo3n0gefun` |
| Endpoint | `dwmwweatrhzys4` | `ukbtc1h97b2y2h` |
| Chat volume | Jul **464** messages (peak) | Nov hybrid/rebuild; private 14B primary when warm |
| Prompt | Full July export 24 Jul + Miro 6-state | Condensed inference + **hard** STATES + Simon HARD_CANON |
| Archive commit | `0de3a31` (21 Jul) | Live `main` Layer-2 |

**Sources:** `docs/exports/ShiftED-Coach-LLM-Version-Timeline.md`, July gap gather, comparison pack, `data/july-product-canon.json`.

### C. July / old-laptop packs

| Path | Contents |
|------|----------|
| `docs/exports/ShiftED-July-Gap-And-Old-Laptop-Gather/` | Missing-vs-July, differences, bring-list, improve-14B plan, old-laptop hunt answers |
| `…/from-old-laptop-hunt/EXTRACTED-NOTES.md` | Jul 8 / 15 / 22 Gemini meeting notes (goal-before-tactics; protocols sequential; mirroring) |
| `…/JULY_ENDPOINT_MODEL_NOTES_REDACTED.md` | Endpoint/model ops notes |
| `data/archives/july-2026-from-old-laptop/` | Meeting docx, feedback prompt PDF/docx, hunt answers |
| `docs/exports/ShiftED-July-vs-Now-System-Comparison-Pack/` | July prompt export, LLM Engine research Jul 23, fine-tune research, current skills snapshot, training docs |
| `docs/exports/ShiftED-July-vs-Now-Coach-Brain-Gap.pdf` | Stakeholder gap PDF |
| `data/july-product-canon.json` | 19 hard product rules (handshake before Goal, one question, no invent, …) |

### D. Simon golden + voice + prior audits

| Path | Contents |
|------|----------|
| `docs/exports/ShiftED-Simon-Best-PreOct-Conversation.json` (+ PDF) | Best pre-October Simon transcript |
| `docs/exports/simon-replay/voice-note-*-transcript.txt` | Simon WhatsApp 21 Nov |
| `docs/exports/simon-replay/SIMON-VOICE-FEEDBACK-2026-11-21.md` | Encoded voice rules |
| `docs/exports/simon-replay/ali-july-phase3-live.md` | **0.91** closeness · Phase 3 reached · ali@ |
| `docs/exports/simon-replay/ShiftED-Layer2-Audit-And-Fixes-2026-11-21.md` | Architecture / feedback / gates audit |
| `docs/exports/simon-replay/replay-live*.md/json` | Earlier production replays |
| `scripts/ali-simon-july-phase3-audit.mjs` | Full golden + Phase 3 harness |
| `scripts/structure-audit-runpod.mjs` | **This loop** focused structure harness |

### E. Research & super prompts (docs/)

| Doc | Role |
|-----|------|
| `SUPER-PROMPT-PHASE-STRUCTURE-GOAL-SETTING.md` | Structure-first: handshake → Goal → Phase 2/3 (this loop’s design brief) |
| `SUPER-PROMPT-GOAL-ESTABLISHMENT.md` | Jul 8 meeting — Goal + steps before techniques |
| `SUPER-PROMPT-LLM-ENGINE-PHASES.md` | Phase 1–3 engine |
| `SUPER-PROMPT-OPENING-PHASE.md` | Problem ID + conceptualisation |
| `SUPER-PROMPT-MIRRORING-AND-TONALITY.md` | Register matching |
| `SUPER-PROMPT-JUL15-MEETING.md` | Mid-July protocol walkthrough |
| `SUPER-PROMPT-RUNPOD-OWN-LLM.md` / `PRIVATE-VAULT` | Own-model hosting |
| CBT parallel (research) | Assessment → formulation → SMART goals → activation → consolidate (Orygen / VA CBT-D style mapping) |

### F. Clinical / training resource library (264 mapped)

`docs/SHIFTEDAI-RESOURCES-INVENTORY-MAPPING.md` — full mapping of Simon/My-PWB toolkits into KB/skills:

- Opening Phase / conceptualisation docx → `problem_list_conceptualisation`
- Anxiety / Depression CCI-style sheets → frameworks + skills (worry_time, BA, HCPR, …)
- Mindfulness models → `public/infographics/*.webp`
- Guided audio → titles referenced; MP3s not committed
- Clinical out-of-scope (needle phobia, etc.) → signpost only

### G. Runtime stack

| Piece | Location |
|-------|----------|
| Chat API | `netlify/functions/chat.js` → Vercel `/api/chat` |
| Layer-2 SSOT | `skills/coachReply.cjs`, `coachProtocolStates.cjs`, `simonCoachRules.cjs`, `buildProductionSystemPrompt.cjs` |
| Admin LLM monitor | `/admin` · `mode=llm_status` |
| Warm-on-journey | `mode=warm` + client toast when 14B live |

---

## 2. Audit loop (what we ran)

### Offline unit gates (Layer-2)

1. `summary_not_handshake` rejects exploratory “what happens when…”  
2. Handshake-shaped summary accepted  
3. “yes that fits” → `handshakeConfirmed`  
4. After yes → `protocolState === GOAL_SETTING` + Phase Two instruction  
5. Strength turn must ask 0–100  
6. “three clients a day” does **not** parse as strength  
7. Locked ladder rejects “what’s the first concrete step?” without writing the lock  

### Live 14B + Layer-2 path (Lou-style map)

| Check | Result |
|-------|--------|
| No early Goal on turn 1 | PASS |
| After map → `asking === summary` | PASS |
| Handshake turn (not last-message chase) | PASS (template or model) |
| After confirm → Goal / Phase Two | PASS (Goal template after reject) |
| Goal lock language | PASS |
| `PHASE_2_GATE_LOCKED` when confidence ≥7 | PASS |
| No re-ask first step after lock | PASS |

**Score: 14/14 = 1.00**

### Prior production July golden (kept as secondary score)

`ali-july-phase3-live.md`: closeness **0.91**, Phase 3 reached, hard invent/early_goal/feeling_reask clear. Residual historical note: post-handshake sometimes asked for “first concrete step” again — addressed by `reask_locked_step` + PHASE_2_GATE_LOCKED template.

### Production Vercel note

Heavy sync turns still hit **FUNCTION_INVOCATION_TIMEOUT** when GPU is slow/throttled. Fix in this loop: `vercel.json` `maxDuration` **60 → 120**. Prefer warm workers + OpenAI sync when ready; cold uses async poll.

---

## 3. Mistakes found → fixes in this loop

| Bug | Fix |
|-----|-----|
| After handshake, guard fallback used generic “What feels most important…?” (Phase Two regress) | `templatedReply` now takes `protocolState` — Goal proposal / locked-step templates |
| Call sites omitted `protocolState` | Updated `netlify/functions/chat.js`, `server/server.js`, audit harness |
| Vague “what feels most important” allowed in GOAL_SETTING | Treated as `reask_locked_step` unless objective/Step lock language present |
| Vercel 60s cut off warm-but-slow sync | `vercel.json` maxDuration 120 |
| Audit blocked by Vercel timeout / RunPod 502 | Harness waits for idle/ready workers; same Layer-2 + 14B locally |

---

## 4. Miro ↔ code alignment matrix

| Miro requirement | Code | Audit |
|------------------|------|-------|
| No Phase Two until Reflective Handshake confirm | `FORMULATION_SUMMARY_CONFIRMATION` + handshake advance | PASS |
| Map components before Goal | Hot Cross Bun + `early_goal` reject | PASS |
| Strength 0–100 | `strength_not_asked` + parseStrength | PASS |
| Target outcome then micro-steps | `GOAL_SETTING` / `MICRO_STEPPING…` | PASS |
| Confidence ≥7 before lock | `PHASE_2_GATE_LOCKED` when conf≥7 | PASS |
| Sustainability Pivot / backtrack | Pivot instructions in STATE 6 | Not re-stressed this loop (prior Phase 3 path OK) |

---

## 5. What is still not “July weights”

- Exact July 7B merge is **gone** with `salty_sapphire_…` volume.  
- 14B can still sound more “assistant-generic”; Layer-2 restores **gates**, Simon HARD_CANON restores **brevity/one-ask**.  
- Optional later: continued SFT on handshake→Goal gold pairs (out of scope for this Layer-2 loop).  
- When user locks a Goal in chat, client should persist `target_outcome` / Step so the next turn leaves GOAL_SETTING sooner (template may re-offer Goal if state not updated).

---

## 6. How to re-run

```bash
# Structure audit (this report’s score)
node scripts/structure-audit-runpod.mjs

# Full Simon July + Phase 3 (production; needs warm workers)
node scripts/ali-simon-july-phase3-audit.mjs
```

Admin: https://shifted-ai-mauve.vercel.app/admin — live RunPod worker table.

---

## 7. Deliverables touched this loop

- `skills/coachReply.cjs` — Goal/locked templates + stricter Phase Two reject  
- `netlify/functions/chat.js`, `server/server.js` — pass `protocolState` into templates  
- `vercel.json` — maxDuration 120  
- `scripts/structure-audit-runpod.mjs` — reproducible structure audit  
- This report: `docs/exports/simon-replay/FULL-AUDIT-REPORT-2026-11-24.md`

**Deploy note:** Push to `main` for Vercel to pick up template + maxDuration (not pushed in this loop unless requested).
