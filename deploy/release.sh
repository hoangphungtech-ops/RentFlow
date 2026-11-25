#!/usr/bin/env sh
set -eu
: "${RENTFLOW_ENV_FILE:?Set path to production environment file}"
: "${RENTFLOW_RELEASE:?Set immutable release identifier from Git SHA}"
: "${RENTFLOW_BACKUP_DIR:?Set a private backup directory}"
base=$(dirname "$0")
compose() { docker compose --env-file "$RENTFLOW_ENV_FILE" -p rentflow-production -f "$base/compose.production.yml" "$@"; }
compose config --quiet
compose build api web migrate
compose up -d --wait mysql
sh "$base/backup.sh"
compose run --rm --no-deps migrate
compose up -d --no-build --wait
compose ps
