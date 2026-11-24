#!/usr/bin/env bash
set -eo pipefail

URL="${1:-http://localhost:8890/}"
INTERVALO="${2:-0.2}"

echo "=========================================================="
echo "  TUVOTO — Demostración de Actualización Sin Corte (P2)  "
echo "=========================================================="
echo "Consultando URL: $URL cada ${INTERVALO}s"
echo "Presiona Ctrl+C para detener la prueba."
echo ""

TOTAL=0
EXITOSOS=0
FALLOS=0

trap 'echo ""; echo "=== Resumen ==="; echo "Total peticiones: $TOTAL"; echo "Exitosas (200 OK): $EXITOSOS"; echo "Fallos: $FALLOS"; echo "Tasa de disponibilidad: $(awk "BEGIN {printf \"%.2f\", ($EXITOSOS/$TOTAL)*100}")%"; exit 0' INT

while true; do
  TOTAL=$((TOTAL + 1))
  CODIGO=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$URL" || echo "000")
  HORA=$(date +"%T")

  if [ "$CODIGO" -ge 200 ] && [ "$CODIGO" -lt 400 ]; then
    EXITOSOS=$((EXITOSOS + 1))
    echo "[$HORA] Petición #$TOTAL -> HTTP $CODIGO [DISPONIBLE]"
  else
    FALLOS=$((FALLOS + 1))
    echo "[$HORA] Petición #$TOTAL -> HTTP $CODIGO [ERROR / CAÍDA DETECTADA]"
  fi

  sleep "$INTERVALO"
done
