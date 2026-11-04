#!/usr/bin/env bash
# Proves the newest snapshot restores, without touching production data.
#
# Restores into a throwaway database on the running Postgres, checks that the
# schema and the core tables came back, then drops it. Safe to run while the
# service is up; the only shared resource is disk and connection slots.
set -euo pipefail
TASK_ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$TASK_ROOT"
DEST=${BACKUP_DIR:-/var/backups/ruta-cibao}
DUMP=${1:-$(ls -1t "$DEST"/db-*.dump 2>/dev/null | head -n 1)}
[ -n "${DUMP:-}" ] && [ -f "$DUMP" ] || {
  echo "no database snapshot found in $DEST" >&2
  exit 1
}
COMPOSE=(docker compose --env-file .env -f infra/docker-compose.yml --profile full)
DB="ruta_cibao_rehearsal_$(date -u +%s)"

cleanup() {
  "${COMPOSE[@]}" exec -T postgres sh -c 'exec dropdb -U "$POSTGRES_USER" --force "$1"' sh "$DB" \
    >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "restoring $DUMP into $DB"
"${COMPOSE[@]}" exec -T postgres sh -c 'exec createdb -U "$POSTGRES_USER" "$1"' sh "$DB"
"${COMPOSE[@]}" exec -T postgres sh -c \
  'exec pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --exit-on-error --single-transaction' \
  sh "$DB" < "$DUMP"

READY=$("${COMPOSE[@]}" exec -T postgres sh -c \
  'exec psql -U "$POSTGRES_USER" -d "$1" -tAc "select to_regclass('"'"'public.member_profiles'"'"') is not null and to_regclass('"'"'public.job_outbox'"'"') is not null"' \
  sh "$DB" | tr -d '[:space:]')
[ "$READY" = "t" ] || {
  echo "restored database is missing core tables" >&2
  exit 1
}
COUNT=$("${COMPOSE[@]}" exec -T postgres sh -c \
  'exec psql -U "$POSTGRES_USER" -d "$1" -tAc "select count(*) from member_profiles"' \
  sh "$DB" | tr -d '[:space:]')
echo "rehearsal passed: schema present, $COUNT member profiles restored"
echo "the throwaway database is dropped on exit"
