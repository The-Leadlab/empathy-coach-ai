#!/usr/bin/env python3
"""Extract text from data/raw/**/*.pdf → sibling .pdf.txt for ingest."""
from pathlib import Path
import sys

try:
    from pypdf import PdfReader
except ImportError:
    print("pip install pypdf first", file=sys.stderr)
    sys.exit(1)

root = Path(__file__).resolve().parents[2] / "data" / "raw"
pdfs = [p for p in root.rglob("*.pdf") if p.is_file()]
ok = fail = skip = 0
for i, pdf in enumerate(pdfs, 1):
    out = pdf.with_suffix(pdf.suffix + ".txt")  # file.pdf.txt
    if out.exists() and out.stat().st_size > 50:
        skip += 1
        continue
    try:
        reader = PdfReader(str(pdf))
        parts = []
        for page in reader.pages:
            try:
                parts.append(page.extract_text() or "")
            except Exception:
                continue
        text = "\n".join(parts).strip()
        if len(text) < 40:
            fail += 1
            continue
        out.write_text(text, encoding="utf-8", errors="replace")
        ok += 1
        if i % 50 == 0:
            print(f"[{i}/{len(pdfs)}] ok={ok} fail={fail} skip={skip}")
    except Exception as e:
        fail += 1
        if fail <= 10:
            print("ERR", pdf.name, e)
print({"pdfs": len(pdfs), "ok": ok, "fail": fail, "skip": skip})
