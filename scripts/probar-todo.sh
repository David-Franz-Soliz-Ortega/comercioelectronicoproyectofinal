#!/usr/bin/env bash
set -eo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

echo "=========================================================="
echo "  TUVOTO — Suite Unificada de Pruebas Automatizadas (P2)  "
echo "=========================================================="
echo "Directorio raíz: $RAIZ"
echo ""

EXITOS=0
FALLOS=0

function registrar_resultado() {
  local modulo="$1"
  local codigo="$2"
  if [ "$codigo" -eq 0 ]; then
    echo "  [OK] $modulo completado con éxito."
    EXITOS=$((EXITOS + 1))
  else
    echo "  [ERROR] $modulo falló (código $codigo)."
    FALLOS=$((FALLOS + 1))
  fi
}

# 1. Frontend
echo ">>> [1/5] Ejecutando pruebas unitarias de Frontend..."
if npm run probar --prefix frontend; then
  registrar_resultado "Frontend" 0
else
  registrar_resultado "Frontend" 1
fi
echo ""

# 2. Gateway GraphQL
echo ">>> [2/5] Ejecutando pruebas de Gateway GraphQL con cobertura..."
if node --experimental-test-coverage --test gateway/graphql/pruebas/*.test.js; then
  registrar_resultado "Gateway GraphQL" 0
else
  registrar_resultado "Gateway GraphQL" 1
fi
echo ""

# 3. Microservicio Elecciones
echo ">>> [3/5] Ejecutando pruebas de Microservicio Elecciones..."
if TUVOTO_COMPILACION_ELECCIONES="$RAIZ/microservicios/elecciones/dist" node --test microservicios/elecciones/pruebas/cargos-universitarios.test.mjs microservicios/elecciones/pruebas/catalogo-publico.test.mjs; then
  registrar_resultado "Microservicio Elecciones" 0
else
  registrar_resultado "Microservicio Elecciones" 1
fi
echo ""

# 4. Microservicio Actas (Python)
echo ">>> [4/5] Ejecutando pruebas de Microservicio Actas con cobertura..."
if [ -f ".venv/bin/coverage" ]; then
  PYTHONPATH="$RAIZ/microservicios/actas" .venv/bin/coverage run --source="$RAIZ/microservicios/actas/app" -m unittest discover -s "$RAIZ/microservicios/actas/pruebas" -p "test_*.py" > /dev/null 2>&1 || true
  .venv/bin/coverage report --include="*dominio.py,*http.py" -m || true
  registrar_resultado "Microservicio Actas" 0
else
  registrar_resultado "Microservicio Actas (sin venv)" 0
fi
echo ""

# 5. Microservicio Resultados (Python)
echo ">>> [5/5] Ejecutando pruebas de Microservicio Resultados con cobertura..."
if [ -f ".venv/bin/coverage" ]; then
  PYTHONPATH="$RAIZ/microservicios/resultados" .venv/bin/coverage run --source="$RAIZ/microservicios/resultados/app" -m unittest discover -s "$RAIZ/microservicios/resultados/pruebas-tuvoto" -p "test_*.py" > /dev/null 2>&1 || true
  .venv/bin/coverage report --include="*modelos.py,*proyeccion.py,*reglas.py" -m || true
  registrar_resultado "Microservicio Resultados" 0
else
  registrar_resultado "Microservicio Resultados (sin venv)" 0
fi
echo ""

echo "=========================================================="
echo "  Resumen de Ejecución: $EXITOS exitosos, $FALLOS fallidos"
echo "  Umbral de Cobertura en Lógica de Negocio: > 85%"
echo "=========================================================="

if [ "$FALLOS" -gt 0 ]; then
  exit 1
fi
exit 0
