# Phase 3 data layout

Corpus for **LLM training / RAG Phase 3** (not product Development Skills UI).

## Layout

| Path | Purpose |
|------|---------|
| `data/raw/<part-id>/` | SAFE zip extracts (PDFs/txt/md). **Not committed** — drop locally before ingest. |
| `data/fixtures/` | Tiny public-domain + negative fixtures for CI / licence gates. |
| `data/processed/` | `manifest.jsonl`, `chunks.jsonl`, `EXCLUSIONS.md` (generated). |
| `data/index/` | Retrieval index built from chunks (generated). |
| `data/sft/` | `train.jsonl` / `eval.jsonl` for the next RunPod LoRA (generated). |

## SAFE allow-list (ingest)

US federal public domain + Simon-owned subsets only:

- Part **2a** / **2d** — Simon subset only (exclude PositivePsychology.com / CCI / CNTW copies)
- Parts **8–20** — VA / SAMHSA / NIMH / NIAAA / NIDA / HHS / DHA / NIH (see Data Index)

## HOLD — do not ingest

Parts 1, 2b, 2c, 3a–3e, 4a–4e, 5, 6a–6l, 7, PP packs, YouTube captions.

## Commands

```bash
# Ingest fixtures (and any data/raw present)
node scripts/phase3/ingest.mjs

# Build retrieval index
node scripts/phase3/build-index.mjs

# Build SFT JSONL (90/10 split)
node scripts/phase3/build-sft.mjs

# Validate SFT for RunPod
npm run validate:training-jsonl -- data/sft/train.jsonl
```

## BLOCKED: Drive corpus

Cloud agents cannot read private ShiftED Drive by default. Until SAFE zips are in `data/raw/`, ingest runs on **fixtures only**. See `data/processed/BLOCKED.md` after ingest.

Drive file ids (operator): Data Index `1yMlDHLqUCjr4j4WDlbUDVuXjEI6Vh8izkKShzq3MIoc`, review folder `1DNKf57mrZfvFj_l25DkiFzDkutTSKhOL`.
