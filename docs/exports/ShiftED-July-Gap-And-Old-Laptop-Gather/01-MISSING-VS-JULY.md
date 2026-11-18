# What’s missing from the current model vs the July model

“Current model” = **empathy-coach-qwen14** (14B SFT, Nov) + Nov prompt/protocol.  
“July model” = **empathy-coach-qwen** (7B + Simon LoRA merge) + July prompt/protocol.

---

## A. Weights / voice (largest gap)

| Missing | Impact |
|---------|--------|
| Exact July merge `empathy-coach-qwen-merged-v1` | Lost the **timbre** Simon trained: short, plain, mirror-heavy replies baked into weights |
| July LoRA adapters (if only stored on deleted volume) | Cannot hot-swap onto base 7B without retrain |
| Production serving that July binary exclusively | Nov often answers via **Groq fallback** (155 fallback vs 20 runpod in metadata) — kills “July feel” even if 14B is good |

**Not missing:** ability to train again — Simon JSONL + larger Phase3 corpora exist on this laptop.

---

## B. Prompt / orchestration

| July had | Now | Gap |
|----------|-----|-----|
| Full Adaptive Escalation detail in stakeholder export | Condensed live path (~15k) + hard STATES 1–6 turnInstructions | Condensed still thinner on ladder/pivot examples |
| Map order in prompt: Trigger → Rule → Belief → Strength → Coping | Hot Cross Bun: Trigger → **Coping** → Rule → Belief → Strength | Intentional clinical change — keep; don’t “restore” the conflict |
| Soft Goal / confidence gates | Hard gates in code (17 Nov) | Now **better** than July soft gates — keep |
| No `PHASE_2_GATE_LOCKED` enum | Named protocol state | Now **better** |
| July `chat.js` / skills (pre Phase3 practice, pre KB) | More features (KB, practice, workbooks, document analysis) | Extra surface area can dilute tone if RAG/skills dump too much |

---

## C. Knowledge

| July | Now | Gap |
|------|-----|-----|
| Skills library injected every turn (static) | Same + Phase3 resources KB + Manus scrape on old zip | **Skills table in Supabase = 0 rows** — DB skills unused; code library must stay filled |
| Little RAG | Chunks/manifests exist (`data/processed`, old zip `08_knowledge_scrape`) | RAG not fully wired as July research intended — knowledge may not reach replies |
| Workbooks mostly design | Phase3 practice layer exists; `workbooks` table empty | Content not loaded into DB |

---

## D. Tone & user-similarity

| Signal | July | Now | Gap |
|--------|------|-----|-----|
| Trainer feedback in prompt | Global bullets + stars | Still wired, but budgets trimmed for condensed | Fewer Simon bullets per turn |
| Starred exemplars | Injected | **Only 1** live `admin_quality_star` in Supabase | Near-zero exemplar injection → weak “sound like Simon” |
| Fine-tune on feedback turns | 133 feedback + 9 starred in Jun JSONL baked into **7B** | 14B trained on larger mix incl. Phase3 — may sound more “generic assistant / corpus” than Simon-only | **User-similarity drift** |
| One question, plain language | Prompt + LoRA | Prompt + guards; LoRA different | Guards help; weight tone differs |
| Mirroring / tonality super prompt | Documented Jul | Still in docs; enforce in condensed | Easy to dilute under Phase3 knowledge |

---

## E. Data freshness

| Source | Status |
|--------|--------|
| Jun 19 Simon export (221) | On both laptops / both zips |
| Jul–Nov live chats in Supabase | **1159** messages — not all re-exported into a new “gold” JSONL for continued SFT |
| chat_feedback | Jul 22 + Nov 10 — should re-export before any new train |
| admin_quality_star | Column live — re-export starred for exemplars |

---

## F. What current system has that July did NOT

- Phase 3 practice / workbooks / journal hooks  
- Resources knowledge scrape assets  
- Hard Miro state machine + Hot Cross Bun  
- Document-analysis path  
- Vercel host + Groq cold-start fallback  
- 14B capacity + local merge + adapters on disk  

Use these; don’t delete them to “be July.”
