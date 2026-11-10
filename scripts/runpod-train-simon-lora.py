#!/usr/bin/env python3
"""
LoRA fine-tune on Simon feedback + final LLM replies (train.jsonl).

Run on RunPod GPU Pod (RTX 4090), not Serverless.

  python runpod-train-simon-lora.py \
    --train /workspace/train.jsonl \
    --output /workspace/models/empathy-coach-qwen-merged \
    --epochs 2 --max-seq-length 4096 --batch-size 1
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from unsloth import FastLanguageModel
from datasets import Dataset
from trl import SFTConfig, SFTTrainer

DEFAULT_BASE = "unsloth/Qwen2.5-7B-Instruct-bnb-4bit"
ALLOWED_ROLES = frozenset({"system", "user", "assistant"})


def sanitize_messages(messages):
    clean = []
    for m in messages or []:
        role = m.get("role")
        if role not in ALLOWED_ROLES:
            continue
        content = m.get("content")
        if content is None:
            content = ""
        text = str(content).strip()
        if role != "system" and not text:
            continue
        clean.append({"role": role, "content": text if text else " "})
    return clean


def load_jsonl_messages(path: Path) -> Dataset:
    rows = []
    with path.open(encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError as e:
                print(f"Skipping bad JSONL line {line_no}: {e}")
                continue
            messages = sanitize_messages(obj.get("messages"))
            if len(messages) < 3:
                continue
            rows.append({"messages": messages})
    if not rows:
        raise SystemExit(f"No valid conversations in {path}")
    return Dataset.from_list(rows)


def build_text_dataset(dataset: Dataset, tokenizer) -> Dataset:
    """Pre-render chat text — avoids Unsloth formatting_func tokenization bugs."""

    def to_text(row):
        text = tokenizer.apply_chat_template(
            row["messages"],
            tokenize=False,
            add_generation_prompt=False,
        )
        if not isinstance(text, str):
            raise ValueError(f"Chat template returned {type(text)!r}, expected str")
        text = text.strip()
        if not text:
            raise ValueError("Empty chat template output")
        return {"text": text}

    return dataset.map(
        to_text,
        remove_columns=dataset.column_names,
        desc="Building text column",
        num_proc=1,
    )


def build_sft_config(args, out_path: Path) -> SFTConfig:
    common = dict(
        output_dir=str(out_path / "checkpoints"),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=4,
        learning_rate=args.lr,
        logging_steps=10,
        save_strategy="epoch",
        bf16=True,
        dataset_num_proc=1,
    )
    try:
        return SFTConfig(max_length=args.max_seq_length, **common)
    except TypeError:
        return SFTConfig(**common)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--train", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--base", default=DEFAULT_BASE)
    p.add_argument("--max-seq-length", type=int, default=4096)
    p.add_argument("--epochs", type=int, default=2)
    p.add_argument("--batch-size", type=int, default=1)
    p.add_argument("--lr", type=float, default=2e-4)
    args = p.parse_args()

    train_path = Path(args.train)
    out_path = Path(args.output)
    out_path.mkdir(parents=True, exist_ok=True)

    print(f"Loading base model: {args.base}")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.base,
        max_seq_length=args.max_seq_length,
        dtype=None,
        load_in_4bit=True,
    )

    model = FastLanguageModel.get_peft_model(
        model,
        r=16,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_alpha=16,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=3407,
    )

    dataset = load_jsonl_messages(train_path)
    print(f"Training examples: {len(dataset)}")

    text_dataset = build_text_dataset(dataset, tokenizer)
    print(f"Text column ready: {len(text_dataset)} rows")
    sample = text_dataset[0]["text"]
    print(f"Sample text length: {len(sample)} chars")

    sft_args = build_sft_config(args, out_path)
    trainer = SFTTrainer(
        model=model,
        processing_class=tokenizer,
        train_dataset=text_dataset,
        args=sft_args,
    )

    trainer.train()
    print("Merging LoRA into base weights…")
    model.save_pretrained_merged(str(out_path), tokenizer, save_method="merged_16bit")
    tokenizer.save_pretrained(str(out_path))
    print(f"Done. Merged model: {out_path}")


if __name__ == "__main__":
    main()
