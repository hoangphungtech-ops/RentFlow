#!/usr/bin/env sh
set -eu
umask 077
if [ "$#" -ne 2 ]; then
  echo "Usage: RESTORE_CONFIRM=YES sh deploy/restore.sh <database.sql.gz> <uploads.tar.gz>" >&2
  exit 2
fi
: "${RENTFLOW_ENV_FILE:?Set path to production environment file}"
: "${RENTFLOW_BACKUP_DIR:?Set a private backup directory}"
[ "${RESTORE_CONFIRM:-}" = YES ] || { echo 'Set RESTORE_CONFIRM=YES after reviewing the target and backups.' >&2; exit 2; }
database_archive=$1
images_archive=$2
[ -f "$database_archive" ] && [ -f "$images_archive" ]
gzip -t "$database_archive"
tar -tzf "$images_archive" | while IFS= read -r item; do
  case "$item" in
    /*|../*|*/../*|*/..|..)
      echo "Unsafe path in image backup: $item" >&2
      exit 1
      ;;
  esac
done
temp=$(mktemp -d)
trap 'rm -rf -- "$temp"' EXIT HUP INT TERM
tar -xzf "$images_archive" -C "$temp"
compose() { docker compose --env-file "$RENTFLOW_ENV_FILE" -p rentflow-production -f "$(dirname "$0")/compose.production.yml" "$@"; }

# Capture a rollback point before touching either the database or the image volume.
"$(dirname "$0")/backup.sh"
compose stop api
gzip -dc "$database_archive" | compose exec -T mysql sh -ec 'export MYSQL_PWD="$MYSQL_PASSWORD"; exec mysql -u "$MYSQL_USER" "$MYSQL_DATABASE"'
compose run --rm --no-deps -T --entrypoint sh api -ec 'find /app/uploads -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +'
tar -czf - -C "$temp" . | compose run --rm --no-deps -T --entrypoint tar api -xzf - -C /app/uploads
compose up -d --no-deps api
printf '%s\n' 'Database and room images restored. Verify service health and ledger totals before reopening traffic.'
