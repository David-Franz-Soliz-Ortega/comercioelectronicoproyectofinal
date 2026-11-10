# SIGAPE

**Sistema de Gestión y Administración de Procesos Electorales** · Proyecto final COM-600

Primera entrega académica de un monorepositorio de microservicios. Incluye infraestructura local Docker Compose y cuatro CRUD REST P1 y servicios de votación sintética y resultados conectados a bases propias. Los modelos son mínimos y demostrativos; los contratos OpenAPI permanecen como propuestas pendientes de revisión del equipo. No hay autenticación y no debe cargarse información electoral real.

## Estructura

- `frontend/`: interfaz React funcional con listados y formulario conectados al BFF GraphQL.
- `gateway/graphql/`: BFF funcional con GraphQL y DataLoader que agrega elecciones, candidaturas y padrón electoral mediante REST.
- `microservicios/`: seis servicios; cuatro CRUD iniciales, votación sintética con PostgreSQL/Redis y resultados con MongoDB y dos consumidores RabbitMQ independientes.
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

Solo NGINX publica el puerto HTTP del anfitrión (8080 por defecto). Los puertos de bases de datos, Redis y RabbitMQ permanecen internos. La interfaz React está disponible en `http://localhost:8080`, con listados reales y formulario de creación de elecciones. El BFF GraphQL está disponible en `POST /graphql`, con salud en `/api/v1/salud/graphql`.

## Datos de demostración

Carga repetible de 10.000 elecciones sintéticas:

```sh
docker compose exec -T elecciones node dist/cargar-demostracion.js
```

La carga usa identificadores deterministas y no crea datos electorales reales. Filtros y paginación están disponibles en `GET /api/v1/elecciones`.

Las pruebas integradas se pueden ejecutar tras levantar Compose. Los contratos describen propuestas y no habilitan uso fuera de un entorno académico aislado. No se implementa todavía autenticación ni anonimato criptográfico. Votación registra únicamente participación sintética, sin selección ni identidad.

Los nuevos servicios, sus garantías y las pruebas reales aisladas se describen en [votación](microservicios/votacion/README.md) y [resultados](microservicios/resultados/README.md).

## Verificación de votación y resultados

Tras levantar el Compose principal, la prueba aditiva de extremo a extremo se ejecuta con:

```sh
docker compose exec -T resultados python - < microservicios/resultados/pruebas/principal.py
```

Comprueba las seis API por NGINX, el evento compartido, persistencia e idempotencia de ambos consumidores; conserva los registros sintéticos y no detiene servicios. Véase la [evidencia de integración principal](microservicios/resultados/pruebas/integracion-principal.md).


## BFF GraphQL

El BFF integra tres microservicios mediante sus API reales, con queries, mutations y DataLoader por operación. El [contrato SDL](compartido/contratos/graphql/esquema.graphql) conserva las propuestas de dominio y no accede a bases ajenas. Véanse [ejemplos, límites y ejecución](gateway/graphql/README.md) y [pruebas reales por localhost:8080](gateway/graphql/pruebas/resultados-pruebas.md).


## Integración gRPC

Elecciones consulta elegibilidad sintética al padrón mediante `sigape.padron.v1.ServicioPadron/ConsultarElegibilidad`, con deadline de 1200 ms y códigos de estado. La ruta pública es `GET /api/v1/elecciones/{idEleccion}/inscripciones/{idInscripcion}/elegibilidad`. El puerto gRPC 50051 permanece interno; REST, GraphQL y RabbitMQ se conservan. Véanse [implementación y prueba reproducible](microservicios/elecciones/README.md) y [evidencia gRPC real](microservicios/elecciones/pruebas/resultados-grpc.md).


## Interfaz React

La interfaz permite consultar elecciones, candidaturas y padrón, filtrar y paginar los datos y crear elecciones mediante GraphQL. No contiene registros simulados ni accede directamente a las bases. Véanse [ejecución y prueba de navegador](frontend/README.md) y [evidencia del flujo real](frontend/pruebas/resultados-pruebas.md).

## Cierre técnico P1

El [informe de cierre](docs/cierre-p1.md) registra el ensayo de clon local más cambios pendientes, con Compose aislado, bases nuevas y rutas críticas verificadas. Incluye [procedimiento reproducible](pruebas/cierre-p1/README.md), evidencias y pendientes de publicación. El candidato probado todavía requiere incorporación autorizada a Git y verificación desde el commit definitivo.
