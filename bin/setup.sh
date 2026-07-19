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
  restic_password="$(openssl rand -base64 48 | tr -d '\n')"
  sed -i.bak "s/replace-with-a-long-random-password/${postgres_password}/; s/replace-with-at-least-32-random-characters/${api_token}/; s/replace-with-64-hex-characters/${master_key}/; s|replace-with-original-restic-password|${restic_password}|" .env
  rm -f .env.bak
  chmod 600 .env
  echo "Created .env. Complete its domain, mirror and R2 values before deployment."
else
  echo ".env already exists; leaving it unchanged."
fi

# Migrate a valid legacy split-secret installation into the root .env.
if [ -s secrets/r2.env ] && ! grep -q 'replace-with-' secrets/r2.env && [ -s secrets/restic-password ]; then
  set -a
  # shellcheck disable=SC1091
  . ./secrets/r2.env
  set +a
  for name in AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION RESTIC_REPOSITORY; do
    if ! grep -q "^${name}=" .env; then printf '%s=%s\n' "${name}" "${!name:-}" >> .env; fi
  done
  if ! grep -q '^RESTIC_PASSWORD=' .env; then
    printf 'RESTIC_PASSWORD=%s\n' "$(sed -n '1p' secrets/restic-password)" >> .env
  fi
fi

if ! grep -q '^AWS_ACCESS_KEY_ID=' .env; then printf 'AWS_ACCESS_KEY_ID=replace-with-r2-access-key-id\n' >> .env; fi
if ! grep -q '^AWS_SECRET_ACCESS_KEY=' .env; then printf 'AWS_SECRET_ACCESS_KEY=replace-with-r2-secret-access-key\n' >> .env; fi
if ! grep -q '^AWS_DEFAULT_REGION=' .env; then printf 'AWS_DEFAULT_REGION=auto\n' >> .env; fi
if ! grep -q '^RESTIC_REPOSITORY=' .env; then printf 'RESTIC_REPOSITORY=replace-with-restic-repository-url\n' >> .env; fi
if ! grep -q '^RESTIC_PASSWORD=' .env; then printf 'RESTIC_PASSWORD=replace-with-original-restic-password\n' >> .env; fi
chmod 600 .env

if [ ! -s certs/prod-ca-2021.crt ]; then
  echo "Missing certs/prod-ca-2021.crt. Restore the tracked Supabase root certificate before deployment." >&2
  exit 1
fi

if "${ROOT}/bin/materialize-secrets.sh"; then
  echo "Deployment secrets are ready. You can run ./bin/deploy.sh."
else
  echo "Setup is incomplete. Fill the backup credential placeholders in .env, then run ./bin/deploy.sh." >&2
  exit 1
fi
