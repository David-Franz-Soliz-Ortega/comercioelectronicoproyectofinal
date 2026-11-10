# Contratos compartidos

Este directorio contiene propuestas de integración entre microservicios. Ninguna propuesta se considera contrato aprobado hasta que las personas responsables de los servicios involucrados la revisen y acepten.

## Contenido y estado

- `openapi/identidad.yaml`, `openapi/elecciones.yaml`, `openapi/candidaturas.yaml` y `openapi/padron-electoral.yaml`: propuestas REST mínimas alineadas con las responsabilidades de `docs/arquitectura.md`.
- `grpc/padron-v1.proto`: propuesta de consulta síncrona de elegibilidad desde `elecciones` hacia `padron-electoral`.
- `eventos/voto.registrado.v1.schema.json`: propuesta de evento emitido por `votacion` para consumo de `resultados`.

La consulta de elegibilidad y el evento son decisiones de integración pendientes de aprobación de ambos servicios participantes. El evento solo permite contar registros por elección; no define resultados por candidatura. Tal agregación requiere otro contrato revisado que no permita asociar una papeleta con su selección.

## Versionado y cambios

- REST: los documentos OpenAPI describen una versión mayor en la ruta `/api/v1`. Cambios compatibles, como campos opcionales, pueden incorporarse dentro de esa versión tras revisión; eliminar o reinterpretar operaciones/campos requiere una versión mayor nueva, por ejemplo `/api/v2`.
- gRPC: el paquete incluye la versión mayor (`padron.v1`). No se reutilizan números de campo eliminados; cambios incompatibles requieren un paquete `v2`.
- Eventos: el nombre y el esquema incluyen la versión (`voto.registrado.v1`). La versión publicada es inmutable; cambios incompatibles requieren un nuevo evento versionado.
- Toda modificación debe actualizar el contrato, sus consumidores y esta documentación en el mismo cambio. Revisar privacidad, compatibilidad, idempotencia y migración antes de aprobar.

## Convenciones propuestas

### Servicios Docker y puertos

Los nombres técnicos de la infraestructura actual son `base-postgres`, `base-mongodb`, `cache-redis`, `mensajeria-rabbitmq` y `entrada-nginx`. Los futuros servicios de aplicación usarán nombres de dominio en español: `identidad`, `elecciones`, `candidaturas`, `padron-electoral`, `votacion` y `resultados`. La incorporación de sus contenedores requiere revisar esta propuesta y sus puertos.

| Componente | Puerto interno | Publicación local |
| --- | ---: | --- |
| NGINX | 80 | 8080, configurable con `PUERTO_HTTP_PUBLICO` |
| PostgreSQL | 5432 | No |
| MongoDB | 27017 | No |
| Redis | 6379 | No |
| RabbitMQ AMQP | 5672 | No |
| RabbitMQ administración | 15672 | No |
| Gateway GraphQL, propuesta | 4000 | No |
| Servicios Node.js, propuesta | 3000 | No |
| Servicios FastAPI, propuesta | 8000 | No |
| Servicio Go, propuesta | 8080 | No |

Los puertos de aplicación y los nombres DNS de los futuros contenedores son propuestas pendientes de aprobación por sus integrantes. Las interfaces administrativas y las bases de datos no se publican al anfitrión por defecto.

### Variables de entorno

- Las variables propias usan mayúsculas y `SNAKE_CASE`, con términos de dominio en español, por ejemplo `IDENTIDAD_DB_USUARIO`.
- Las variables requeridas por imágenes oficiales conservan sus nombres estándar, como `POSTGRES_USER`, `MONGO_INITDB_ROOT_USERNAME` y `RABBITMQ_DEFAULT_USER`.
- Las credenciales se obtienen del archivo local `.env`, ignorado por Git. `.env.example` solo contiene valores de reemplazo, nunca contraseñas utilizables.
- Los usuarios de aplicación reciben permisos únicamente sobre la base lógica de su microservicio. No reutilizar credenciales entre servicios.

### Errores REST y correlación

- Las respuestas de error usan `application/problem+json` conforme a RFC 9457, con `type`, `title`, `status`, `detail` e `instance` según corresponda. Se puede añadir `idCorrelacion` como extensión.
- `X-Correlation-ID` identifica una solicitud distribuida. NGINX conserva el valor recibido o genera uno si falta; los servicios deben propagarlo en llamadas salientes y registros, sin incluir datos personales o secretos.
- No se fija todavía un catálogo común de errores de dominio: cada contrato debe proponerlo y acordarlo con sus consumidores.

## Contratos pendientes

Antes de implementar las propuestas REST, RPC y de eventos, acordar con las personas responsables: identificadores y sus formatos, estados de dominio, políticas de autorización, tiempos de espera, reintentos, retención y garantías de entrega. No incluir identidad del votante ni información que permita reconstruir su selección en eventos de votación.