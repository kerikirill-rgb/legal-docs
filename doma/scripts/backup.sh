#!/usr/bin/env bash
# Резервное копирование PostgreSQL (запускать на хосте с доступом к контейнеру/БД).
# Копию храните ВНЕ основного сервера.
set -euo pipefail

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT_DIR=${1:-./backups}
mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/doma-$STAMP.sql.gz"

if docker compose ps db --status running >/dev/null 2>&1; then
  docker compose exec -T db pg_dump -U doma doma | gzip > "$FILE"
else
  PGPASSWORD="${POSTGRES_PASSWORD:-doma}" pg_dump -h "${PGHOST:-127.0.0.1}" -U "${PGUSER:-doma}" "${PGDATABASE:-doma}" | gzip > "$FILE"
fi

echo "backup_written $FILE"
