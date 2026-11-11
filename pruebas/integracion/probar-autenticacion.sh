#!/bin/sh
set +x
set -eu
# Sin destinos ni credenciales predeterminados. Nunca convertir contraseñas a argv.
# Rechazar también las invocaciones antiguas antes de crear otro proceso.
ESPERA_VALOR=0
for ARGUMENTO in "$@"; do
  if [ "$ESPERA_VALOR" -eq 1 ]; then
    case "$ARGUMENTO" in
      ''|--*) printf '%s\n' 'Falta un valor explícito; consulte --help.' >&2; exit 2 ;;
    esac
    ESPERA_VALOR=0
    continue
  fi
  case "$ARGUMENTO" in
    --url|--usuario-superadmin|--entorno-aislado|--configuracion-aislamiento|--confirmar-escrituras)
      ESPERA_VALOR=1 ;;
    --clave-por-stdin|--clave-por-entorno|--solo-estatico|--help|-h) ;;
    *) printf '%s\n' 'Parámetro rechazado; no pase contraseñas ni parámetros posicionales.' >&2; exit 2 ;;
  esac
done
if [ "$ESPERA_VALOR" -eq 1 ]; then
  printf '%s\n' 'Falta un valor explícito; consulte --help.' >&2
  exit 2
fi
RAIZ_SUITE="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
exec python3 "$RAIZ_SUITE/pruebas/integracion/probar-autenticacion.py" "$@"
