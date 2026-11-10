# SIGAPE

**Sistema de Gestión y Administración de Procesos Electorales** · Proyecto final COM-600

Este repositorio contiene la estructura inicial de un monorepositorio orientado a microservicios. Incluye la infraestructura local Docker Compose y contratos iniciales propuestos; todavía no implementa lógica de negocio, operaciones CRUD ni aplicaciones ejecutables.

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
- `docker-compose.yml` y `infraestructura/docker/`: bases de datos, Redis, RabbitMQ y NGINX para desarrollo local.

## Tecnologías acordadas

Node.js/TypeScript y PostgreSQL para `identidad`, `elecciones` y `padron-electoral`; Python/FastAPI y MongoDB para `candidaturas` y `resultados`; Go, PostgreSQL y Redis para `votacion`; React para `frontend`; GraphQL y DataLoader para `gateway`.

La comunicación contempla REST/OpenAPI, gRPC y mensajería asíncrona con RabbitMQ. La infraestructura objetivo contempla Docker Compose, NGINX, Kubernetes, Helm y Argo CD.

## Infraestructura local

Requisitos: Docker Engine y el complemento Docker Compose.

1. Copia `.env.example` como `.env` y sustituye todos los valores `CAMBIAR_...` por claves aleatorias distintas.
2. Valida la configuración con `docker compose config`.
3. Inicia solo la infraestructura con `docker compose up -d` y revisa el estado con `docker compose ps`.
4. Consulta los registros con `docker compose logs -f` y detén los contenedores con `docker compose down`.

Solo NGINX publica un puerto en el equipo anfitrión, `8080` por defecto. PostgreSQL, MongoDB, Redis y RabbitMQ solo son accesibles desde la red Docker interna. Las rutas de NGINX para `frontend` y `gateway` están preparadas, pero devolverán error de proxy hasta que se incorporen esas aplicaciones. Los scripts de inicialización se ejecutan únicamente al crear volúmenes de datos vacíos.

Los contratos iniciales están en [`compartido/contratos/README.md`](compartido/contratos/README.md); las propuestas que afectan a varios integrantes requieren aprobación antes de considerarse definitivas.

## Convenciones

1. Revisa [`AGENTS.md`](AGENTS.md) y [`docs/arquitectura.md`](docs/arquitectura.md) antes de proponer cambios.
2. Conserva el aislamiento de datos: ningún microservicio accede directamente a la base de otro.
3. Mantén el código, pruebas y configuración de cada servicio dentro de `microservicios/` y documenta sus integraciones mediante contratos compartidos.

No guardes credenciales ni secretos reales en este repositorio. En esta etapa solo se inicia la infraestructura; los servicios de aplicación se incorporarán después.