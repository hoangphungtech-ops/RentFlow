#!/usr/bin/env sh
set -eu
umask 077
: "${RENTFLOW_ENV_FILE:?Set path to production environment file}"
: "${RENTFLOW_BACKUP_DIR:?Set a private backup directory}"
command -v gzip >/dev/null
mkdir -p "$RENTFLOW_BACKUP_DIR"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
output="$RENTFLOW_BACKUP_DIR/rentflow-$stamp.sql.gz"
[ ! -e "$output" ]
dump=$(mktemp "$RENTFLOW_BACKUP_DIR/.rentflow-XXXXXX")
archive=$(mktemp "$RENTFLOW_BACKUP_DIR/.rentflow-XXXXXX")
trap 'rm -f -- "$dump" "$archive"' EXIT HUP INT TERM
docker compose --env-file "$RENTFLOW_ENV_FILE" -p rentflow-production -f "$(dirname "$0")/compose.production.yml" \
  exec -T mysql sh -ec 'export MYSQL_PWD="$MYSQL_PASSWORD"; exec mysqldump -u "$MYSQL_USER" --single-transaction --no-tablespaces --set-gtid-purged=OFF "$MYSQL_DATABASE"' > "$dump"
test -s "$dump"
gzip -c "$dump" > "$archive"
gzip -t "$archive"
mv "$archive" "$output"
printf '%s\n' "$output"
