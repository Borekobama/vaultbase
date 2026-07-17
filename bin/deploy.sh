#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

PROJECT="${PROJECT:-vaultbase}"
BUILDER="${BUILDER:-b-vaultbase}"
COMPOSE_FILE="${PROJECT_ROOT}/infra/docker-compose.yml"
CLEAN_BUILD=0
AGGRESSIVE_CLEAN=0
STATUS_ONLY=0
CLEANUP_ONLY=0

usage() {
  cat <<USAGE
Usage: $(basename "$0") [--clean-build] [--aggressive-clean] [--status] [--cleanup-only]
USAGE
}

log() { printf '[deploy:%s] %s\n' "${PROJECT}" "$*"; }
require() { command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }; }
compose() { docker compose -f "${COMPOSE_FILE}" -p "${PROJECT}" "$@"; }

while [ "$#" -gt 0 ]; do
  case "$1" in
    --clean-build) CLEAN_BUILD=1 ;;
    --aggressive-clean) AGGRESSIVE_CLEAN=1 ;;
    --status) STATUS_ONLY=1 ;;
    --cleanup-only) CLEANUP_ONLY=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
  shift
done

if [ -f "${PROJECT_ROOT}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "${PROJECT_ROOT}/.env"
  set +a
fi

require docker
require curl
docker compose version >/dev/null

if [ "${STATUS_ONLY}" -eq 1 ]; then compose ps; docker system df || true; exit 0; fi

mkdir -p runtime/secrets runtime/storage-cache runtime/restic-cache secrets
chmod 700 runtime/secrets runtime/storage-cache runtime/restic-cache secrets
for secret in secrets/r2.env secrets/restic-password; do
  [ -s "${secret}" ] || { echo "Missing ${secret}; run bin/setup.sh first." >&2; exit 1; }
  chmod 600 "${secret}"
done
[ -s .env ] || { echo "Missing .env; run bin/setup.sh first." >&2; exit 1; }
chmod 600 .env

export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 PROJECT_LABEL="${PROJECT}"
export APP_BUILD_ID="${APP_BUILD_ID:-$(git rev-parse --short HEAD 2>/dev/null || date -u +%Y%m%d%H%M%S)}"

if ! docker buildx inspect "${BUILDER}" >/dev/null 2>&1; then
  log "Creating project builder ${BUILDER}"
  docker buildx create --name "${BUILDER}" --driver docker-container >/dev/null
fi
docker buildx use "${BUILDER}" >/dev/null
docker buildx inspect --bootstrap "${BUILDER}" >/dev/null
export BUILDX_BUILDER="${BUILDER}"

if [ "${CLEANUP_ONLY}" -eq 1 ]; then
  if [ "${AGGRESSIVE_CLEAN}" -eq 1 ]; then docker buildx prune --builder "${BUILDER}" -af; else docker buildx prune --builder "${BUILDER}" -af --filter until=24h; fi
  docker image prune -a --filter "label=com.project=${PROJECT}" -f
  exit 0
fi

if [ "${CLEAN_BUILD}" -eq 1 ]; then compose build --pull --no-cache; else compose build; fi
log "Replacing project stack"
compose down --remove-orphans || true
compose up -d --remove-orphans

port="${VAULTBASE_PORT:-12013}"
for attempt in $(seq 1 45); do
  if curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
    log "Healthy on 127.0.0.1:${port}"
    break
  fi
  if [ "${attempt}" -eq 45 ]; then compose ps; compose logs --tail=160; exit 1; fi
  sleep 2
done

if [ -x "${SCRIPT_DIR}/nginx-sync.sh" ]; then "${SCRIPT_DIR}/nginx-sync.sh" || log "WARNING: aaPanel Nginx sync skipped or failed"; fi
docker buildx prune --builder "${BUILDER}" -af --filter until=24h >/dev/null || true
docker image prune -a --filter "label=com.project=${PROJECT}" -f >/dev/null || true
compose ps
log "Deploy completed"
