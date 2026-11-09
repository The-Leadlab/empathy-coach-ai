import json, os, sys
from pathlib import Path
for k in list(os.environ):
    if "proxy" in k.lower():
        os.environ.pop(k, None)
root = Path("/Users/attia/Desktop/Paginas web/New folder/empathy-coach-ai")
zips = {z["name"]: z for z in json.loads((root / "data/processed/drive-zips.json").read_text())["all"]}
out = root / "data/raw/_downloads"
out.mkdir(parents=True, exist_ok=True)
need = [
    "ShiftedAI-data-part2e.zip",
    "ShiftedAI-data-part4a-CCI-and-Simon-audio-transcripts.zip",
]
import gdown
for name in need:
    z = zips[name]
    dest = out / name
    if dest.exists() and dest.stat().st_size > 1000:
        print("exists", name, dest.stat().st_size)
        continue
    print("GET", name, z["mb"], "MB")
    gdown.download(id=z["id"], output=str(dest), quiet=False)
    print("size", dest.stat().st_size if dest.exists() else None)
print("DONE")
