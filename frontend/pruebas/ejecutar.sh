#!/bin/sh
# Crea un proyecto aislado y nunca ejecuta mutations contra localhost:8080.
set -eu
RAIZ="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
cd "$RAIZ"
exec python3 frontend/pruebas/desarrollo.py
