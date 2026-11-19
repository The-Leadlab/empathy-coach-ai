# Improve current 14B to match July — with Phase 3 kept

**Status (19 Nov 2026 mid-morning):** Continued SFT **v2 is live**. Coach is **RunPod-only**. Stuck chats were **not a prompt bug** — see incident below. Simon/Louise/Kara 18 Nov notes folded into Layer-2 canon.

Assumption: July 7B weights stay missing. We close the quality gap on **this** stack.

---

## Incident — why chat stuck at ~156s (19 Nov)

| Evidence | Finding |
|----------|---------|
| Vercel `/api/chat` | Job `39ab60db-…` submitted to RunPod (estTokens ≈ 3304) |
| RunPod health | **44 jobs in queue, 0 workers** (placement failure, not “still thinking”) |
| Endpoint pools (before) | `ADA_48_PRO` + `AMPERE_48` only, DC `EU-RO-1` (volume-bound) |
| Capacity | No usable 48GB stock in EU-RO-1 for those pools at the time |
| Earlier same session | Old deploy still answered via **Groq gpt-oss-20b** — felt fast; new deploy waits for 14B |

**Fixes applied:** purged 44 queued jobs; widened pools to also include `BLACKWELL_32` + `BLACKWELL_96` (still EU-RO-1 so the volume mounts). Retry a message; first cold start can still take 1–3 minutes while the worker loads ~28G.

---

## Done

| Item | Result |
|------|--------|
| P0 stop Groq as coach voice | Live (RunPod only) |
| Condensed July / Simon density | Live |
| STATES 1–6 + Hot Cross Bun | Live |
| Continued SFT v2 on volume + endpoint | Live |
| Journey mute + Thinking copy | Live |
| Queue purge + wider EU-RO-1 GPU pools | Live |
| 18 Nov Simon/Louise alliance + downward-arrow rules | In `simonCoachRules` + `july-product-canon` |

---

## Still to add from 18 Nov meeting (not just code)

### Simon
- Blind-test scripts after cold start succeeds — confirm alliance tone vs interrogation on live **v2**.
- Share his collected notes / training docs on conceptualisation + prompt approaches (action item still open).

### Louise
- Confirm journeys feel shorter / less identical across repeats once new canon is live.
- Memory within a journey is already Supabase-backed — watch for tangent drift in testing.

### Kara
- Finish history folder + ICSP best copies (half-ended WhatsApp export issue).
- Video review of compiled history with Kara.
- Map which model “lenses” were used across the lifecycle (process doc, not runtime).

---

## New timeline

### Now
1. Retry stuck session after pool widen — confirm worker boots in EU-RO-1.
2. Run Simon scripts on **v2** for alliance + one-question + Hot Cross Bun.
3. Star weak turns.

### This week
1. Export new gold → optional short continued adapter only if scripts fail.
2. Kara/Ali history + ICSP pack (rollback insurance, not a live model switch).
3. Optional: set `workers.min=1` only if cold starts remain unacceptable (bills continuously).

### Later
1. July adapters A/B only if found.
2. Preference distill only after logged script failures.

---

## Acceptance tests

| Check | Target |
|-------|--------|
| Handshake before Goal | 100% |
| Hot Cross Bun order | Coping before Rule |
| Questions per turn | ≤1 |
| Alliance open (1–2 empathy sentences) | Present; not cold interrogation |
| Downward-arrow before early somatic | Present when thought is thin |
| Clinical jargon | 0 |
| Provider | RunPod 14B v2 only |
| Cold start | Worker eventually ready (not infinite queue) |

---

## What NOT to do

- Re-enable Groq as coach fallback
- Retrain 7B from scratch unless weights/adapters found
- Expand condensed prompt to full 50k every turn
- Revert Hot Cross Bun to July map order
- Delete Phase 3 to match July surface area
