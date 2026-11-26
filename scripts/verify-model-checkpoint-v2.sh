#!/usr/bin/env bash
# Verify local v2 merge exists and (if Desktop checksums present) matches SHA256.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODEL="$ROOT/models/empathy-coach-qwen14-merged-v2"
SUMS_REPO="$ROOT/docs/exports/model-backup-v2/SHA256SUMS.txt"
SUMS_DESKTOP="$HOME/Desktop/ShiftED-MODEL-BACKUP-v2/SHA256SUMS.txt"

echo "== ShiftED v2 checkpoint verify =="
if [[ ! -d "$MODEL" ]]; then
  echo "FAIL: missing $MODEL"
  exit 1
fi
SHARDS=$(find "$MODEL" -name '*.safetensors' 2>/dev/null | wc -l | tr -d ' ')
echo "OK: model dir exists ($SHARDS safetensor shards)"

SUMS=""
if [[ -f "$SUMS_DESKTOP" ]]; then SUMS="$SUMS_DESKTOP"
elif [[ -f "$SUMS_REPO" ]]; then SUMS="$SUMS_REPO"
fi

if [[ -n "$SUMS" ]]; then
  echo "Checking against $SUMS"
  (cd "$MODEL" && shasum -a 256 -c "$SUMS") || {
    echo "FAIL: checksum mismatch — do not delete/overwrite until investigated"
    exit 1
  }
  echo "OK: checksums match"
else
  echo "WARN: no SHA256SUMS found — dir present but not hash-verified"
fi

MLX="$ROOT/models/empathy-coach-qwen14-merged-v2-mlx-4bit"
if [[ -d "$MLX" ]]; then
  echo "OK: MLX 4-bit vault copy present"
else
  echo "WARN: MLX 4-bit missing (Mac vault needs it)"
fi

echo "FROZEN PATHS (do not overwrite for V3):"
echo "  $MODEL"
echo "  RunPod volume lo3n0gefun → /runpod-volume/models/empathy-coach-qwen14-merged-v2"
echo "  Endpoint ukbtc1h97b2y2h must stay on merged-v2 until V3 A/B passes"
echo "DONE"
