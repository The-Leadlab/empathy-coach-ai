#!/usr/bin/env bash
# Run in your own Terminal (outside Cursor sandbox) while logged into Google.
# Downloads SAFE Drive zips (~1GB+) into data/raw/_downloads/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
MANIFEST="$ROOT/data/processed/drive-zips.json"
OUT="$ROOT/data/raw/_downloads"
mkdir -p "$OUT"

if ! command -v python3 >/dev/null; then
  echo "python3 required"; exit 1
fi

python3 - <<'PY'
import json, re, subprocess, sys
from pathlib import Path
root = Path(".").resolve()
manifest = json.loads((root / "data/processed/drive-zips.json").read_text())["all"]
out = root / "data/raw/_downloads"
out.mkdir(parents=True, exist_ok=True)
safe_re = re.compile(
    r"part(?:2a|2d)\.zip|part8-|part8b-|part9-|part1[0-9]-|part20-",
    re.I,
)
need = [z for z in manifest if safe_re.search(z["name"])]
print(f"SAFE packs: {len(need)}")
try:
    import gdown  # noqa: F401
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "gdown"])
    import gdown

ok = fail = 0
for i, z in enumerate(need, 1):
    dest = out / z["name"]
    if dest.exists() and dest.stat().st_size > 1000:
        print(f"[{i}/{len(need)}] exists {z['name']}")
        ok += 1
        continue
    print(f"[{i}/{len(need)}] {z['mb']} MB  {z['name']}")
    try:
        gdown.download(id=z["id"], output=str(dest), quiet=False)
        ok += 1 if dest.exists() else 0
        fail += 0 if dest.exists() else 1
    except Exception as e:
        print("  ERR", e)
        fail += 1
print(f"Done ok={ok} fail={fail}")
print("Next: node scripts/phase3/unpack-downloads.mjs && node scripts/phase3/ingest.mjs && node scripts/phase3/build-index.mjs && node scripts/phase3/build-sft.mjs")
PY
