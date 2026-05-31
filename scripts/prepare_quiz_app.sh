#!/usr/bin/env bash
# Sync QCM JSON into the GitHub Pages quiz app.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/annales-nsi-premiere/qcm-json/toutes-questions-uniques-avec-corrections.json"
DEST="$ROOT/docs/data/qcm.json"
mkdir -p "$(dirname "$DEST")"
cp "$SRC" "$DEST"
echo "Copied $(wc -c < "$DEST") bytes to docs/data/qcm.json"
