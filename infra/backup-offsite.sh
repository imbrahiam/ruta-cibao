#!/usr/bin/env bash
# Copies the local snapshots to another machine.
#
# A backup that shares a disk with the database is not a backup. This mirrors
# the directory produced by backup.sh; retention is decided locally, so the
# remote copy follows it.
set -euo pipefail
: "${BACKUP_REMOTE:?usage: BACKUP_REMOTE=user@host:/path infra/backup-offsite.sh}"
DEST=${BACKUP_DIR:-/var/backups/ruta-cibao}

[ -d "$DEST" ] || {
  echo "backup directory missing: $DEST" >&2
  exit 1
}
command -v rsync >/dev/null || {
  echo "rsync is required" >&2
  exit 1
}
# Refuse to mirror an empty or stale directory over a good remote copy.
NEWEST=$(find "$DEST" -maxdepth 1 -name 'db-*.dump' -newermt '-36 hours' | head -n 1)
[ -n "$NEWEST" ] || {
  echo "no database snapshot newer than 36 hours in $DEST; refusing to sync" >&2
  exit 1
}

echo "mirroring $DEST to $BACKUP_REMOTE"
rsync --archive --compress --partial --human-readable --delete-after \
  "$DEST/" "$BACKUP_REMOTE/"
echo "offsite copy complete"
