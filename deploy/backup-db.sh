#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."
backup_dir="${BACKUP_DIR:-./backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$backup_dir/discipline-$timestamp.dump"

umask 077
mkdir -p "$backup_dir"
docker compose exec -T db pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --username=discipline \
  discipline > "$backup_file"

printf 'Database backup saved to %s\n' "$backup_file"
