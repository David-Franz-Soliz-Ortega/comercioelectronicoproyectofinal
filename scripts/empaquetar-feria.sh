#!/usr/bin/env bash
# Crea un ZIP del proyecto para llevarlo a la feria como copia de seguridad.
#   scripts/empaquetar-feria.sh [destino.zip]
# No incluye dependencias instaladas (Docker las reinstala al construir) ni secretos:
# .env.tuvoto y .env.tuvoto-administrador.json se copian aparte, en un medio personal.
# La elección, las cuentas y las actas viven en volúmenes de Docker, no en esta carpeta.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NOMBRE="$(basename "$RAIZ")"
DESTINO="${1:-$HOME/TUVOTO-feria-$(date +%F).zip}"

command -v zip >/dev/null || { echo "Falta el comando zip (sudo pacman -S zip)." >&2; exit 1; }
[[ -e "$DESTINO" ]] && { echo "Ya existe $DESTINO; indica otro nombre." >&2; exit 1; }

cd "$RAIZ/.."
zip -rq "$DESTINO" "$NOMBRE" -x \
  "*/node_modules/*" "*/dist/*" "*/__pycache__/*" "*/.venv/*" "*/.pytest_cache/*" \
  "*/.env" "*/.env.tuvoto*" "*/secretos.json" "*.pem" "*.key" "*/certificados/*" "*/.respaldo-local/*"

if unzip -l "$DESTINO" | grep -qE '\.env\.tuvoto|\.pem$|\.key$|secretos\.json'; then
  rm -f "$DESTINO"; echo "El ZIP incluía un secreto; se descartó." >&2; exit 1
fi
echo "ZIP listo: $DESTINO ($(du -h "$DESTINO" | cut -f1))"
echo "Copia aparte .env.tuvoto y .env.tuvoto-administrador.json; no van dentro del ZIP."
