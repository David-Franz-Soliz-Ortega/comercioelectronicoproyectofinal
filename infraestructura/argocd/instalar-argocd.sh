#!/usr/bin/env bash
set -eo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "=========================================================="
echo "  TUVOTO — Instalación y Configuración de Argo CD (P2)    "
echo "=========================================================="

if ! command -v kubectl &> /dev/null; then
  echo "Error: kubectl no está instalado."
  exit 1
fi

# 1. Crear namespace argocd
echo ">>> Creando namespace 'argocd'..."
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -

# 2. Instalar manifiesto oficial de Argo CD
echo ">>> Aplicando manifiestos de Argo CD..."
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 3. Esperar que el servidor de Argo CD esté listo
echo ">>> Esperando que el servidor de Argo CD esté listo..."
kubectl wait --for=condition=available deployment/argocd-server -n argocd --timeout=180s || true

# 4. Registrar aplicaciones en Argo CD
echo ">>> Registrando Aplicaciones GitOps (Dev y Prod)..."
kubectl apply -f "$RAIZ/infraestructura/argocd/application-dev.yaml"
kubectl apply -f "$RAIZ/infraestructura/argocd/application-prod.yaml"

echo ""
echo "=========================================================="
echo "  Argo CD configurado correctamente.                      "
echo "  Para acceder a la interfaz web de Argo CD:              "
echo "    kubectl port-forward svc/argocd-server -n argocd 8080:443"
echo "    Usuario: admin                                        "
echo "    Clave inicial:                                        "
echo "      kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d; echo"
echo "=========================================================="
