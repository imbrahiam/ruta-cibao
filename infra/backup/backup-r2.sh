#!/usr/bin/env bash
# One compressed database dump a day, kept off the server in an S3-compatible bucket.
#
#   infra/backup/backup-r2.sh            # from cron, once a day
#
# The object is named by its UTC day, so running it twice in a day replaces that day's dump
# rather than adding one: the bucket holds one object per day and its own lifecycle rule
# (30 days) removes the old ones. Photos already live in the object store and are not copied.
#
# .env is read for five values and never executed. BACKUP_BUCKET names the bucket; the endpoint
# and credentials are the app's own S3_* ones.
set -euo pipefail
umask 077
cd "$(dirname "$0")/../.."

value() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
ENDPOINT=$(value S3_ENDPOINT)
KEY=$(value S3_ACCESS_KEY_ID)
SECRET=$(value S3_SECRET_ACCESS_KEY)
BUCKET=${BACKUP_BUCKET:-$(value BACKUP_BUCKET)}
[ -n "$ENDPOINT" ] && [ -n "$KEY" ] && [ -n "$SECRET" ] && [ -n "$BUCKET" ] || {
  echo "S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and BACKUP_BUCKET must be set in .env" >&2
  exit 1
}

DAY=$(date -u +%Y-%m-%d)
DUMP=$(mktemp)
trap 'rm -f "$DUMP"' EXIT

# Custom format is compressed and restores with pg_restore (see restore.sh).
docker compose --env-file .env -f infra/docker-compose.vps.yml exec -T postgres \
  sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$DUMP"
[ -s "$DUMP" ] || {
  echo "the dump is empty; nothing was uploaded" >&2
  exit 1
}

curl --fail --silent --show-error --aws-sigv4 "aws:amz:auto:s3" --user "$KEY:$SECRET" \
  --upload-file "$DUMP" "$ENDPOINT/$BUCKET/db/ruta-cibao-$DAY.dump"
echo "uploaded db/ruta-cibao-$DAY.dump ($(du -h "$DUMP" | cut -f1))"
