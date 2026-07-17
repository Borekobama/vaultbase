#!/usr/bin/env bash
set -Eeuo pipefail

config_file="${VAULTBASE_R2_ENV:-/etc/vaultbase/r2.env}"
if [[ ! -r "$config_file" ]]; then
  echo "R2 config not found: $config_file" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$config_file"
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY is required}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE is required}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"

command -v restic >/dev/null || { echo "restic is required" >&2; exit 1; }
export AWS_DEFAULT_REGION="${R2_REGION:-auto}"

restic snapshots
restic check
