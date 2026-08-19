#!/usr/bin/env bash
# Pull the latest GitHub commit and rebuild the app container.
# Postgres data in the frx_pgdata volume is not deleted.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${GIT_BRANCH:-main}"
cd "$ROOT"

if [[ ! -d .git ]]; then
  echo "Not a git checkout: $ROOT"
  exit 1
fi

echo "Fetching $BRANCH…"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "Rebuilding app image (Postgres volume is kept)…"
docker compose up -d --build --remove-orphans

echo
echo "Updated to $(git rev-parse --short HEAD)."
echo "Ask users to refresh the browser. Shared data stays in Postgres."
