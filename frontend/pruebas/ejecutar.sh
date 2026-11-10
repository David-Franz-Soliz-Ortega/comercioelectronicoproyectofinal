#!/bin/sh
set -eu
RAIZ="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
CARPETA_EVIDENCIA="$(mktemp -d /tmp/sigape-frontend.XXXXXX)"
printf 'Evidencia del navegador: %s\n' "$CARPETA_EVIDENCIA"
docker run --rm --network host --shm-size=256m \
  -v "$RAIZ/frontend/pruebas:/app/pruebas:ro" \
  -v "$RAIZ/frontend/node_modules:/app/node_modules:ro" \
  -v "$CARPETA_EVIDENCIA:/evidencia" \
  -w /app -e URL_BASE=http://localhost:8080 -e EVIDENCIA_FRONTEND=/evidencia \
  mcr.microsoft.com/playwright:v1.56.1-noble node pruebas/navegador.mjs
