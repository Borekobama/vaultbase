#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

[ -s .env ] || { echo "Missing .env; run bin/setup.sh first." >&2; exit 1; }

set -a
# shellcheck disable=SC1091
. ./.env
set +a

required=(AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY RESTIC_REPOSITORY RESTIC_PASSWORD)
missing=()
for name in "${required[@]}"; do
  value="${!name:-}"
  if [ -z "${value}" ] || [[ "${value}" == replace-with-* ]]; then missing+=("${name}"); fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "Vaultbase backup credentials are missing or still placeholders in .env:" >&2
  printf '  - %s\n' "${missing[@]}" >&2
  echo "Add the existing R2 credentials and the ORIGINAL Restic password, then rerun deploy.sh." >&2
  exit 1
fi

mkdir -p secrets
chmod 700 secrets
umask 077

r2_tmp="$(mktemp "${ROOT}/secrets/r2.env.XXXXXX")"
trap 'rm -f "${r2_tmp}"' EXIT
{
  printf 'AWS_ACCESS_KEY_ID=%s\n' "${AWS_ACCESS_KEY_ID}"
  printf 'AWS_SECRET_ACCESS_KEY=%s\n' "${AWS_SECRET_ACCESS_KEY}"
  printf 'AWS_DEFAULT_REGION=%s\n' "${AWS_DEFAULT_REGION:-auto}"
  printf 'RESTIC_REPOSITORY=%s\n' "${RESTIC_REPOSITORY}"
} > "${r2_tmp}"
mv "${r2_tmp}" secrets/r2.env
printf '%s\n' "${RESTIC_PASSWORD}" > secrets/restic-password
chmod 600 secrets/r2.env secrets/restic-password .env
trap - EXIT
