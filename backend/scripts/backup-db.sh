#!/usr/bin/env bash
# Respaldo de la base de datos vía pg_dump. Usa $DATABASE_URL (mismo formato que
# backend/.env) o el primer argumento como cadena de conexión.
#
# Uso:
#   DATABASE_URL="postgresql://user:pass@host:5432/inventario_db" ./scripts/backup-db.sh
#   ./scripts/backup-db.sh "postgresql://user:pass@host:5432/inventario_db"
#
# Genera un dump comprimido en formato "custom" de pg_dump (restaurable con pg_restore,
# y más chico que un .sql plano) en backend/backups/, nombrado con fecha y hora, y borra
# los que tengan más de $RETENCION_DIAS días (default 30).

set -euo pipefail

DB_URL="${1:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "Error: falta la cadena de conexión (pásala como argumento o exporta DATABASE_URL)." >&2
  exit 1
fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups"
mkdir -p "$DIR"

ARCHIVO="$DIR/inventario_$(date +%Y%m%d_%H%M%S).dump"

pg_dump --format=custom --file="$ARCHIVO" "$DB_URL"
echo "Backup creado: $ARCHIVO"

RETENCION_DIAS="${RETENCION_DIAS:-30}"
find "$DIR" -name "inventario_*.dump" -mtime "+$RETENCION_DIAS" -print -delete

echo "Para restaurar: pg_restore --clean --if-exists --dbname=\"\$DATABASE_URL\" \"$ARCHIVO\""
