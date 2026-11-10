# Instrucciones del repositorio

SIGAPE es el proyecto final COM-600: Sistema de Gestión y Administración de Procesos Electorales. Este repositorio es un monorepositorio y sus microservicios se desarrollan de manera independiente.

## Idioma del proyecto

- El español es el idioma permanente del proyecto. Los nombres de carpetas, archivos propios, documentación, variables y clases de dominio, funciones de negocio, comentarios y mensajes deben estar en español.
- Se mantienen en inglés únicamente los nombres técnicos estandarizados y los exigidos por herramientas, bibliotecas y frameworks, como `frontend`, `gateway`, `graphql`, `Dockerfile`, `docker-compose.yml`, `package.json`, `package-lock.json`, `go.mod`, `pyproject.toml`, `README.md`, `AGENTS.md` y `.gitignore`.

## Decisiones arquitectónicas

- Cada microservicio es responsable de su modelo y de su propia base de datos lógica. Ningún servicio consulta ni modifica directamente la base de datos de otro servicio.
- Las integraciones entre servicios se realizan mediante contratos explícitos: REST documentado con OpenAPI, gRPC o eventos asíncronos por RabbitMQ, según corresponda al caso de uso.
- Los contratos compartidos viven en `compartido/contratos/`; no se comparten modelos internos ni acceso a persistencia entre servicios.
- `gateway/graphql/` contiene la capa GraphQL de entrada. DataLoader se utiliza para agrupar y deduplicar cargas durante una operación, sin convertir al gateway en dueño de reglas de negocio o datos.
- No se agregan secretos reales al repositorio. La configuración local sensible debe permanecer fuera de Git y del contexto de construcción Docker.
- La infraestructura de desarrollo incluye Docker Compose y NGINX. Kubernetes, Helm, Argo CD y monitoreo permanecen como objetivos posteriores.

## Servicios y tecnologías

| Servicio | Tecnología | Persistencia |
| --- | --- | --- |
| `identidad` | Node.js y TypeScript | PostgreSQL |
| `elecciones` | Node.js y TypeScript | PostgreSQL |
| `candidaturas` | Python y FastAPI | MongoDB |
| `padron-electoral` | Node.js y TypeScript | PostgreSQL |
| `votacion` | Go | PostgreSQL y Redis |
| `resultados` | Python y FastAPI | MongoDB |

## Estado P1 y límites

- `identidad`, `elecciones`, `candidaturas` y `padron-electoral` tienen una primera API CRUD REST académica, documentada en sus OpenAPI y con persistencia en sus propias bases.
- Los cuatro OpenAPI están marcados como propuestas pendientes de revisión por las personas responsables. Mantener productor, contrato, consumidor y pruebas coordinados en cada cambio.
- Los modelos son mínimos y sintéticos; no representan reglas electorales completas ni permiten procesar elecciones reales.
- El padrón de demostración almacena únicamente una inscripción sintética, su elección asociada y elegibilidad. No incluir identidad ni datos personales de electores.
- No afirmar que votación sea anónima criptográficamente sin análisis y verificación especializados.

Mantener el código, las pruebas y la configuración de cada microservicio dentro de `microservicios/`. No agregar secretos reales ni datos electorales reales.