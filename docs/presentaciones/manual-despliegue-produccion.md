# Manual de Despliegue Reproducible — TUVOTO

Este manual describe el procedimiento para desplegar la arquitectura completa de TUVOTO tanto en entorno local mediante Docker Compose como en clúster Kubernetes con Helm y GitOps (Argo CD).

---

## 1. Requisitos Previos
- Docker Engine 24+ y Docker Compose v2.
- Node.js 20+ y Python 3.12+ (para desarrollo local o pruebas).
- Clúster Kubernetes (k3d, minikube o clúster administrado) y Helm 3+.
- Puerto libre en el host para el proxy inverso NGINX (por defecto `8890`).

---

## 2. Despliegue con Docker Compose (Paso a Paso)

### 2.1. Configuración de Variables de Entorno
Copiar el archivo de ejemplo o utilizar `.env.tuvoto`:
```bash
cp .env.example .env
```
Asegurarse de definir las contraseñas de bases de datos y claves de servicio internas:
```env
TUVOTO_PUERTO=8890
TUVOTO_POSTGRES_CLAVE=tuvoto_postgres_segura_2026
TUVOTO_MONGO_CLAVE=tuvoto_mongo_segura_2026
TUVOTO_RABBIT_CLAVE=tuvoto_rabbit_segura_2026
TUVOTO_IDENTIDAD_CLAVE=tuvoto_identidad_segura_2026
TUVOTO_ELECCIONES_CLAVE=tuvoto_elecciones_segura_2026
TUVOTO_ACTAS_CLAVE=tuvoto_actas_segura_2026
TUVOTO_RESULTADOS_CLAVE=tuvoto_resultados_segura_2026
TUVOTO_ORIGEN=http://localhost:8890
TUVOTO_COOKIE_SEGURA=false
```

### 2.2. Construcción y Arranque
```bash
docker compose up -d --build
```

### 2.3. Verificación de Salud
```bash
docker compose ps
curl -i http://localhost:8890/salud
```

### 2.4. Despliegue del Stack de Monitoreo
```bash
docker compose -f infraestructura/monitoreo/docker-compose.monitoreo.yml up -d
```
- **Prometheus:** `http://localhost:9090`
- **Grafana:** `http://localhost:3030` (credenciales `admin` / `tuvoto2026`)
- **Jaeger Tracing:** `http://localhost:16686`
- **Loki Logs:** `http://localhost:3100`

---

## 3. Despliegue en Kubernetes con Helm

### 3.1. Despliegue Automatizado con k3d
El script automatizado crea el clúster local, importa las imágenes y despliega el chart de Helm:
```bash
./infraestructura/kubernetes/desplegar-k3d.sh
```

### 3.2. Instalación Manual con Helm
```bash
helm upgrade --install tuvoto ./infraestructura/helm/tuvoto \
  --namespace tuvoto-prod \
  --create-namespace \
  -f ./infraestructura/helm/tuvoto/values-prod.yaml
```

### 3.3. Sincronización Declarativa con Argo CD (GitOps)
```bash
./infraestructura/argocd/instalar-argocd.sh
kubectl apply -f infraestructura/argocd/application-prod.yaml
```
Verificar el estado de sincronización:
```bash
kubectl get applications -n argocd
```

---

## 4. Ejecución de Pruebas y Aseguramiento de Calidad
- **Suite unificada de pruebas automatizadas (>85% cobertura):**
  ```bash
  ./scripts/probar-todo.sh
  ```
- **Prueba de carga masiva (JMeter 5.000 usuarios):**
  ```bash
  ./scripts/ejecutar-jmeter.sh 5000 30 localhost 8890
  ```
- **Generación de SBOM CycloneDX y escaneo de vulnerabilidades:**
  ```bash
  ./scripts/generar-sbom-cyclonedx.sh
  ./scripts/escanear-seguridad.sh
  ```
- **Demostración de resiliencia y fallo inducido:**
  ```bash
  ./scripts/demostracion-resiliencia.sh
  ```
