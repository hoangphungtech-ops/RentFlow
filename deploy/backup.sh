#!/usr/bin/env sh
set -eu
umask 077
: "${RENTFLOW_ENV_FILE:?Set path to production environment file}"
: "${RENTFLOW_BACKUP_DIR:?Set a private backup directory}"
command -v gzip >/dev/null
mkdir -p "$RENTFLOW_BACKUP_DIR"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
output="$RENTFLOW_BACKUP_DIR/rentflow-$stamp.sql.gz"
images_output="$RENTFLOW_BACKUP_DIR/rentflow-$stamp-uploads.tar.gz"
[ ! -e "$output" ]
[ ! -e "$images_output" ]
dump=$(mktemp "$RENTFLOW_BACKUP_DIR/.rentflow-XXXXXX")
archive=$(mktemp "$RENTFLOW_BACKUP_DIR/.rentflow-XXXXXX")
images_dir=$(mktemp -d "$RENTFLOW_BACKUP_DIR/.rentflow-uploads-XXXXXX")
images_archive=$(mktemp "$RENTFLOW_BACKUP_DIR/.rentflow-XXXXXX")
trap 'rm -f -- "$dump" "$archive" "$images_archive"; rm -rf -- "$images_dir"' EXIT HUP INT TERM
compose() { docker compose --env-file "$RENTFLOW_ENV_FILE" -p rentflow-production -f "$(dirname "$0")/compose.production.yml" "$@"; }
compose \
  exec -T mysql sh -ec 'export MYSQL_PWD="$MYSQL_PASSWORD"; exec mysqldump -u "$MYSQL_USER" --single-transaction --no-tablespaces --set-gtid-purged=OFF "$MYSQL_DATABASE"' > "$dump"
test -s "$dump"
gzip -c "$dump" > "$archive"
gzip -t "$archive"
mv "$archive" "$output"
compose cp api:/app/uploads/. "$images_dir"
tar -czf "$images_archive" -C "$images_dir" .
tar -tzf "$images_archive" >/dev/null
mv "$images_archive" "$images_output"
printf '%s\n' "$output"
printf '%s\n' "$images_output"
