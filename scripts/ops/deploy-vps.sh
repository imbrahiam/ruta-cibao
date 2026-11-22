#!/usr/bin/env bash
# Puts one commit's published images live on the server.
#
# Runs on the server, as the forced command of the deploy key: the only thing that key can do.
# The commit arrives as the SSH command's text and is checked to be a full SHA before it is used.
set -euo pipefail
SHA=${SSH_ORIGINAL_COMMAND:-${1:-}}
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || {
  echo "usage: deploy-vps.sh <40-character commit sha>" >&2
  exit 1
}
cd "$(dirname "$0")/../.."

# One deploy at a time: a second push waits for the first to finish.
exec 9>.deploy.lock
flock 9

git fetch --quiet origin
git checkout --quiet --detach "$SHA"

export RUTA_REGISTRY=ghcr.io/imbrahiam/ruta-cibao RUTA_TAG=$SHA
compose=(docker compose -f infra/docker-compose.vps.yml --env-file .env)
"${compose[@]}" pull --quiet migrate app worker
"${compose[@]}" up -d --no-build --remove-orphans

# The app answers its own health route once migrations ran and it booted.
for _ in $(seq 1 30); do
  if "${compose[@]}" exec -T app node -e \
    "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" \
    2>/dev/null; then
    echo "deployed $SHA"
    docker image prune --force --filter "label=org.opencontainers.image.source=https://github.com/imbrahiam/ruta-cibao" --filter "until=168h" >/dev/null
    exit 0
  fi
  sleep 4
done
echo "the app did not become healthy; showing its last lines" >&2
"${compose[@]}" logs --tail 40 app >&2
exit 1
