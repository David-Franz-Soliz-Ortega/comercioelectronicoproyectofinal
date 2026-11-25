#!/usr/bin/env bash
# Inicia o retira el mapa vivo sobre el proyecto tuvoto ya desplegado.
#   scripts/feria-mapa-vivo.sh            observador + registro de NGINX + puerto de feria
#   scripts/feria-mapa-vivo.sh --caos     además permite derribar servicios desde la pantalla
#   scripts/feria-mapa-vivo.sh --detener  retira el observador y devuelve NGINX a su configuración base
# No borra volúmenes ni datos.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENTORNO="${TUVOTO_ENTORNO:-$RAIZ/.env.tuvoto}"
BASE=(-f "$RAIZ/docker-compose.yml")
CAPA=(-f "$RAIZ/infraestructura/mapa-vivo/docker-compose.mapa-vivo.yml")
CAOS=(-f "$RAIZ/infraestructura/mapa-vivo/docker-compose.mapa-vivo-caos.yml")

if [[ ! -f "$ENTORNO" ]]; then
  echo "No existe $ENTORNO. Copia .env.example y define claves propias." >&2
  exit 1
fi

compose() { docker compose --env-file "$ENTORNO" -p tuvoto "$@"; }

case "${1:-}" in
  --detener)
    compose "${BASE[@]}" "${CAPA[@]}" rm --stop --force mapa-vivo
    compose "${BASE[@]}" up -d --no-deps entrada-nginx
    echo "Mapa vivo retirado; NGINX vuelve a escuchar solo en 127.0.0.1."
    exit 0
    ;;
  --caos)
    TUVOTO_DOCKER_GID="$(getent group docker | cut -d: -f3)"
    export TUVOTO_DOCKER_GID
    ARCHIVOS=("${BASE[@]}" "${CAPA[@]}" "${CAOS[@]}")
    ;;
  "")
    ARCHIVOS=("${BASE[@]}" "${CAPA[@]}")
    ;;
  *)
    echo "Uso: $0 [--caos|--detener]" >&2
    exit 2
    ;;
esac

compose "${ARCHIVOS[@]}" up -d --build --wait mapa-vivo
# Recrea solo la entrada para cargar el registro syslog y el puerto de la red local.
compose "${ARCHIVOS[@]}" up -d --no-deps --wait entrada-nginx

PUERTO_MAPA="$(compose "${ARCHIVOS[@]}" port mapa-vivo 8080 | tail -n1)"
echo "Mapa vivo:      http://$PUERTO_MAPA"
echo "Portal (feria): revisa TUVOTO_FERIA_URL en $(basename "$ENTORNO")"
