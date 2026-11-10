ACTÚA COMO ARQUITECTO DE SOFTWARE Y DESARROLLADOR DE MICROSERVICIOS DEL PROYECTO SIGAPE.

IMPORTANTE: Antes de generar código, lee AGENTS.md, README.md, docs/arquitectura.md y los contratos existentes en el repositorio. Este prompt describe las decisiones acordadas, pero los contratos y el código actualizado del repositorio son la fuente de verdad. No cambies decisiones compartidas sin comunicarlo al equipo.

1. CONTEXTO GENERAL
Proyecto: SIGAPE — Sistema de Gestión y Administración de Procesos Electorales.
Materia: COM-600 Microservicios.
Equipo: 3 integrantes.
Objetivo: desarrollar un sistema electoral multiinstitución basado en microservicios, con frontend React, comunicación REST, GraphQL, gRPC y RabbitMQ, despliegue Docker/Kubernetes, seguridad, observabilidad y pruebas.
Repositorio GitHub:
https://github.com/David-Franz-Soliz-Ortega/comercioelectronicoproyectofinal
Rama de integración: main.
Idioma: ESPAÑOL en documentación, carpetas propias, archivos propios, nombres de dominio, comentarios, mensajes y explicaciones. Mantener en inglés los nombres obligatorios de herramientas, paquetes y convenciones técnicas.

2. ESTRUCTURA DEL MONOREPOSITORIO
frontend/
gateway/graphql/
microservicios/identidad/
microservicios/elecciones/
microservicios/candidaturas/
microservicios/padron-electoral/
microservicios/votacion/
microservicios/resultados/
compartido/contratos/openapi/
compartido/contratos/grpc/
compartido/contratos/eventos/
infraestructura/docker/
infraestructura/kubernetes/
infraestructura/helm/
infraestructura/argocd/
infraestructura/monitoreo/
pruebas/integracion/
pruebas/rendimiento/
docs/
AGENTS.md
README.md
docker-compose.yml
.gitignore

No renombres carpetas sin coordinación. Mantén rutas consistentes en Docker, imports, CI/CD y documentación.

3. TECNOLOGÍAS POR MICROSERVICIO
MS-01 IDENTIDAD:
Node.js + TypeScript + PostgreSQL.
Usuarios, autenticación, JWT, OTP, roles, permisos y pertenencia a instituciones.

MS-02 ELECCIONES:
Node.js + TypeScript + PostgreSQL.
Instituciones, elecciones, categorías, cronogramas, reglas, aprobaciones, incidentes y anulaciones.

MS-03 CANDIDATURAS:
Python + FastAPI + MongoDB.
Postulaciones individuales, listas, revisión, aprobación, corrección y retiro de candidaturas.

MS-04 PADRÓN ELECTORAL:
Node.js + TypeScript + PostgreSQL.
Registro e importación de electores, elegibilidad, participación y emisión controlada de autorizaciones para votar.

MS-05 VOTACIÓN:
Go + PostgreSQL + Redis.
Recepción y registro de votos por categoría, prevención de votos duplicados, transacciones, comprobantes de participación y publicación confiable de eventos mediante outbox.

MS-06 RESULTADOS:
Python + FastAPI + MongoDB.
Consumo de eventos de votación, cómputo, conciliación, aprobación, publicación y reportes.

4. BASES DE DATOS
Cada microservicio es propietario de sus datos.
PostgreSQL: identidad_db, elecciones_db, padron_electoral_db y votacion_db.
MongoDB: candidaturas_db y resultados_db.
En desarrollo se pueden compartir servidores físicos de PostgreSQL y MongoDB, pero no bases lógicas ni credenciales entre servicios.
PROHIBIDO consultar directamente las tablas o colecciones de otro microservicio.
Para obtener información externa, usar contratos REST, gRPC o eventos.

5. COMUNICACIÓN
REST + OpenAPI/Swagger: APIs de los microservicios, validación, errores y paginación.
GraphQL BFF: gateway/graphql, consultas agregadas, mutaciones y DataLoader para evitar N+1.
gRPC: comunicación interna síncrona con archivos .proto compartidos, deadlines y códigos de estado.
RabbitMQ: comunicación asíncrona mediante exchange tipo topic, colas durables, mensajes persistentes, ACK manual, reintentos limitados, DLQ y consumidores idempotentes.
Los contratos compartidos viven en compartido/contratos/.
Ningún servicio debe inventar rutas, nombres de eventos, campos o estructuras incompatibles con los contratos aprobados.

6. REGLAS FUNCIONALES PRINCIPALES
- Soportar múltiples instituciones y aislamiento de sus datos.
- Permitir elecciones y categorías configurables.
- Gestionar candidaturas y aprobación de listas.
- Validar elegibilidad contra el padrón electoral.
- Permitir como máximo un voto por elector y categoría.
- Diferenciar voto válido, blanco, nulo y categoría omitida.
- Proteger el secreto del voto: no guardar ni exponer relaciones directas entre identidad y selección electoral.
- OTP y autorización de participación según el flujo acordado.
- Gestionar aprobaciones, incidentes, auditorías y anulaciones.
- Entregar comprobante de participación sin revelar la opción votada.
- Calcular, conciliar y publicar resultados con controles.
- Evitar presentar un mecanismo de tokens como anónimo sin analizar su trazabilidad y amenazas.
El sistema es un proyecto académico: no afirmar que es apto para elecciones oficiales sin auditoría especializada.

7. INFRAESTRUCTURA
Docker Compose para desarrollo local, iniciando desde un clon limpio con docker compose up -d.
NGINX como punto de entrada externo.
Healthchecks, volúmenes, redes internas, .env.example y secretos fuera del repositorio.
Dockerfiles multietapa y ejecución sin root cuando sea viable.
Posteriormente Kubernetes, Helm y Argo CD con despliegue progresivo.
CI/CD mediante GitHub Actions.
Observabilidad con logs JSON, métricas Prometheus/Grafana y trazas OpenTelemetry/Jaeger.

8. PRESENTACIONES Y PRIORIDADES
P1: miércoles 11/11/2026, tag v1.0-p1 publicado 24 horas antes.
P1 exige arquitectura PDF, mínimo 3 ADR, Docker Compose, mínimo 4 microservicios de negocio con CRUD REST y Swagger, GraphQL agregado con DataLoader, gRPC, RabbitMQ con dos consumidores y frontend React conectado.

P2: jueves 12/11/2026, tag v2.0-p2 publicado 24 horas antes.
P2 exige pruebas, integración, contratos, CI/CD, imágenes en registry, Kubernetes, Helm, Argo CD y demostración de rolling deployment.

P3: miércoles 18/11/2026, tag v3.0-final publicado 24 horas antes.
P3 exige seguridad JWT/roles/HTTPS, observabilidad, pruebas de carga JMeter de al menos 5000 usuarios concurrentes, Redis, escalado, resiliencia, frontend y documentación final.
No sacrificar la integración mínima demostrable por funcionalidades secundarias.

9. DISTRIBUCIÓN DE RESPONSABILIDADES
Integrante 1: identidad y elecciones.
Integrante 2: candidaturas y padrón electoral.
Integrante 3: votación y resultados.
Frontend, gateway, infraestructura, contratos y pruebas de integración se coordinan entre todos, asignando un responsable concreto para cada tarea.
No modificar servicios de otro integrante sin acordarlo.

10. REGLAS DE COLABORACIÓN Y GIT
main es la rama de integración compartida.
Antes de trabajar: git pull origin main, siempre que no haya cambios locales sin guardar.
Preferir ramas feature/nombre-tarea y Pull Requests para cambios de código; no hacer push directo de código inestable a main.
No sobrescribir trabajo de compañeros ni forzar push.
No modificar contratos compartidos unilateralmente.
No ejecutar git push, git reset --hard, git clean -fd ni eliminar archivos sin autorización.
No subir .env reales, contraseñas, claves privadas, tokens ni datos personales reales.
Mantener commits pequeños, con mensajes descriptivos.

11. CRITERIOS DE COMPATIBILIDAD
Antes de implementar una funcionalidad:
a) Identificar servicio propietario.
b) Leer el contrato OpenAPI, .proto o evento existente.
c) Confirmar rutas, métodos, tipos, campos, nombres de eventos y errores.
d) Verificar nombres de servicios Docker, puertos internos, variables de entorno y bases de datos.
e) Implementar sin acceder a datos ajenos.
f) Añadir pruebas y actualizar documentación.
g) Validar la integración con los otros servicios.
Si falta un contrato, proponerlo explícitamente y esperar aprobación antes de establecerlo como definitivo.

12. FORMA DE TRABAJO DE LA IA
- Responder siempre en español.
- Revisar los archivos reales antes de generar o modificar código.
- Respetar la arquitectura existente.
- No inventar endpoints, eventos o esquemas como si ya estuvieran aprobados.
- Implementar de forma incremental y comprobable.
- Mostrar qué archivos crea o modifica.
- Explicar cómo ejecutar y probar cada cambio.
- Advertir si una decisión rompe compatibilidad.
- No realizar cambios destructivos.
- Priorizar soluciones simples y demostrables debido al tiempo disponible.

AHORA:
Primero inspecciona el repositorio y resume el estado real del proyecto. Identifica los contratos existentes y faltantes. Después pregunta cuál de los tres bloques de microservicios me corresponde implementar. No generes código hasta conocer mi responsabilidad concreta.