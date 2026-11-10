# Arquitectura inicial

SIGAPE se organiza como un monorepositorio de microservicios con límites explícitos de propiedad de datos. Cada servicio es responsable de su persistencia y ofrece capacidades mediante contratos, nunca mediante acceso directo a la base de datos de otro servicio.

## Servicios

| Servicio | Responsabilidad | Tecnología y almacenamiento |
| --- | --- | --- |
| `identidad` | Gestionar identidades y estados de cuenta; la API P1 no implementa autenticación. | Node.js, TypeScript y PostgreSQL |
| `elecciones` | Gestionar un registro mínimo de procesos electorales de demostración. | Node.js, TypeScript y PostgreSQL |
| `candidaturas` | Gestionar postulaciones sintéticas individuales o de lista, sin expedientes personales. | Python, FastAPI y MongoDB |
| `padron-electoral` | Gestionar inscripciones sintéticas y consultar elegibilidad sin datos personales. | Node.js, TypeScript y PostgreSQL |
| `votacion` | Coordinar emisión y recepción de sufragios según reglas futuras. | Go, PostgreSQL y Redis |
| `resultados` | Procesar y publicar resultados mediante integraciones futuras. | Python, FastAPI y MongoDB |

## CRUD REST P1

Las API de `identidad`, `elecciones`, `candidaturas` y `padron-electoral` ofrecen `GET /api/v1/salud`, listado paginado y filtrado, creación `POST`, consulta por ID `GET`, reemplazo `PUT` y eliminación `DELETE` cuando la regla demostrativa lo permite. Swagger está disponible en `/docs` y cada contrato se sirve como `/openapi.yaml` dentro de su servicio. NGINX enruta los recursos REST sin publicar los puertos de aplicación.

| Servicio | Recurso y campos mínimos | Base lógica |
| --- | --- | --- |
| `identidad` | Identidad sintética: `nombre`, `estado`; sin contraseñas ni credenciales. | `identidad_db` |
| `elecciones` | Proceso sintético: `nombre`, `estado`; edición y eliminación solo en borrador. | `elecciones_db` |
| `candidaturas` | Postulación sintética: `idEleccion`, `nombre`, `tipo`, `estado`; eliminación solo en borrador. | `candidaturas_db` |
| `padron-electoral` | Inscripción sintética: `idEleccion`, `elegible`; no guarda identidad del elector. | `padron_electoral_db` |

Los OpenAPI conservan las consultas existentes y están marcados como pendientes de revisión por los integrantes responsables. Sus modelos son propuestas académicas, no reglas electorales aprobadas. El padrón de demostración no es un padrón real ni una autorización para votar.

## Comunicación e integración

- REST con OpenAPI para las API de los microservicios.
- gRPC para integraciones internas que se definan mediante el contrato compartido.
- RabbitMQ para comunicación asíncrona mediante eventos versionados.
- Los contratos se organizan en `compartido/contratos/openapi/`, `compartido/contratos/grpc/` y `compartido/contratos/eventos/`.
- El gateway GraphQL futuro compondrá la entrada para `frontend` y podrá usar DataLoader. No está implementado en P1.

## Persistencia

Cada microservicio tiene una base lógica propia: PostgreSQL para identidad, elecciones, padrón electoral y votación; MongoDB para candidaturas y resultados. Redis forma parte del stack de votación. Ningún servicio comparte credenciales ni consulta directamente otra base.

## Infraestructura

Docker Compose levanta PostgreSQL, MongoDB, Redis, RabbitMQ, NGINX y los cuatro servicios CRUD. Las bases usan volúmenes persistentes y no publican puertos al anfitrión; únicamente NGINX publica HTTP. Las imágenes de los cuatro CRUD son multietapa y ejecutan el proceso sin root. `infraestructura/docker/` conserva inicializadores y configuración. Votación, resultados, GraphQL, frontend, Kubernetes, Helm, Argo CD y monitoreo no están implementados todavía.