# TUVOTO — Informe Técnico Final de Microservicios

**Universidad Mayor, Real y Pontificia de San Francisco Xavier de Chuquisaca**  
**Facultad de Tecnología — Carrera de Ingeniería de Sistemas**  
**Materia:** COM-600 Microservicios · Gestión 2/2026  
**Docente:** Ing. Carlos David Montellano Barriga  
**Proyecto:** TUVOTO — Sistema de Observatorio Electoral y Cómputo Preliminar en Tiempo Real para Autoridades USFX  

---

## 1. Resumen Ejecutivo
TUVOTO es una plataforma de software distribuida orientada a microservicios diseñada para resolver la transparencia, inmutabilidad y alta concurrencia en procesos electorales universitarios de la USFX (elección de Rector, Vicerrector, Decanos y Directores de Carrera).

El sistema desacopla por completo las operaciones de configuración institucional, la recepción física de actas digitalizadas con fotos inmutables, la mensajería asíncrona transaccional y la publicación de resultados preliminares en tiempo real ante avalanchas de tráfico ciudadano.

---

## 2. Arquitectura Global de Microservicios

El sistema consta de 5 servicios backend y frontend componibles, empleando polyglot persistence y múltiples tecnologías:

```
                                [ Cliente Navegador / Móvil ]
                                              │
                                              ▼
                             [ NGINX Proxy Inverso / TLS ]
                                       │             │
                    ┌──────────────────┘             └──────────────────┐
                    ▼                                                   ▼
         [ Frontend SPA (React) ]                           [ Gateway GraphQL (Node.js) ]
                                                                        │
                    ┌───────────────────────┬───────────────────────────┤
                    ▼                       ▼                           ▼
        [ Microservicio Identidad ] [ Microservicio Elecciones ] [ Microservicio Actas ]
        (Node.js / Express / PG)    (Node.js / TS / gRPC / PG)  (Python / FastAPI / PG)
                    │                       │                           │
                    │                       │                           ▼ (Outbox)
                    │                       │                  [ RabbitMQ Exchange ]
                    │                       │                           │
                    │                       │                     (Topic Routing)
                    │                       │                           ▼
                    │                       │             [ Consumidor Resultados ]
                    │                       │                           │
                    ▼                       ▼                           ▼
          [ PostgreSQL Schemas ]     [ gRPC Server ]           [ Base MongoDB ]
                                            │                           ▲
                                            └───────────────────────────┤
                                                                        ▼
                                                          [ Microservicio Resultados ]
                                                          (FastAPI + Cache Redis L2)
```

### Tecnologías Empleadas:
1. **Lenguajes:** TypeScript/JavaScript (Node.js 24) y Python 3.12 (FastAPI, Pydantic).
2. **Bases de Datos:** PostgreSQL 17 (Esquemas independientes para Identidad, Elecciones y Actas) y MongoDB 8.0 (Proyecciones de resultados agregados).
3. **Caché Distribuida:** Redis 7 (In-memory key-value con TTL para amortiguar picos de 5.000 RPS).
4. **Mensajería Asíncrona:** RabbitMQ 4 (Exchange `tuvoto.actas` tipo Topic, colas durables con ACK y DLQ).
5. **Comunicación Síncrona:** REST OpenAPI v3 (Swagger interactivo en `/docs`), GraphQL BFF (solución a sobrecarga de red y N+1 con DataLoader), y gRPC con Protocol Buffers v3 y deadlines para comunicación interna de alta velocidad.

---

## 3. Síntesis de Entregables por Hito

### 3.1. Presentación 1 (30 pts) — Fundamentos y Arquitectura
- **Servicios heterogéneos:** Implementación en Node.js y Python con contratos OpenAPI y Swagger.
- **BFF GraphQL:** Orquestador de catálogo y cómputo con DataLoader y protección contra consultas profundas (máx. 8 niveles, máx. 150 campos).
- **gRPC Interno:** Verificación de mesas electorales entre `actas` y `elecciones` con metadatos de autorización y deadlines.
- **Event-Driven Architecture:** Patrón Outbox transaccional en PostgreSQL, publicación obligatoria a RabbitMQ y 2 consumidores independientes (`conteo` y `auditoría`).

### 3.2. Presentación 2 (30 pts) — Calidad, CI/CD y Kubernetes
- **Suite Unificada:** Script `./scripts/probar-todo.sh` que ejecuta las 5 suites de pruebas con cobertura en lógica de negocio > 85% (Frontend: 74/74 tests, Gateway: 100%, Resultados: 100%, Elecciones: 100%).
- **CI/CD:** Workflows en `.github/workflows/` para ejecución de pruebas en PRs y construcción de imágenes Docker multi-etapa firmadas por SHA.
- **Helm y Kubernetes:** Chart modular `infraestructura/helm/tuvoto/` con valores parametrizados para `dev` y `prod`, Ingress, ConfigMaps, Secrets, liveness/readiness probes y estrategia RollingUpdate sin corte de servicio (Zero-Downtime).
- **GitOps con Argo CD:** Manifiestos de sincronización continua declarativa en `infraestructura/argocd/`.

### 3.3. Presentación 3 (40 pts) — Observabilidad, Seguridad y Alta Concurrencia
- **Observabilidad Integral:**
  - Exportador Prometheus nativo en `/metrics` en todos los servicios.
  - Reglas de alerta SLO (`alertas-slo.yml`) con umbrales estrictos: Disponibilidad > 99.0%, Latencia p95 < 500ms, Error rate < 1.0%.
  - Tablero de Grafana completo (`tuvoto-observabilidad.json`) con métricas técnicas (RPS, latencias percentiles) y métricas de negocio en vivo (actas computadas, votos escrutados).
  - Trazabilidad distribuida con Jaeger (3 saltos: Gateway -> Actas -> Elecciones gRPC & Resultados RabbitMQ).
  - Centralización de logs con Loki y Promtail correlacionados mediante `idCorrelacion`.
- **Seguridad Robusta:**
  - Control de Acceso Basado en Roles (RBAC) con 3 perfiles autenticados (`ADMINISTRADOR`, `OPERADOR`, `AUDITOR`) y separación de funciones (el Administrador no registra actas).
  - Doble mecanismo de autenticación: Cookies SameSite seguras con protección CSRF en tiempo constante para navegadores, y tokens **JWT (RFC 7519)** con firma HMAC-SHA256 para APIs y escrituras.
  - Terminación segura HTTPS con TLS 1.3 / 1.2 en NGINX.
  - Generación automatizada de **SBOM en formato CycloneDX v1.5** (`scripts/generar-sbom-cyclonedx.sh`).
  - Modelo de amenazas completo basado en **OWASP API Security Top 10**.
- **Alta Concurrencia y Resiliencia:**
  - Plan de pruebas de carga Apache JMeter para 5.000 usuarios concurrentes (`pruebas/rendimiento/tuvoto-5k.jmx`).
  - Generación de informe HTML de rendimiento con Throughput masivo, latencia p50 < 10ms, p95 < 20ms, p99 < 30ms y tasa de error < 0.2% (cumpliendo con éxito el SLO).
  - Demostración de resiliencia ante fallo inducido (`scripts/demostracion-resiliencia.sh`) mostrando que la caída de un servicio transaccional no afecta la consulta de resultados en caché.

---

## 4. Conclusión
El proyecto TUVOTO demuestra que una arquitectura de microservicios bien diseñada, con separación clara de responsabilidades, observabilidad desde el primer día, resiliencia ante fallos y control de acceso estricto, es capaz de satisfacer con solidez los requerimientos más exigentes de una elección universitaria moderna y transparente.
