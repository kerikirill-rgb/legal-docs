#!/usr/bin/env bash
# Восстановление из gzip SQL-дампа. ОСТОРОЖНО: перезаписывает БД.
set -euo pipefail

FILE=${1:?usage: restore.sh path/to/doma-....sql.gz}

if docker compose ps db --status running >/dev/null 2>&1; then
  gunzip -c "$FILE" | docker compose exec -T db psql -U doma -d doma
else
  gunzip -c "$FILE" | PGPASSWORD="${POSTGRES_PASSWORD:-doma}" psql -h "${PGHOST:-127.0.0.1}" -U "${PGUSER:-doma}" "${PGDATABASE:-doma}"
fi

echo "restore_done"
