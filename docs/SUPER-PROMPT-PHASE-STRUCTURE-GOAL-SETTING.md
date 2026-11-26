# Super Prompt — Phase Structure, Conceptualisation & Goal Setting

**Status:** Layer-2 live (code + canon). Apply with `skills/coachReply.cjs`, `coachProtocolStates.cjs`, `simonCoachRules.cjs`, `llmEnginePhases.cjs`.  
**Sources:** July 8 goal-establishment meeting · LLM Engine phases PDF · Simon WhatsApp · Lou live regression (Nov 2026) · CBT manuals (Orygen / VA CBT-D): assessment → formulation → SMART goals → activation → consolidate.

---

## User problem (plain English)

Replies can sound July-close, but **structure** drifts:

1. Coach keeps asking about the **last message** instead of closing **Phase One conceptualisation**.
2. **No Goal** is set after the map — session stays in Understanding with “No Goal ladder yet.”
3. Phase Two / Three never properly start because Reflective Handshake never lands.
4. Coach **repeats / rephrases the same question** across turns.
5. Even after a Goal exists, turns **do not return** to that Goal — they chase the newest sentence.

**Fix principle:** Structure first, then tone. Gates in code beat hoping the LoRA remembers. V3 weight training must also teach the North Star (map → Handshake → lock Goal → always return to it).

---

## Why this keeps happening (root cause audit — 25 Nov 2026)

| Layer | What goes wrong |
|-------|-----------------|
| **Model weights (v2)** | Chat SFT bias: attend to the latest user utterance; generate another empathic probe. Weights never strongly learned “close the map → lock Goal → stay loyal.” |
| **Prompt alone** | Long history + rich last message override soft “don’t re-ask” lines unless North Star is explicit and repeated in turn instructions. |
| **Handshake never lands** | If STATE 3 (summary) is skipped or the model keeps exploratory probes, Goal never unlocks → endless Phase One. |
| **Goal not persisted** | If `target_outcome` / Steps are not written into journey state after lock, next turn can feel like GOAL_SETTING again or free-form chat. |
| **No repeat guard** | Without comparing to the previous assistant question, regenerations can emit the same ask. |

**Layer-2 mitigations (live):** `summary_not_handshake` reject; handshake template; `HANDSHAKE_DONE_INSTRUCTION`; early-goal ban; `repeat_question` reject; North Star lines in system prompt + conversation skill + Simon hard canon + July product canon.

**V3 training must include (non-negotiable):** gold pairs Handshake→Goal lock; check-in that names the locked Goal; hard negatives of last-message chase, question repeats, and abandoning Goal after a tangent.

---

## Canonical structure (must match UI + July)

| Stage | Internal name | User-facing | Done when |
|-------|---------------|-------------|-----------|
| **Phase One** | Conceptualisation / Hot Cross Bun | Understanding | Situation → trigger → coping → rule → belief → strength → **Reflective Handshake yes** |
| **Phase Two** | Goal + ladder | Action planning | Short-term **Goal** locked → ≤5 Steps → micro-step → confidence ≥7 |
| **Phase Three** | Check-in / practice | Sustainability | Progress on locked step; on fail → pivot → backtrack → smaller retry |

**No tactics until there is a target** (July): no homework, skill dump, or Phase Three practice before handshake **and** Goal + key steps.

Therapy parallel (CBT): engagement/assessment → collaborative formulation → goal-setting → behavioural steps → consolidate / relapse prevention. ShiftED maps formulation→handshake, goals→Phase Two, consolidate→Phase Three.

---

## Hard sequence (one job per turn)

### Phase One — map then handshake (never skip)

1. **Scenario** — one concrete situation.  
2. **Map (one element / turn)** — thought → emotion/body/behaviour → light if…then → belief → **0–100% only when asked**.  
3. **Reflective Handshake** — short map in their words + “Does that fit…?”  
   - **BAN:** “What happens when…”, “What feels most…”, chasing the last turn.  
4. On **yes** → Phase Two. On correction → fix that part only.

### Phase Two — Goal then Steps (July Step 2.0)

1. Affirm handshake.  
2. Propose / co-create a **process Goal** they control.  
3. Lock it in writing.  
4. Co-create Steps (max 5, ≤2 micros each; stimulus control if scroll/avoidance).  
5. Confidence 1–10; shrink until ≥7 → Tasks / Phase Three mode.

### Phase Three — only after lock

Check-in on the active step. Success → next micro. Failure/stress → Sustainability Pivot → Architectural Backtrack → smaller Step Two — **do not invent a new Goal**.

---

## Layer-2 enforcement (shipped)

| Mechanism | Behaviour |
|-----------|-----------|
| `asking === "summary"` turn instruction | Forces handshake draft + verify; bans exploratory probes |
| `rejectReason` `summary_not_handshake` / `strength_not_asked` | Regenerates or templates if model chases last message / skips 0–100 |
| `parseStrength` | Requires `%` / `/100` / lone number — not “3 clients” |
| Handshake template fallback | Builds summary from captured map |
| `GOAL_SETTING` protocol + `HANDSHAKE_DONE_INSTRUCTION` | Immediately proposes short-term objective after yes |
| HARD_CANON | Structure lock lines for handshake → Goal → Phase Three |

---

## Acceptance checks

1. After map complete, next assistant turn is a **summary + fit?** — not a new exploratory question.  
2. After user says yes, next turn **names a Goal** (or locks their wording).  
3. UI: Goal ladder appears after agreement; Understanding milestones tick through handshake.  
4. No Phase Three practice language before Goal + Steps + confidence ≥7.  
5. Live Lou-style session: strength not stolen from incidental numbers; handshake closes conceptualisation.

---

## V3 weight-train acceptance (must pass before ship)

1. After map complete → next turn is Handshake (summary + fit?), not a new exploratory question.  
2. After user yes → next turn **names/locks a Goal** for the same problem.  
3. After Goal + steps locked → later turns refer back to that Goal (check-in / pivot / smaller retry).  
4. No repeated/rephrased previous question across consecutive assistant turns.  
5. Hard-negative eval: “chase last message only” and “never set Goal” scripts fail the model.

## Out of scope for Layer-2-only passes

Relying on prompt alone without V3 gold/hard-negatives for North Star Goal loyalty.
