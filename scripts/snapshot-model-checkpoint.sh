#!/usr/bin/env bash
# Snapshot restore card + checksums to a dated Desktop folder (does NOT copy 28GB weights).
# Usage: bash scripts/snapshot-model-checkpoint.sh [v2|v3]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAG="${1:-v2}"
STAMP="$(date +%Y%m%d-%H%M)"
DEST="$HOME/Desktop/ShiftED-MODEL-CHECKPOINT-${TAG}-${STAMP}"

mkdir -p "$DEST"
cp -f "$ROOT/docs/exports/model-backup-v2/"* "$DEST/" 2>/dev/null || true
cp -f "$ROOT/docs/MODEL-CHECKPOINT-BACKUP-V3.md" "$DEST/" 2>/dev/null || true

cat > "$DEST/CHECKPOINT-POINTER.txt" <<EOF
ShiftED checkpoint snapshot — $STAMP
Tag: $TAG

IMMUTABLE WEIGHTS (do not delete):
  Laptop: $ROOT/models/empathy-coach-qwen14-merged-${TAG}
  MLX:    $ROOT/models/empathy-coach-qwen14-merged-${TAG}-mlx-4bit
  RunPod volume: lo3n0gefun
  RunPod path:   /runpod-volume/models/empathy-coach-qwen14-merged-${TAG}
  Endpoint v2:   ukbtc1h97b2y2h  (keep on v2 during V3 train)

V3 MUST write to NEW folders only (*-sft-v3 / *-merged-v3).
Verify: bash $ROOT/scripts/verify-model-checkpoint-v2.sh
Policy: $ROOT/docs/MODEL-CHECKPOINT-BACKUP-V3.md
EOF

echo "Wrote $DEST"
ls -la "$DEST"
