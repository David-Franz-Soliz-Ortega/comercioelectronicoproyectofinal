# SIGAPE

**Sistema de Gestión y Administración de Procesos Electorales** · Proyecto final COM-600

Este repositorio contiene la estructura inicial de un monorepositorio orientado a microservicios. Por ahora incluye estructura y documentación: no implementa lógica de negocio, operaciones CRUD ni aplicaciones ejecutables, y no instala dependencias.

## Estructura

- `frontend/`: aplicación web React.
- `gateway/graphql/`: gateway GraphQL con DataLoader.
- `microservicios/`: seis servicios independientes; sus responsabilidades están descritas en [`docs/arquitectura.md`](docs/arquitectura.md).
- `compartido/contratos/openapi/`: contratos HTTP REST con OpenAPI.
- `compartido/contratos/grpc/`: definiciones de interfaces gRPC.
- `compartido/contratos/eventos/`: esquemas y documentación de eventos para RabbitMQ.
- `infraestructura/`: espacios para Docker Compose, Kubernetes, Helm, Argo CD y monitoreo.
- `pruebas/integracion/` y `pruebas/rendimiento/`: pruebas entre componentes y de rendimiento.
- `docs/`: documentación del proyecto y su arquitectura.

## Tecnologías acordadas

Node.js/TypeScript y PostgreSQL para `identidad`, `elecciones` y `padron-electoral`; Python/FastAPI y MongoDB para `candidaturas` y `resultados`; Go, PostgreSQL y Redis para `votacion`; React para `frontend`; GraphQL y DataLoader para `gateway`.

La comunicación contempla REST/OpenAPI, gRPC y mensajería asíncrona con RabbitMQ. La infraestructura objetivo contempla Docker Compose, NGINX, Kubernetes, Helm y Argo CD.

## Inicio

1. Revisa [`AGENTS.md`](AGENTS.md) y [`docs/arquitectura.md`](docs/arquitectura.md) antes de proponer cambios.
2. Usa la estructura existente y conserva el aislamiento de datos de cada microservicio.
3. Las versiones de los entornos de ejecución, los comandos de instalación y ejecución, y los despliegues se definirán al incorporar las primeras aplicaciones; todavía no hay manifiestos ni dependencias para ejecutar.

No guardes credenciales ni secretos reales en este repositorio. No hay un comando de inicio disponible en esta etapa inicial.