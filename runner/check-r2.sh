#!/usr/bin/env bash
set -Eeuo pipefail

config_file="${VAULTBASE_R2_ENV:-/etc/vaultbase/r2.env}"
if [[ ! -r "$config_file" ]]; then
  echo "R2 config not found: $config_file" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$config_file"
: "${R2_ENDPOINT:?R2_ENDPOINT is required}"
: "${R2_BUCKET:?R2_BUCKET is required}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"

command -v aws >/dev/null || { echo "aws CLI is required" >&2; exit 1; }

echo "Checking bucket ${R2_BUCKET} via ${R2_ENDPOINT}"
AWS_DEFAULT_REGION="${R2_REGION:-auto}" \
  aws s3api head-bucket \
    --bucket "$R2_BUCKET" \
    --endpoint-url "$R2_ENDPOINT"
echo "R2 connection successful"
