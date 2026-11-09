#!/bin/bash
set -euo pipefail
ROOT="/Users/attia/Desktop/Paginas web/New folder/empathy-coach-ai"
cd "$ROOT"
LOG="$ROOT/data/processed/drive-download.log"
exec > >(tee -a "$LOG") 2>&1
echo "=== $(date) ShiftED SAFE Drive download ==="
echo "cwd=$(pwd)"
python3 -c "import socket; print('dns', socket.gethostbyname('drive.google.com'))"

OUT="$ROOT/data/raw/_downloads"
mkdir -p "$OUT"

python3 -m pip install -q --user gdown 2>&1 | tail -5 || true
python3 <<'PY'
import json, re, sys
from pathlib import Path
root = Path("/Users/attia/Desktop/Paginas web/New folder/empathy-coach-ai")
manifest = json.loads((root / "data/processed/drive-zips.json").read_text())["all"]
out = root / "data/raw/_downloads"
out.mkdir(parents=True, exist_ok=True)
safe_re = re.compile(
    r"part(?:2a|2d)\.zip|part8-|part8b-|part9-|part1[0-9]-|part20-",
    re.I,
)
need = [z for z in manifest if safe_re.search(z["name"])]
print(f"SAFE packs to fetch: {len(need)}")
try:
    import gdown
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "gdown"])
    import gdown

ok = fail = 0
for i, z in enumerate(need, 1):
    dest = out / z["name"]
    if dest.exists() and dest.stat().st_size > max(1000, int(z["bytes"] * 0.85)):
        print(f"[{i}/{len(need)}] exists {z['name']} ({dest.stat().st_size} bytes)")
        ok += 1
        continue
    print(f"[{i}/{len(need)}] GET {z['mb']} MB  {z['name']}")
    try:
        gdown.download(id=z["id"], output=str(dest), quiet=False)
        if dest.exists() and dest.stat().st_size > 1000:
            print(f"  OK {dest.stat().st_size} bytes")
            ok += 1
        else:
            print("  EMPTY")
            fail += 1
    except Exception as e:
        print(f"  ERR {e}")
        fail += 1
print(f"Download summary ok={ok} fail={fail}")
if ok == 0:
    sys.exit(2)
PY

echo "=== Unpack ==="
node scripts/phase3/unpack-downloads.mjs
echo "=== Ingest / index / SFT / eval ==="
node scripts/phase3/ingest.mjs
node scripts/phase3/build-index.mjs
node scripts/phase3/build-sft.mjs
node scripts/eval-phase3.mjs
echo "=== DONE $(date) ==="
echo "Press Enter to close."
read
