# Contratos compartidos

Este directorio contiene contratos y propuestas de integración entre microservicios. Las cuatro API REST CRUD P1 están implementadas coordinadamente con sus productores, pero siguen pendientes de revisión y aprobación por las personas responsables de los servicios.

## Contenido y estado

- `openapi/identidad.yaml`, `openapi/elecciones.yaml`, `openapi/candidaturas.yaml` y `openapi/padron-electoral.yaml`: propuestas REST CRUD P1. Conservan las consultas GET existentes y añaden listado, creación, actualización, eliminación, salud, validación, filtros y paginación.
- `grpc/padron-v1.proto`: propuesta de consulta síncrona de elegibilidad desde `elecciones` hacia `padron-electoral`; cliente real en `elecciones` y servidor en `padron-electoral:50051`, con deadline, correlación, estados gRPC y prueba entre contenedores. Sigue pendiente de revisión humana.
- `eventos/voto.registrado.v1.schema.json`: propuesta de evento emitido por `votacion` para `resultados`; productor con bandeja transaccional en `votacion` y dos consumidores independientes de conteo y auditoría técnica en `resultados`, con ACK manual, deduplicación persistente y DLQ. El esquema no cambia.

Los campos CRUD son mínimos y demostrativos. El padrón solo almacena `idEleccion` y `elegible`; nunca identidad del elector. No hay autenticación en estas API, así que deben permanecer en un entorno académico aislado. La revisión de contratos por el equipo sigue pendiente.

- `openapi/votacion.yaml` y `openapi/resultados.yaml`: propuestas REST de registro sintético idempotente, consulta, conteo, auditoría y salud, implementadas junto con los servicios. Pendientes de revisión.

- `graphql/esquema.graphql`: propuesta del BFF implementado; queries y mutations de elecciones, candidaturas y padrón mediante sus contratos REST, con DataLoader por operación. Pendiente de revisión humana.

## Versionado y cambios

- REST: los documentos OpenAPI describen la versión mayor `/api/v1`. Cambios compatibles se incorporan tras revisión; eliminar o reinterpretar operaciones o campos requiere una versión mayor nueva, como `/api/v2`.
- gRPC: el paquete incluye la versión mayor (`sigape.padron.v1`). No se reutilizan números de campo eliminados; cambios incompatibles requieren `v2`.
- Eventos: el nombre y el esquema incluyen la versión (`voto.registrado.v1`). La versión publicada es inmutable; cambios incompatibles requieren otro evento versionado.
- Actualizar contrato, productores, consumidores y pruebas en el mismo cambio. Revisar privacidad, compatibilidad, idempotencia y migración antes de aprobar.

## Convenciones propuestas

### Servicios Docker y puertos

Los servicios actuales son `base-postgres`, `base-mongodb`, `cache-redis`, `mensajeria-rabbitmq`, `entrada-nginx`, `identidad`, `elecciones`, `candidaturas`, `padron-electoral`, `votacion`, `resultados`, `resultados-conteo` y `resultados-auditoria` y `gateway-graphql`. Los puertos HTTP internos de aplicación son 3000 para Node.js y 8000 para FastAPI. Solo NGINX publica HTTP (8080 en el anfitrión, configurable con `PUERTO_HTTP_PUBLICO`); bases, Redis, RabbitMQ y servicios no publican puertos al anfitrión.

| Componente | Puerto interno | Publicación local |
| --- | ---: | --- |
| NGINX | 80 | 8080 por defecto |
| Servicios Node.js | 3000 | No |
| API FastAPI de candidaturas y resultados | 8000 | No |
| API Go de votación | 8080 | No |
| BFF GraphQL | 4000 | No |
| gRPC del padrón | 50051 | No |
| PostgreSQL | 5432 | No |
| MongoDB | 27017 | No |
| Redis | 6379 | No |
| RabbitMQ AMQP y administración | 5672 y 15672 | No |

### Variables de entorno

- Las variables propias usan mayúsculas y `SNAKE_CASE`, con términos de dominio en español, por ejemplo `IDENTIDAD_DB_USUARIO`.
- Las imágenes oficiales conservan variables técnicas estándar, como `POSTGRES_USER`, `MONGO_INITDB_ROOT_USERNAME` y `RABBITMQ_DEFAULT_USER`.
- Las API reciben `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` para PostgreSQL; candidaturas recibe `MONGODB_HOST`, `MONGODB_PORT`, `MONGODB_DATABASE`, `MONGODB_USERNAME`, `MONGODB_PASSWORD` y `MONGODB_AUTH_SOURCE`.
- Las credenciales se obtienen del `.env` local, ignorado por Git y excluido del contexto Docker. `.env.example` solo contiene valores ficticios.
- Cada usuario de aplicación tiene permisos en su base propia.

### Errores REST y correlación

- Los errores usan `application/problem+json` conforme a RFC 9457, con `type`, `title`, `status`, `detail`, `instance` e `idCorrelacion`.
- `X-Correlation-ID` identifica una solicitud; NGINX conserva el valor recibido o genera uno, y los servicios lo devuelven en la respuesta.
- Las propuestas CRUD no implementan autenticación ni un catálogo completo de errores de dominio.

## Contratos pendientes

Revisar con las personas responsables los campos y estados mínimos, privacidad, autorización, tiempos de espera y reglas de borrado antes de considerarlos definitivos. No incluir identidad del votante ni datos que permitan reconstruir su selección en eventos de votación.