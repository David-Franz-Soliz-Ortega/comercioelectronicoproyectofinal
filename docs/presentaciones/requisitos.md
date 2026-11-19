# TUVOTO: matriz de las tres presentaciones

Fuente: «Trabajo Final Microservicios 2-2026.pdf» facilitado por el usuario (9 páginas). Se interpreta como rúbrica, no como autorización para crear tags, publicar imágenes, cambiar GitHub o desplegar producción. Fechas en blanco en la fuente: no se inventan plazos. Destino confirmado por el usuario: únicamente demostración local.

Estados: **demostrado** requiere prueba reproducible y evidencia; **parcial** indica código o prueba limitada; **pendiente** no se da por cumplido. Cada requisito anterior debe seguir funcionando en la siguiente entrega.

| Presentación | Requisito | Estado del corte de trabajo |
| --- | --- | --- |
| P1 | 4 servicios, al menos 2 tecnologías, bases propias SQL/NoSQL | Parcial: diseño y pruebas SQL/AMQP aisladas; falta arranque limpio completo |
| P1 | C4 contexto/contenedores, esquema por base, 3 ADR, PDF <=8 páginas | PDF TUVOTO generado y verificado: 8 páginas, contexto/contenedores y 3 ADR; falta revisión académica |
| P1 | CRUD REST en cada servicio, errores uniformes y Swagger UI | Parcial: operaciones implementadas para cuentas/procesos/actas/informes; regresión CRUD integral y Swagger en ejecución pendientes |
| P1 | 10.000 registros, filtros y paginación | Demostrado en PostgreSQL efímero: 10.000 versiones sintéticas, filtro, paginación y separación de organización; no equivale al ensayo REST integral |
| P1 | GraphQL de 3 servicios, mutation, solución N+1 | En verificación: elección/resultados/avance de actas, mutation protegida y DataLoader |
| P1 | gRPC con proto, estados y deadline, DNS Docker y Kubernetes | Prueba gRPC real loopback aprobada (contrato, autenticación, permisos, deadline); falta DNS y comunicación entre contenedores |
| P1 | Evento topic, 2 consumidores, persistencia, ACK, DLQ e idempotencia | Demostrado solo en prueba efímera RabbitMQ/MongoDB; falta recorrido completo nuevo |
| P1 | Dockerfiles multietapa/no root, Compose limpio, proxy único y salud | Parcial: config y NGINX validados; Dockerfiles multietapa/no root preparados, ensayo completo pendiente |
| P1 | Frontend inicial con datos reales | Parcial: implementado, falta ensayo visual nuevo; no conservar capturas antiguas como prueba |
| P2 | Regla de negocio por servicio, integración efímera, contrato, cobertura y comando único | Parcial: suites separadas; umbral y ejecución unificada pendientes |
| P2 | CI/CD por servicio, rojo/verde real, imágenes por SHA y registro | Pendiente: no hay corrida ni publicación acreditada |
| P2 | main protegido, PR y pipeline | Pendiente de acceso y configuración reales de GitHub; un YAML no prueba protección |
| P2 | Kubernetes, Helm dev/prod, sondas, recursos y rolling sin corte | Pendiente de implementación y demostración en clúster |
| P2 | Argo CD y frontend conectado al clúster | Pendiente; no sustituir sincronización real por manifiestos escritos |
| P3 | Logs JSON correlacionados y centralizados | Parcial: logs HTTP JSON e identificador de correlación implementados; centralización y trazas pendientes |
| P3 | Prometheus, 2 métricas de negocio, Grafana, SLO y alerta | Pendiente |
| P3 | OpenTelemetry/Jaeger, 3 saltos incluyendo consumidor | Pendiente |
| P3 | JWT en escrituras, bcrypt/argon2, >=3 roles, 401/403 | Parcial: bcrypt, sesiones revocables y CSRF; JWT pendiente. Se incorpora AUDITOR de solo lectura para cumplir 3 perfiles autenticados |
| P3 | HTTPS, secretos/historial, escaneo, SBOM y amenazas OWASP | Pendiente de controles y evidencias completas |
| P3 | JMeter 5.000 usuarios, HTML, p50/p95/p99, throughput y errores <1% o análisis | Pendiente; pruebas de caché no equivalen a carga real |
| P3 | Réplicas/HPA, caché, timeouts, backoff y circuit breaker con fallo inducido | Parcial: caché y algunos timeouts; resto pendiente |
| P3 | Frontend completo, responsive y vistas por rol | En implementación: público, administrador, operador y auditor; verificar móvil/tablet/escritorio |
| P3 | Informe/PDF, manual reproducible, diapositivas, video y defensa | Pendiente; no generar enlaces o evidencias ficticias |

## Orden de ejecución

1. **P1:** completar contratos/CRUD seguros, gRPC y consulta de tres servicios; generar arquitectura/ADR; pruebas aisladas y frontend adaptable; ensayo desde copia limpia sin secretos ni datos antiguos.
2. **P2:** comando único de pruebas y cobertura; workflows, imágenes, Helm y GitOps. Las corridas, protección y sincronización se acreditan solo al ejecutarlas con accesos autorizados.
3. **P3:** JWT/roles/HTTPS, telemetría, SLO, resiliencia y JMeter antes/después. Elegir la consulta pública de resultados como operación de alta concurrencia; no escribir votos ni actas de usuarios reales en una carga.
4. **Producción:** dominio, destino, TLS, secretos, persistencia, copias y restauración, límites y monitoreo deben quedar definidos y probados antes de publicar.

## Perfiles y límites de negocio

Administrador configura y gestiona cuentas, operador publica solo en mesas asignadas y auditor consulta sin modificar. Público sin cuenta no cuenta como rol autenticado para la rúbrica. Mantener separación entre configuración y publicación; no introducir voto individual ni editar totales directamente para simular CRUD.

## Limpieza realizada

Código/diagramas/documentos SIGAPE anteriores se retiraron del árbol activo después de verificar su respaldo privado en `.respaldo-local/` (ignorado por Git y Docker). El tag histórico permanece intacto. Los cambios locales no versionados también están respaldados. No se borraron bases, volúmenes ni contenedores existentes.
