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

if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [[ "${TELEGRAM_BOT_TOKEN}" != replace-with-* ]]; then
  printf '%s\n' "${TELEGRAM_BOT_TOKEN}" > secrets/vaultbase-telegram-token
else
  : > secrets/vaultbase-telegram-token
fi
chmod 600 secrets/vaultbase-telegram-token

if [ -n "${HEALTHCHECKS_PING_URLS_JSON:-}" ]; then
  case "${HEALTHCHECKS_PING_URLS_JSON}" in
    \{*\})
      printf '%s\n' "${HEALTHCHECKS_PING_URLS_JSON}" > secrets/vaultbase-healthchecks-ping-urls
      ;;
    *)
      echo "HEALTHCHECKS_PING_URLS_JSON must be a one-line JSON object." >&2
      exit 1
      ;;
  esac
elif [ -n "${HEALTHCHECKS_BACKUP_PING_URL:-}" ] && [[ "${HEALTHCHECKS_BACKUP_PING_URL}" != *replace-with-* ]]; then
  case "${HEALTHCHECKS_BACKUP_PING_URL}" in
    https://hc-ping.com/*)
      printf '%s\n' "${HEALTHCHECKS_BACKUP_PING_URL}" > secrets/vaultbase-healthchecks-ping-urls
      chmod 600 secrets/vaultbase-healthchecks-ping-urls
      ;;
    *)
      echo "HEALTHCHECKS_BACKUP_PING_URL must start with https://hc-ping.com/." >&2
      exit 1
      ;;
  esac
else
  : > secrets/vaultbase-healthchecks-ping-urls
fi
chmod 600 secrets/vaultbase-healthchecks-ping-urls

trap - EXIT
