#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"
command -v openssl >/dev/null || { echo "openssl is required" >&2; exit 1; }
mkdir -p secrets runtime/secrets runtime/storage-cache runtime/restic-cache
chmod 700 secrets runtime/secrets runtime/storage-cache runtime/restic-cache
if [ ! -f .env ]; then
  cp .env.example .env
  postgres_password="$(openssl rand -hex 32)"
  api_token="$(openssl rand -hex 32)"
  master_key="$(openssl rand -hex 32)"
  sed -i.bak "s/replace-with-a-long-random-password/${postgres_password}/; s/replace-with-at-least-32-random-characters/${api_token}/; s/replace-with-64-hex-characters/${master_key}/" .env
  rm -f .env.bak
  chmod 600 .env
  echo "Created .env. Set NGINX_DOMAIN and MIRROR_DATABASE_URL before deployment."
else
  echo ".env already exists; leaving it unchanged."
fi
if [ ! -f secrets/restic-password ]; then
  openssl rand -base64 48 > secrets/restic-password
  chmod 600 secrets/restic-password
  echo "Created a new Restic password. Store a second copy in your password manager before using it."
fi
if [ ! -f secrets/r2.env ]; then
  cp runner/r2.env.example secrets/r2.env
  chmod 600 secrets/r2.env
  echo "Created secrets/r2.env template. Add the R2 access key and secret."
fi
