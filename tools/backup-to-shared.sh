#!/usr/bin/env bash
# Mirror the DCC card-battle project to the persistent ~/shared backup.
# Excludes node_modules (regenerable). Preserves git history. Writes a stamp file.
# Usage: bash tools/backup-to-shared.sh
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/shared/dcc-card-battle"
mkdir -p "$DEST"

rsync -a --delete \
  --exclude 'node_modules' \
  --exclude 'server.log' \
  --exclude '*.bak' \
  --exclude 'BACKUP_INFO.txt' \
  "$SRC/" "$DEST/"

# Stamp with timestamp + git state so we always know how fresh the backup is
{
  echo "Backed up: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo "From: $SRC"
  echo "Git HEAD: $(cd "$SRC" && git rev-parse --short HEAD 2>/dev/null || echo 'n/a')"
  echo "Git branch: $(cd "$SRC" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'n/a')"
  echo "Last commit: $(cd "$SRC" && git log -1 --pretty='%s' 2>/dev/null || echo 'n/a')"
  echo "Card art PNGs: $(ls "$DEST"/public/cards/*.png 2>/dev/null | wc -l | tr -d ' ')"
  echo "Backup size: $(du -sh "$DEST" 2>/dev/null | cut -f1)"
} > "$DEST/BACKUP_INFO.txt"

echo "✅ Backed up to $DEST"
cat "$DEST/BACKUP_INFO.txt"
