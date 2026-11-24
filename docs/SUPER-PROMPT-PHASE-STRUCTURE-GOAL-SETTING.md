# Super Prompt — Phase Structure, Conceptualisation & Goal Setting

**Status:** Layer-2 live (code + canon). Apply with `skills/coachReply.cjs`, `coachProtocolStates.cjs`, `simonCoachRules.cjs`, `llmEnginePhases.cjs`.  
**Sources:** July 8 goal-establishment meeting · LLM Engine phases PDF · Simon WhatsApp · Lou live regression (Nov 2026) · CBT manuals (Orygen / VA CBT-D): assessment → formulation → SMART goals → activation → consolidate.

---

## User problem (plain English)

Replies can sound July-close, but **structure** drifts:

1. Coach keeps asking about the **last message** instead of closing **Phase One conceptualisation**.
2. **No Goal** is set after the map — session stays in Understanding with “No Goal ladder yet.”
3. Phase Two / Three never properly start because Reflective Handshake never lands.

**Fix principle:** Structure first, then tone. Gates in code beat hoping the LoRA remembers.

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

## Out of scope (this pass)

Full retrain / new LoRA. Weights stay; Layer-2 restores July **structure**. Optional later: SFT on handshake→Goal gold pairs.
