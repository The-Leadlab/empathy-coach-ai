# GTM feedback → train loop (through December)

Batch process — never keep a GPU pod warm between batches.

1. Trainers (Simon / Louise / Kara) leave feedback in-app. Exact pasted replies auto-apply at inference (`feedback-exact`).
2. Short style rules stay in the live system prompt; long exact pastes are training labels only.
3. When you have a batch of new feedback (or old-laptop JSONL):

```bash
npm run export:simon-training
# drop files into data/sft/external/ if needed
npm run merge:training-corpus
npm run validate:training-jsonl -- data/sft/train_14b_gtm.jsonl
```

4. Follow [TRAIN-QWEN14B-QLORA.md](./TRAIN-QWEN14B-QLORA.md): one pod → train → merge `…-v2` (or next) → Serverless swap → **terminate pod**.
5. Run cases in [`data/sft/gtm-eval-set.json`](../data/sft/gtm-eval-set.json) before declaring the cutover good.
