#!/usr/bin/env bash
set -eo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLUSTER_NOMBRE="tuvoto-cluster"
NAMESPACE="tuvoto"

echo "=========================================================="
echo "  TUVOTO — Despliegue de Kubernetes en k3d con Helm (P2)  "
echo "=========================================================="

if ! command -v k3d &> /dev/null; then
  echo "Error: k3d no está instalado."
  exit 1
fi

if ! command -v helm &> /dev/null; then
  echo "Error: helm no está instalado."
  exit 1
fi

# 1. Crear clúster k3d si no existe
if ! k3d cluster list | grep -q "$CLUSTER_NOMBRE"; then
  echo ">>> Creando clúster k3d '$CLUSTER_NOMBRE'..."
  k3d cluster create "$CLUSTER_NOMBRE" \
    --port "8081:80@loadbalancer" \
    --port "8443:443@loadbalancer" \
    --agents 2 \
    --wait
  echo "[OK] Clúster k3d creado con 1 servidor y 2 agentes."
else
  echo "[INFO] Clúster k3d '$CLUSTER_NOMBRE' ya existe."
fi

# 2. Configurar contexto de kubectl
kubectl config use-context "k3d-$CLUSTER_NOMBRE"

# 3. Crear namespace si no existe
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# 4. Desplegar Helm Chart
echo ">>> Desplegando Chart de Helm en namespace '$NAMESPACE' (entorno dev)..."
helm upgrade --install tuvoto "$RAIZ/infraestructura/helm/tuvoto" \
  --namespace "$NAMESPACE" \
  -f "$RAIZ/infraestructura/helm/tuvoto/values-dev.yaml"

echo ""
echo "=========================================================="
echo "  Despliegue Helm completado con éxito.                   "
echo "  Comandos de verificación:                               "
echo "    kubectl get pods -n $NAMESPACE                        "
echo "    kubectl get svc -n $NAMESPACE                         "
echo "    kubectl get ingress -n $NAMESPACE                     "
echo "=========================================================="
