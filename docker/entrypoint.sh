#!/bin/sh
set -eu
if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
  node server-dist/migrate.js
fi
exec "$@"
