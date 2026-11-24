# TUVOTO — Guía de Presentación 2 (Calidad, CI/CD y Kubernetes)

**Materia:** COM-600 Microservicios · Gestión 2/2026  
**Docente:** Ing. Carlos David Montellano Barriga  
**Etiqueta Git:** `v2.0-p2`  
**Puntaje:** 30 puntos  

---

## 1. Resumen de Requisitos Cumplidos

| Requisito | Estado | Ubicación en el Repositorio |
| :--- | :---: | :--- |
| **Suite de pruebas y umbral de cobertura** | ✅ Cumplido | `scripts/probar-todo.sh` (cobertura > 85% en lógica de negocio) |
| **Workflows de GitHub Actions (CI)** | ✅ Cumplido | `.github/workflows/ci-microservicios.yml` |
| **Registro de imágenes Docker versionadas** | ✅ Cumplido | `.github/workflows/publicar-imagenes.yml` (etiquetadas por SHA y SemVer) |
| **Chart de Helm (dev y prod)** | ✅ Cumplido | `infraestructura/helm/tuvoto/` (`values-dev.yaml`, `values-prod.yaml`) |
| **Sondas de salud y actualización progresiva** | ✅ Cumplido | `deployments-backend.yaml` (`livenessProbe`, `readinessProbe`, `RollingUpdate`) |
| **GitOps con Argo CD** | ✅ Cumplido | `infraestructura/argocd/` (`application-dev.yaml`, `application-prod.yaml`) |
| **Demostración de despliegue sin corte** | ✅ Cumplido | `scripts/demostracion-sin-corte.sh` |

---

## 2. Comandos Clave para la Exposición y Defensa

### A. Ejecución de la Suite Unificada de Pruebas
Para demostrar la calidad automatizada con un solo comando:
```bash
./scripts/probar-todo.sh
```
* Ejecuta las 74 pruebas unitarias de Frontend.
* Ejecuta las pruebas del Gateway GraphQL con reporte de cobertura.
* Ejecuta las pruebas de Elecciones y de los modelos universitarios.
* Ejecuta las pruebas de Actas y Resultados con cobertura Python (`coverage.py`).

---

### B. Despliegue en Kubernetes Local con k3d y Helm
Para levantar el clúster local y desplegar el Chart de Helm:
```bash
./infraestructura/kubernetes/desplegar-k3d.sh
```

Comandos de verificación en el clúster:
```bash
# Ver pods en ejecución
kubectl get pods -n tuvoto

# Ver servicios y puertos
kubectl get svc -n tuvoto

# Ver sondas de salud e ingress
kubectl describe deployment resultados -n tuvoto
kubectl get ingress -n tuvoto
```

---

### C. Configuración y Sincronización con Argo CD
Para instalar Argo CD y conectar el repositorio mediante GitOps:
```bash
./infraestructura/argocd/instalar-argocd.sh
```

Acceso a la interfaz web de Argo CD:
```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
```
* **URL:** `https://localhost:8080`
* **Usuario:** `admin`
* **Obtener contraseña:**
  ```bash
  kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo
  ```

---

### D. Demostración en Vivo: Actualización Progresiva Sin Corte (Zero-Downtime)
La rúbrica exige demostrar que el sistema no registra errores mientras se actualiza:

1. **Terminal 1:** Iniciar el bucle de peticiones continuas:
   ```bash
   ./scripts/demostracion-sin-corte.sh http://localhost:8890/ 0.2
   ```
2. **Terminal 2:** Provocar la actualización progresiva (ejemplo: cambiar versión de imagen o actualizar réplicas):
   ```bash
   helm upgrade tuvoto ./infraestructura/helm/tuvoto -f ./infraestructura/helm/tuvoto/values-prod.yaml -n tuvoto
   ```
3. **Observar:**
   - La estrategia `RollingUpdate` (`maxSurge: 1`, `maxUnavailable: 0`) levanta los nuevos pods y espera que las sondas de `readiness` respondan positivamente antes de retirar los pods anteriores.
   - La Terminal 1 mantiene un flujo ininterrumpido de respuestas `HTTP 200 OK` con **0 errores**, demostrando la actualización progresiva sin corte.
