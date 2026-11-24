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

RETENCION_DIAS="${RETENCION_DIAS:-30}"
if [[ ! "$RETENCION_DIAS" =~ ^[0-9]+$ ]]; then
  echo "Error: RETENCION_DIAS debe ser un número entero no negativo." >&2
  exit 1
fi

umask 077
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups"
mkdir -p "$DIR"

FECHA="$(date -u +%Y%m%d_%H%M%SZ)"
TEMPORAL="$(mktemp "$DIR/.inventario_${FECHA}_XXXXXX")"
trap 'rm -f -- "$TEMPORAL"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

ARCHIVO="$DIR/${TEMPORAL##*/.}.dump"
pg_dump --format=custom --file="$TEMPORAL" "$DB_URL"
pg_restore --file=- "$TEMPORAL" >/dev/null
mv -- "$TEMPORAL" "$ARCHIVO"
echo "Backup creado: $ARCHIVO"

find "$DIR" -type f -name "inventario_*.dump" -mtime "+$RETENCION_DIAS" -print -delete

echo "Para restaurar en una base vacía: pg_restore --exit-on-error --single-transaction --dbname=\"\$DATABASE_URL\" \"$ARCHIVO\""
