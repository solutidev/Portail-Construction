#!/usr/bin/env bash
# Fill required .env values that Docker Compose interpolates.
# Safe to re-run: never overwrites a non-empty SESSION_SECRET or POSTGRES_PASSWORD.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$ROOT/.env.sample" ]]; then
    cp "$ROOT/.env.sample" "$ENV_FILE"
  elif [[ -f "$ROOT/.env.example" ]]; then
    cp "$ROOT/.env.example" "$ENV_FILE"
  else
    echo "No .env.sample found at $ROOT"
    exit 1
  fi
  echo "Created $ENV_FILE from the sample."
fi

rand() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

get_var() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '\r' || true
}

set_var() {
  local key="$1"
  local val="$2"
  python3 - "$ENV_FILE" "$key" "$val" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
key, val = sys.argv[2], sys.argv[3]
lines = path.read_text().splitlines(True)
found = False
out = []
for line in lines:
    if line.startswith(key + "="):
        out.append(f"{key}={val}\n")
        found = True
    else:
        out.append(line)
if not found:
    if out and not out[-1].endswith("\n"):
        out[-1] += "\n"
    out.append(f"{key}={val}\n")
path.write_text("".join(out))
PY
}

secret="$(get_var SESSION_SECRET)"
if [[ -z "$secret" ]]; then
  secret="$(rand)"
  set_var SESSION_SECRET "$secret"
  echo "Generated SESSION_SECRET in $ENV_FILE"
fi

pw="$(get_var POSTGRES_PASSWORD)"
if [[ -z "$pw" ]]; then
  pw="$(rand | cut -c1-24)"
  set_var POSTGRES_PASSWORD "$pw"
  echo "Generated POSTGRES_PASSWORD in $ENV_FILE"
fi

user="$(get_var POSTGRES_USER)"
db="$(get_var POSTGRES_DB)"
user="${user:-frx}"
db="${db:-frx}"
set_var DATABASE_URL "postgres://${user}:${pw}@db:5432/${db}"
