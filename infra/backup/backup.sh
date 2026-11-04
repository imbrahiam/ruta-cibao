#!/usr/bin/env bash
# Database and local S3 snapshots. Copy the result off-host separately.
# .env is parsed by Compose, never executed as shell code or backed up.
set -euo pipefail
umask 077
TASK_ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$TASK_ROOT"
COMPOSE=(docker compose --env-file .env -f infra/docker-compose.yml --profile full --profile maintenance)
DEST=${BACKUP_DIR:-/var/backups/ruta-cibao}
STAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
KEEP_DAYS=${KEEP_DAYS:-14}
mkdir -p "$DEST/objects"
DEST=$(cd "$DEST" && pwd)
"${COMPOSE[@]}" exec -T postgres sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$DEST/db-$STAMP.dump.partial"
mv "$DEST/db-$STAMP.dump.partial" "$DEST/db-$STAMP.dump"
echo "database snapshot complete: db-$STAMP.dump"
if [ "${BACKUP_OBJECTS:-1}" = "1" ]; then
  BACKUP_MOUNT="$DEST" "${COMPOSE[@]}" run --rm -T -e TASK_BACKUP_STAMP="$STAMP" storage-tools '
    mkdir -p "/backups/objects/$TASK_BACKUP_STAMP" &&
    aws s3 sync "s3://$S3_BUCKET" "/backups/objects/$TASK_BACKUP_STAMP" --only-show-errors'
  tar -C "$DEST/objects/$STAMP" -cf "$DEST/objects/objects-$STAMP.tar.partial" .
  mv "$DEST/objects/objects-$STAMP.tar.partial" "$DEST/objects/objects-$STAMP.tar"
  rm -rf "$DEST/objects/$STAMP"
  echo "local object snapshot complete: objects-$STAMP.tar"
fi
find "$DEST" -name 'db-*.dump' -mtime +"$KEEP_DAYS" -delete
find "$DEST/objects" -name 'objects-*.tar' -mtime +"$KEEP_DAYS" -delete
