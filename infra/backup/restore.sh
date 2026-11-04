#!/usr/bin/env bash
# Destructive restore into the configured stack. Rehearse on an isolated stack.
set -euo pipefail
DUMP=${1:?usage: infra/backup/restore.sh <db dump> [objects tar]}
OBJECTS=${2:-}
[ -f "$DUMP" ] || { echo "database snapshot missing" >&2; exit 1; }
DUMP=$(cd "$(dirname "$DUMP")" && pwd)/$(basename "$DUMP")
if [ -n "$OBJECTS" ]; then
  [ -f "$OBJECTS" ] || { echo "object snapshot missing" >&2; exit 1; }
  OBJECTS=$(cd "$(dirname "$OBJECTS")" && pwd)/$(basename "$OBJECTS")
fi
TASK_ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$TASK_ROOT"
COMPOSE=(docker compose --env-file .env -f infra/docker-compose.yml --profile full --profile maintenance)
read -r -p "This replaces the configured database and objects. Type RESTORE to continue: " answer
[ "$answer" = "RESTORE" ] || { echo "cancelled"; exit 1; }
"${COMPOSE[@]}" stop app worker
"${COMPOSE[@]}" up -d --wait postgres storage
"${COMPOSE[@]}" exec -T postgres sh -c 'exec pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --exit-on-error --single-transaction' < "$DUMP"
if [ -n "$OBJECTS" ]; then
  TASK_RESTORE_DIR=$(mktemp -d)
  trap 'rm -rf "$TASK_RESTORE_DIR"' EXIT
  tar -C "$TASK_RESTORE_DIR" -xf "$OBJECTS"
  BACKUP_MOUNT="$TASK_RESTORE_DIR" "${COMPOSE[@]}" run --rm -T storage-tools '
    aws s3 sync /backups "s3://$S3_BUCKET" --delete --only-show-errors'
fi
"${COMPOSE[@]}" run --rm -T migrate
"${COMPOSE[@]}" up -d app worker caddy
echo "restore complete; check /api/ready and decrypt a test record with the original encryption key"
