# Evidencia del BFF GraphQL

Fecha: 10 de noviembre de 2026. Proyecto Docker principal: `sigape`. Endpoint probado desde el anfitrión: `http://localhost:8080/graphql`.

## Validación y despliegue

- Leídos AGENTS.md y los contratos REST de elecciones, candidaturas y padrón electoral. Se agregó el SDL compartido sin modificar esos productores ni sus contratos.
- `docker compose config --quiet`: correcto.
- `npm run verificar --prefix gateway/graphql`: correcto. Las seis pruebas también se ejecutaron explícitamente con `node --test --test-isolation=none --test-reporter=tap gateway/graphql/pruebas/agregacion.test.js` y durante la construcción Docker: seis aprobadas, cero fallidas.
- `docker compose up -d --build gateway-graphql`: correcto; se conservaron los contenedores existentes.
- Healthcheck del BFF: saludable, con conexiones REST a los tres servicios.
- `nginx -t` y `nginx -s reload`: correctos, sin detener NGINX.
- Estado final: los 14 contenedores permanentes están saludables; la tarea previa de configuración RabbitMQ conserva salida 0.

## Prueba real por localhost:8080

Comando ejecutado: `python3 gateway/graphql/pruebas/principal.py`.

| Comprobación | Resultado |
| --- | --- |
| Salud de las seis API existentes y el BFF mediante NGINX | Siete respuestas 200 |
| Descarga del SDL público | Correcta |
| Mutation `crearEleccion` con dos alias | Dos elecciones sintéticas persistidas |
| Mutations `crearCandidatura` y `crearInscripcion` | Dos candidaturas y dos inscripciones sintéticas persistidas |
| Lectura REST independiente de los seis registros creados | Correcta |
| Query de elecciones con candidaturas, inscripciones y referencias de regreso a elección | Agregación real de los tres servicios |
| Alias repetidos y relaciones anidadas | Sin llamadas REST por cada padre/alias |
| `eleccionesPorIds` con claves repetidas y distinto orden | Orden y duplicados conservados, sin llamadas REST adicionales |
| Queries directas de candidaturas e inscripciones con referencia a elección | Correctas |
| Elección inexistente | `null`, sin error |
| GET sobre `/graphql` | 405 |
| Campo GraphQL inexistente | 400 |
| UUID inválido | Error GraphQL `ENTRADA_INVALIDA` |

Los registros JSON correlacionados del BFF acreditaron estas llamadas REST para la query agregada:

| Servicio | Llamadas |
| --- | ---: |
| elecciones | 1 |
| candidaturas | 1 |
| padrón electoral | 1 |
| Total | 3 |

La prueba del lote con tres posiciones y dos UUID únicos obtuvo los mismos contadores: una llamada por servicio. Las relaciones de regreso a elección se resolvieron con el DataLoader de la misma operación.

La evidencia JSON original se conservó en `/tmp/sigape-evidencia-graphql-d76eb63b-ec4b-4cc1-90ab-6b18e9c11691.json`.

## Datos sintéticos conservados

| Recurso | UUID |
| --- | --- |
| Elección A | `1c972729-2351-4c66-b62f-22a5dccd3680` |
| Elección B | `1b5de077-cb68-4525-a225-4c513ac8a38d` |
| Candidatura A | `bb7be218-39bb-465b-9d7f-eb515d79e617` |
| Candidatura B | `ca65b10e-7c79-4aa7-ab61-9d56e8940149` |
| Inscripción A | `3b394c7d-abc2-4d7d-a052-d506c08aa9fa` |
| Inscripción B | `1dc51c62-362f-4a64-9288-c52aba08a37d` |

Los nombres utilizan el prefijo `Prueba sintética BFF 5f069238-71c9-4a96-ad62-93f19ef66c65`. Las inscripciones solo contienen elección y elegibilidad, sin identidad ni datos personales.

Se compararon antes y después los identificadores de los seis servicios existentes y de PostgreSQL, MongoDB, Redis y RabbitMQ, junto con sus volúmenes: coinciden exactamente. No se borraron datos, no se modificó el código de los productores y no se hizo commit ni push.

## Límites y pendientes

Los contratos REST no tienen consultas por múltiples UUID. El BFF agrupa mediante sus listados paginados; puede necesitar varias páginas y rechaza lotes incompletos al superar el límite configurable (20 páginas de 100 registros por defecto). El resultado de tres llamadas corresponde a los datos reales de esta prueba, no es una garantía de una sola llamada para cualquier volumen.

Quedan pendientes la revisión humana del SDL, autenticación/autorización y endpoints REST de lote para conjuntos mayores. Las reglas de negocio siguen perteneciendo a los productores.
