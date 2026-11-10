# Registro de propuesta CRUD REST para P1

**Estado:** propuesta implementada de forma coordinada; revisión y aprobación final de las personas responsables pendiente.

## Contratos conservados y ampliados

Los cuatro OpenAPI conservan sus rutas de consulta originales y ahora incluyen CRUD demostrativo:

| Servicio | Operación conservada | Operaciones añadidas | Modelo mínimo propuesto |
| --- | --- | --- | --- |
| `identidad` | `GET /api/v1/identidades/{idIdentidad}` | Listado, `POST`, `PUT`, `DELETE` y salud. | `nombre`, `estado`; sin contraseñas ni datos de autenticación. |
| `elecciones` | `GET /api/v1/elecciones/{idEleccion}` | Listado, `POST`, `PUT`, `DELETE` y salud. | `nombre`, `estado`; solo borrador admite edición/eliminación. |
| `candidaturas` | `GET /api/v1/candidaturas/{idCandidatura}` | Listado, `POST`, `PUT`, `DELETE` y salud. | `idEleccion`, `nombre`, `tipo`, `estado`; sin expediente personal. |
| `padron-electoral` | `GET /api/v1/inscripciones/{idInscripcion}/elegibilidad` | Listado, `POST`, consulta por ID, `PUT`, `DELETE` y salud. | `idEleccion`, `elegible`; no se almacena identidad del elector. |

Todos los listados proponen `pagina` y `limite` (máximo 100); los filtros se describen en cada OpenAPI. Los errores de validación usan `application/problem+json`. Las especificaciones están marcadas `pendiente-de-revision-del-equipo`.

## Límites deliberados

- El CRUD solo sirve para demostración académica; no representa reglas completas ni permite operar elecciones reales.
- Padrón contiene registros sintéticos sin datos personales. No es un padrón real ni emite autorizaciones para votar.
- No se implementó autenticación; los contenedores no publican puertos y las API solo se exponen por NGINX en el entorno local.
- No se definieron datos de identidad como correo, documento, OTP, contraseñas o roles, porque no forman parte del contrato previo y requieren aprobación específica.

## Revisión pendiente del equipo

1. Aprobar o ajustar los campos, estados y políticas de modificación/eliminación por servicio.
2. Acordar privacidad, autorización y pertenencia institucional antes de ampliar identidad o padrón.
3. Revisar respuestas `400`, `404`, `409`, `422` y el uso de `application/problem+json`.
4. Actualizar contratos, productores, consumidores y pruebas en el mismo cambio si se modifica una decisión.

## Evidencia local

La prueba `pruebas/integracion/probar-crud-p1.sh` recorre creación, consulta, listado filtrado/paginado, actualización, eliminación y errores para los cuatro servicios a través de NGINX. Las imágenes compilan en sus Dockerfiles multietapa; esta evidencia no sustituye la aprobación de contratos ni una revisión de seguridad.
