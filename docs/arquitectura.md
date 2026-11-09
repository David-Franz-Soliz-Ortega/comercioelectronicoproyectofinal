# Arquitectura inicial

SIGAPE se organiza como un monorepositorio de microservicios con límites explícitos de propiedad de datos. Cada servicio es responsable de su persistencia y ofrece capacidades mediante contratos, nunca mediante acceso directo a la base de datos de otro servicio.

## Servicios

| Servicio | Responsabilidad | Tecnología y almacenamiento |
| --- | --- | --- |
| `identidad` | Gestionar identidades, autenticación y datos de autorización de las personas usuarias. | Node.js, TypeScript y PostgreSQL |
| `elecciones` | Gestionar la configuración y el ciclo de vida de los procesos electorales. | Node.js, TypeScript y PostgreSQL |
| `candidaturas` | Gestionar postulaciones y la información asociada a las candidaturas. | Python, FastAPI y MongoDB |
| `padron-electoral` | Mantener el padrón electoral y resolver información de inscripción y elegibilidad. | Node.js, TypeScript y PostgreSQL |
| `votacion` | Coordinar la emisión y recepción de sufragios dentro de las reglas del proceso electoral. | Go, PostgreSQL y Redis |
| `resultados` | Procesar y publicar resultados a partir de los datos recibidos mediante integraciones y eventos. | Python, FastAPI y MongoDB |

Estas responsabilidades describen límites iniciales; no implican que las operaciones o reglas ya estén implementadas. Cada servicio conserva la autoridad sobre sus propios datos.

## Comunicación e integración

- REST con contratos OpenAPI para interfaces HTTP.
- gRPC para integraciones internas que se definan como RPC.
- RabbitMQ para comunicación asíncrona mediante eventos versionados.
- Los contratos se organizan en `compartido/contratos/openapi/`, `compartido/contratos/grpc/` y `compartido/contratos/eventos/`.
- El microservicio `resultados` obtiene información mediante contratos y eventos; no consulta la base de datos de `votacion` ni la de otro servicio.
- El gateway GraphQL compone la entrada para `frontend` y usa DataLoader para agrupar cargas dentro de una operación. La lógica de dominio y la persistencia permanecen en los microservicios.

## Persistencia

Cada microservicio tiene una base lógica propia. PostgreSQL corresponde a los servicios de identidad, elecciones, padrón electoral y votación; MongoDB corresponde a candidaturas y resultados. Redis forma parte del stack de votación como componente auxiliar; su patrón de uso se definirá durante el diseño detallado. No se asume una base de datos compartida.

## Infraestructura objetivo

`infraestructura/` reserva espacios para Docker Compose, NGINX, Kubernetes, Helm, Argo CD y monitoreo. La estructura no incluye todavía manifiestos, imágenes, flujos de integración y entrega ni configuración operativa.