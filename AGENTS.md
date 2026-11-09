# Instrucciones del repositorio

SIGAPE es el proyecto final COM-600: Sistema de Gestión y Administración de Procesos Electorales. Este repositorio es un monorepositorio y sus microservicios se desarrollan de manera independiente.

## Idioma del proyecto

- El español es el idioma permanente del proyecto. Los nombres de carpetas, archivos propios, documentación, variables y clases de dominio, funciones de negocio, comentarios y mensajes deben estar en español.
- Se mantienen en inglés únicamente los nombres técnicos estandarizados y los exigidos por herramientas, bibliotecas y frameworks, como `frontend`, `gateway`, `graphql`, `Dockerfile`, `docker-compose.yml`, `package.json`, `go.mod`, `pyproject.toml`, `README.md`, `AGENTS.md` y `.gitignore`.

## Decisiones arquitectónicas

- Cada microservicio es responsable de su modelo y de su propia base de datos lógica. Ningún servicio consulta ni modifica directamente la base de datos de otro servicio.
- Las integraciones entre servicios se realizan mediante contratos explícitos: REST documentado con OpenAPI, gRPC o eventos asíncronos por RabbitMQ, según corresponda al caso de uso.
- Los contratos compartidos viven en `compartido/contratos/`; no se comparten modelos internos ni acceso a persistencia entre servicios.
- `gateway/graphql/` contiene la capa GraphQL de entrada. DataLoader se utiliza para agrupar y deduplicar cargas durante una operación, sin convertir al gateway en dueño de reglas de negocio o datos.
- No se agregan secretos reales al repositorio. La configuración local sensible debe permanecer fuera de Git.
- La infraestructura objetivo incluye Docker Compose para desarrollo local, NGINX como proxy de entrada, Kubernetes, Helm y Argo CD. Los directorios están preparados, pero aún no contienen despliegues.

## Servicios y tecnologías

| Servicio | Tecnología | Persistencia |
| --- | --- | --- |
| `identidad` | Node.js y TypeScript | PostgreSQL |
| `elecciones` | Node.js y TypeScript | PostgreSQL |
| `candidaturas` | Python y FastAPI | MongoDB |
| `padron-electoral` | Node.js y TypeScript | PostgreSQL |
| `votacion` | Go | PostgreSQL y Redis |
| `resultados` | Python y FastAPI | MongoDB |

## Alcance del scaffold

Este punto de partida contiene estructura y documentación únicamente. No agregar operaciones CRUD, lógica de negocio, dependencias, credenciales ni artefactos de despliegue hasta que se definan como siguiente tarea. Al iniciar la implementación, mantener el código, las pruebas y la configuración de cada servicio dentro de `microservicios/` y documentar los contratos de integración.