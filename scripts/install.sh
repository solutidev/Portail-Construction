#!/usr/bin/env bash
# First-time install on a Docker host. Does not overwrite an existing .env.
set -euo pipefail

REPO_URL="${REPO_URL:-}"
INSTALL_DIR="${INSTALL_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BRANCH="${GIT_BRANCH:-main}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Engine + Compose plugin first."
  exit 1
fi

if [[ ! -d "$INSTALL_DIR/.git" ]]; then
  if [[ -z "$REPO_URL" ]]; then
    echo "Set REPO_URL to your GitHub clone URL, or run this from a cloned repo."
    echo "  REPO_URL=https://github.com/org/frx-portal.git INSTALL_DIR=/opt/frx-portal sudo -E bash scripts/install.sh"
    exit 1
  fi
  sudo mkdir -p "$INSTALL_DIR"
  sudo git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
if [[ ! -f .env ]]; then
  sudo cp .env.example .env
  echo "Created $INSTALL_DIR/.env — edit secrets before going live."
fi

sudo docker compose up -d --build
echo
echo "Installed. Open http://<server>:${PORT:-8080}"
echo "First visit: create the administrator account (stored in Postgres)."
echo "Later updates:  sudo bash $INSTALL_DIR/scripts/update.sh"
