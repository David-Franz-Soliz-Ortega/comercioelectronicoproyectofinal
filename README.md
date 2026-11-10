# SIGAPE

**Sistema de Gestión y Administración de Procesos Electorales** · Proyecto final COM-600

Primera entrega académica de un monorepositorio de microservicios. Incluye infraestructura local Docker Compose y cuatro CRUD REST P1 conectados a bases propias. Los modelos son mínimos y demostrativos; los contratos OpenAPI permanecen como propuestas pendientes de revisión del equipo. No hay autenticación y no debe cargarse información electoral real.

## Estructura

- `frontend/`: espacio reservado para la aplicación React.
- `gateway/graphql/`: espacio reservado para GraphQL y DataLoader.
- `microservicios/`: seis servicios; identidad, elecciones, candidaturas y padrón tienen una API CRUD inicial.
- `compartido/contratos/`: contratos OpenAPI, gRPC y eventos RabbitMQ.
- `infraestructura/docker/`: configuración de bases, RabbitMQ y NGINX.
- `pruebas/integracion/`: pruebas REST y ejemplos de solicitudes P1.
- `docs/`: arquitectura y propuestas del proyecto.

## Tecnologías

Node.js/TypeScript y PostgreSQL para `identidad`, `elecciones` y `padron-electoral`; Python/FastAPI y MongoDB para `candidaturas` y `resultados`; Go, PostgreSQL y Redis para `votacion`; React; GraphQL con DataLoader; REST/OpenAPI, gRPC y RabbitMQ.

## Inicio local

Requisitos: Docker Engine y Docker Compose.

1. Copia `.env.example` como `.env` y sustituye los valores `CAMBIAR_...` con secretos aleatorios distintos. No subas `.env`.
2. Comprueba la definición sin imprimir secretos: `docker compose config --quiet`.
3. Construye e inicia el sistema: `docker compose up -d --build`.
4. Revisa salud: `docker compose ps`.
5. Ejecuta las pruebas REST: `sh pruebas/integracion/probar-crud-p1.sh`.

Solo NGINX publica el puerto HTTP del anfitrión (8080 por defecto). Los puertos de bases de datos, Redis y RabbitMQ permanecen internos. Los servicios de frontend y GraphQL aún no están implementados.

## Datos de demostración

Carga repetible de 10.000 elecciones sintéticas:

```sh
docker compose exec -T elecciones node dist/cargar-demostracion.js
```

La carga usa identificadores deterministas y no crea datos electorales reales. Filtros y paginación están disponibles en `GET /api/v1/elecciones`.

Las pruebas integradas se pueden ejecutar tras levantar Compose. Los contratos describen propuestas y no habilitan uso fuera de un entorno académico aislado. No se implementa todavía autenticación, votación ni anonimato criptográfico.