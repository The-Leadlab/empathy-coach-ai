# SUPER PROMPT — This laptop (new Mac) verification checklist

Paste into a Cursor chat **in the empathy-coach-ai repo** when you want a fresh audit.

---

```
Audit this machine for everything that can help the current 14B + Phase3 system match July quality (tone, protocol, user-similarity, knowledge). Do not retrain yet. Report only.

CHECK:
1. models/ — list merges, adapters, sizes, mtimes. Confirm no 7B july merge.
2. data/sft/ — line counts + hashes for train_simon_feedback, train_14b_gtm, phase3_plus_simon, train.jsonl
3. Git: show tag july-2026-best; confirm tip commit; list any other july* tags
4. Supabase (MCP): counts for chat_messages, chat_feedback by month, admin_quality_star=true, skills rows, workbooks rows; sample global feedback texts (redact PII)
5. Prompt SSOT: skills/coachProtocolStates + buildProductionSystemPrompt — confirm hard gates + condensed path
6. Desktop packs: ShiftED-old-laptop-snap-*, ShiftED-July-vs-Now-*, this gap pack — confirm present
7. RunPod env in .env.example / docs: current endpoint vs deleted july endpoint names
8. Inference mix: from chat_messages.metadata or logs, estimate RunPod vs Groq share

OUTPUT: one markdown under docs/exports/ dated today: THIS-LAPTOP-AUDIT-YYYYMMDD.md
End with: Top 5 actions to improve tone/similarity WITHOUT needing the deleted 7B weights.
```

---

## Snapshot already taken (18 Nov 2026)

| Check | Result |
|-------|--------|
| 7B July merge on disk | **Not found** |
| 14B merge | `models/empathy-coach-qwen14-merged-v1` ~29G |
| LoRA adapters | `checkpoint-840`, `checkpoint-1680` (~550MB each) |
| Simon JSONL | 221 lines, present |
| 14B train corpus | 6716 lines (`phase3_plus_simon` dominant) |
| Git tag | `july-2026-best` → `0de3a31` |
| Supabase messages | ~1159 |
| chat_feedback | **32** (22 Jul + 10 Nov) |
| admin_quality_star | **1** only — critical tone gap |
| skills / workbooks tables | empty (0) — code skills library is source of truth |
| Old laptop snap | Desktop `ShiftED-old-laptop-snap-20261118` |
| Comparison pack | `docs/exports/ShiftED-July-vs-Now-System-Comparison-Pack` |
