#!/bin/sh
# Conserva contenedores y volúmenes para inspección; nunca ejecuta down -v.
set -eu
RAIZ="$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)"
if [ -z "${ENTORNO_PRUEBA:-}" ]; then
ENTORNO_PRUEBA="$(mktemp /tmp/sigape-pruebas.XXXXXX)"
chmod 600 "$ENTORNO_PRUEBA"
python3 - "$ENTORNO_PRUEBA" <<'PY'
import secrets, sys
from pathlib import Path
Path(sys.argv[1]).write_text('CLAVE_PRUEBA=' + secrets.token_hex(32) + '\n')
PY
fi
PROYECTO_PRUEBA="${PROYECTO_PRUEBA:-sigape-pruebas-$(date +%s)}"
componer() {
  docker compose --env-file "$ENTORNO_PRUEBA" -p "$PROYECTO_PRUEBA" -f "$RAIZ/microservicios/votacion/pruebas/compose.yml" "$@"
}
printf 'Proyecto aislado: %s; entorno privado: %s\n' "$PROYECTO_PRUEBA" "$ENTORNO_PRUEBA"
componer up -d --build --wait --wait-timeout 180
componer run --rm --no-deps pruebas
componer stop resultados-auditoria
componer run --rm --no-deps pruebas python /pruebas/integracion.py sin-auditoria
componer start resultados-auditoria
componer run --rm --no-deps pruebas python /pruebas/integracion.py verificar
componer stop mensajeria-rabbitmq
componer run --rm --no-deps pruebas python /pruebas/integracion.py sin-rabbit
# Reiniciar publicador antes de recuperar Rabbit verifica la durabilidad de la bandeja.
componer restart votacion
componer start mensajeria-rabbitmq
componer run --rm --no-deps pruebas python /pruebas/integracion.py verificar
componer restart base-postgres base-mongodb cache-redis votacion resultados resultados-conteo resultados-auditoria
componer up -d --wait --wait-timeout 180
componer run --rm --no-deps pruebas python /pruebas/integracion.py verificar
componer run --rm --no-deps pruebas python /pruebas/integracion.py ack-y-reintentos
componer stop cache-redis
componer run --rm --no-deps pruebas python /pruebas/integracion.py sin-redis
componer start cache-redis
componer run --rm --no-deps pruebas python /pruebas/integracion.py nginx
componer run --rm --no-deps pruebas python /pruebas/integracion.py verificar
componer ps
printf 'Pruebas completadas. Se conservan datos y entorno para inspección.\n'
