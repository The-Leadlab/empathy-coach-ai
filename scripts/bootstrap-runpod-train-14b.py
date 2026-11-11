#!/usr/bin/env python3
"""Run on RunPod: writes runpod-train-qwen14b-qlora.py to /workspace."""
from pathlib import Path
import py_compile

TARGET = Path("/workspace/runpod-train-qwen14b-qlora.py")
SOURCE = Path(__file__).resolve().parent / "runpod-train-qwen14b-qlora.py"

if __name__ == "__main__":
    if not SOURCE.exists():
        raise SystemExit(f"Missing {SOURCE} — upload bootstrap + runpod-train-qwen14b-qlora.py together")
    TARGET.write_text(SOURCE.read_text(encoding="utf-8"), encoding="utf-8")
    TARGET.chmod(0o755)
    py_compile.compile(str(TARGET), doraise=True)
    print(f"Wrote {TARGET} ({TARGET.stat().st_size} bytes) — Syntax OK")
