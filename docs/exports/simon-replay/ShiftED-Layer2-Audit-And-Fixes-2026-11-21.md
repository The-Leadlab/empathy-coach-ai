# ShiftED Layer-2 audit + fixes — 2026-11-21

**Scope:** Architecture, super prompt, feedback button, Phase One gates, Simon voice (21 Nov).  
**Fix budget:** Layer-2 only (prompts / gates / hard-negs). No full retrain.  
**Skills:** karpathy-guidelines.

---

## Verdict

The live coach is **still wired** to the July prompt stack via `prepareCoachTurn` → `buildProductionSystemPrompt` → RunPod/fallback → `finalizeCoachReply`. It is not disconnected — it is **diluted** (condensed inference) and had **two conflicts**: (1) July speaking-bar Goal-first vs Phase One conceptualisation-first; (2) feeling re-interview loops with no hard guard. Feedback collection works; live reinjection is partial (pin + service role + trim).

Layer-2 changes in this pass address Simon’s voice notes and the P0 audit gaps. Live golden replay still needs deployment keys (`--live --app …`).

---

## 1. Architecture (audited)

```
AvatarSessionPage → fetchChatReply → /api/chat (netlify/functions/chat.js)
  → prepareCoachTurn (coachReply.cjs)          [server SSOT for Phase One element]
  → buildProductionSystemPrompt (forInference) [condensed stack]
  → RunPod 14B async (or Groq fallback / template)
  → finalizeCoachReply + rejectReason
  → UI saves generation_metadata.phaseOne
```

| Piece | Status | Note |
|-------|--------|------|
| Server `prepareCoachTurn` | Present | Nulls client `phaseOneNextElement` during intake — good SSOT |
| Client `phaseOneRouting.ts` | Soft / dead twin | Still computed & sent; ignored in intake |
| Condensed `forInference` | Soft | Drops full phase text, trims Simon rules to 36, can drop trainer/memory under token pressure |
| Cold GPU → Groq | Soft | Quality path bypassed when queued |
| Regenerate | Soft | Always uses fallback when configured — LoRA skipped for trainer rewrites |

---

## 2. Super prompt (audited)

Assembly order in `buildProductionSystemPrompt.cjs`: coach inference base → **July speaking bar (top 12)** → condensed phases → journey → skills one-liner → progress → (KB/RAG only post-handshake) → inference directives → turnInstruction → Simon canon → trainer globals + stars + memory.

**Conflict fixed:** July bar previously pinned “Establish Goal… before techniques” as rule #1 *above* conceptualisation-before-Goal. Reordered so conceptualisation + handshake win; Goal/ladder is Phase-Two-only.

**Simon 21 Nov voice encoded into:** `simonCoachRules` HARD_CANON, `conversationSkill` (full + condensed), `coachProtocolStates` MAP_CORE_COMPONENTS, `phaseOneTurnInstruction`, `INFERENCE_DIRECTIVES`, `humanCoachVoice`.

**New hard guard:** `rejectReason` → `feeling_reask` when `feelingsKnown` and reply re-opens a feeling interview (reinforcement “still feel the same?” allowed). Wired through async poll via `feel=1` query (`fetchChatReply` + `chat.js`).

---

## 3. Feedback button (audited)

| Path | Works? | Live prompt? |
|------|--------|--------------|
| Star (`admin_quality_star`) | Yes | Yes — “Admin-starred exemplars” (trimmed when inference) |
| Feedback draft → `chat_feedback` | Yes | Only if `apply_to_global_instructions !== false` (UI default **true**) |
| Exact “use this reply” paste | Yes | **No** as bullet — regenerate short-circuits to `feedback-exact`; export keeps gold |
| Unpinned feedback | Yes | Trainer regen context only |
| Without `SUPABASE_SERVICE_ROLE_KEY` on host | — | Trainer globals + stars **empty** at runtime |

**UI:** `ChatTranscript` + `AvatarSessionPage` — compose, rating, tags, apply-to-global checkbox, regenerate requires ≥1 feedback. Metrics view `admin_feedback_prompt_metrics` for admin.

**Risk:** Under 4k trim, trainer globals / exemplars / memory can be dropped before July bar / HARD_CANON. Prefer keeping Simon HARD_CANON short and critical.

---

## 4. Phase One gates vs Simon voice

| Criterion | Before | After this pass |
|-----------|--------|-----------------|
| Stop circling feelings | Soft (prompt only) | Hard reject `feeling_reask` + prompt bans |
| Main problem first | Present | Strengthened in HARD_CANON + July bar #1 |
| One-problem lock | Soft prose | HARD_CANON + turnInstruction + conversation skill |
| Multi-thought without feeling re-interview | Missing | Explicit in canon / MAP state / reject |
| Handshake before goals | Present + `early_goal` | Unchanged; July Goal-first conflict removed |
| Document upload hijack | Present (`DOC_ANALYSIS_INSTRUCTION`) | Unchanged |
| Dual routers | Conflicting | Documented; server wins (cleanup = P2) |

---

## 5. Simon voice transcripts (step 1)

Saved under `docs/exports/simon-replay/`:

- `SIMON-VOICE-FEEDBACK-2026-11-21.md`
- `voice-note-1-transcript.txt` / `voice-note-2-transcript.txt`

**Core ask:** Phase One compartmentalised around the initial problem; establish conceptualisation only; don’t cycle feeling questions when exploring further thoughts.

---

## 6. Golden replay harness

`scripts/replay-simon-golden.mjs`

- Offline (ran): scores July replies + shows what `prepareCoachTurn` would ask next → `replay-offline.{json,md}`
- Live: `node scripts/replay-simon-golden.mjs --live --app https://<host> --pace 25`

**Offline observation:** After elements fill, state sits on `asking=summary` while July golden continues into goal/ladder language. Handshake confirm still required before Phase Two — intentional hard gate; live replay will show whether current model tries early goals (should be rejected).

---

## 7. Files changed (Layer-2)

- `data/july-product-canon.json` — reorder; one-problem + multi-thought; Goal Phase-Two-only
- `skills/simonCoachRules.cjs` — HARD_CANON voice rules
- `skills/conversationSkill.cjs` — one-problem + feeling lock; stronger disclosed map
- `skills/coachProtocolStates.cjs` — MAP state multi-thought rule
- `skills/coachReply.cjs` — `feeling_reask` reject + guard.feelingsKnown + turnInstruction
- `skills/buildProductionSystemPrompt.cjs` — inference directive #7
- `skills/humanCoachVoice.cjs` — one-problem / no feeling restart
- `src/lib/fetchChatReply.ts` — `feel=1` on poll
- `netlify/functions/chat.js` — reconstruct `feelingsKnown`
- `scripts/eval-coach-replies.mjs` / `scripts/replay-simon-golden.mjs`
- `src/lib/coachReply.test.ts` — new feeling_reask cases (40 tests pass)

---

## 8. Recommended next (still Layer-2, no full retrain)

1. Run live replay against production once keys/env confirmed; iterate until acceptance flags clear.
2. Confirm Vercel/Netlify has `SUPABASE_SERVICE_ROLE_KEY` so feedback/stars reach the live prompt.
3. P2: stop computing client `phaseOneNextElement` in intake (dead twin cleanup).
4. Optional short continued SFT **only** if Layer-2 still fails circling after live audit — not authorized yet.

---

## Acceptance checklist (for live re-audit)

- [ ] Handshake before any Goal / shared goal / ladder ask  
- [ ] No invent / training-scenario bleed (Tim / WMHD / generic manager eval)  
- [ ] No feeling re-ask after coping/feelings disclosed (reinforcement OK)  
- [ ] Stay on one presenting problem; deepen thoughts without restarting Hot Cross Bun  
- [ ] ≤1 question per reply; alliance-first opener  
- [ ] Feedback with apply-to-global appears in “Trainer global standards” when service role set  
- [ ] Starred replies appear as exemplars when service role set  

---

## 9. Live replay results (2026-11-21, local Groq fallback)

Pushed commits `4d4ae93` + `b7ff5fa`. Live golden user turns (max 6) against Layer-2 stack:

| Check | Result |
|-------|--------|
| no feeling re-ask when known | **Pass** |
| no early goal before handshake | **Pass** |
| single-question rapport opener | **Pass** ("What should I call you?") |
| Match July turn-for-turn depth / tone | **Not yet** — current replies are shorter; July was longer/multi-question (and would fail today’s wall/meta guards) |
| Phase One advance past `rule` | Soft — still sticky on rule in replay state |
| Production host | `https://shifted-ai-mauve.vercel.app` responding; provider often `fallback` (Groq), not always RunPod 14B |

Honest status: talk *rules* now enforce Simon’s voice constraints; the model is **not** a July twin. Next if needed: more Layer-2 on rule→belief→summary advance, then optional short continued SFT — still no full retrain.
