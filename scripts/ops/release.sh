#!/usr/bin/env bash
# Cuts a release tag after the checks a deploy depends on.
#
# A tag is the only thing this project deploys and the only thing it rolls back
# to, so it is created here rather than by hand: a tag on a tree that failed a
# check is a promise the code cannot keep.
set -euo pipefail
VERSION=${1:?usage: scripts/ops/release.sh <major.minor.patch>}
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
  echo "version must be major.minor.patch, got: $VERSION" >&2
  exit 1
}
cd "$(dirname "$0")/../.."

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "not a git repository" >&2
  exit 1
}
[ -z "$(git status --porcelain)" ] || {
  echo "working tree is not clean; commit or stash first" >&2
  exit 1
}
! git rev-parse "v$VERSION" >/dev/null 2>&1 || {
  echo "tag v$VERSION already exists" >&2
  exit 1
}

echo "==> typecheck"
bun run typecheck
echo "==> lint"
bun run lint
echo "==> tests"
bun run test:db
echo "==> build"
bun run build
echo "==> documentation"
bun run check:docs
echo "==> quality"
bun run check:quality

echo "==> restore rehearsal"
infra/restore-rehearsal.sh

PREVIOUS_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo none)

git tag -a "v$VERSION" -m "Ruta Cibao $VERSION"
echo "tagged v$VERSION at $(git rev-parse --short HEAD)"
echo "next: git push origin main --follow-tags"
echo
echo "to roll back: deploy the previous tag (currently $PREVIOUS_TAG)"
echo "and restore the database with infra/restore.sh before restarting the worker."
