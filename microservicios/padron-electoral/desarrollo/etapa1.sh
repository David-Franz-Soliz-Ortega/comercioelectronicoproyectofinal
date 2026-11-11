#!/bin/sh
# Operaciones limitadas a los dos proyectos Docker del integrante 2.
set -eu
carpeta_padron=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
carpeta_candidaturas="$carpeta_padron/../candidaturas"

padron() {
  docker compose --env-file "$carpeta_padron/.env" -f "$carpeta_padron/compose.etapa1.yml" "$@"
}
candidaturas() {
  docker compose --env-file "$carpeta_candidaturas/.env" -f "$carpeta_candidaturas/compose.etapa1.yml" "$@"
}
case "${1:-ayuda}" in
  preparar)
    python3 "$carpeta_padron/desarrollo/preparar_entorno.py"
    ;;
  iniciar)
    python3 "$carpeta_padron/desarrollo/preparar_entorno.py"
    # Construcción secuencial para reducir el pico de memoria.
    python3 "$carpeta_padron/desarrollo/construir.py" padron-electoral
    padron up -d --no-build --wait --wait-timeout 150
    python3 "$carpeta_padron/desarrollo/construir.py" candidaturas
    candidaturas up -d --no-build --wait --wait-timeout 150
    ;;
  cargar)
    padron exec -T padron-electoral node dist/cargar-demostracion.js
    candidaturas exec -T candidaturas python -m app.cargar_demostracion
    ;;
  probar)
    padron exec -T padron-electoral node --test pruebas/etapa1.mjs
    candidaturas exec -T candidaturas python -m unittest discover -s pruebas -p 'test_*.py' -v
    ;;
  estado)
    padron ps
    candidaturas ps
    ;;
  detener)
    padron stop
    candidaturas stop
    ;;
  *)
    echo "Uso: sh microservicios/padron-electoral/desarrollo/etapa1.sh preparar|iniciar|cargar|probar|estado|detener"
    exit 1
    ;;
esac
