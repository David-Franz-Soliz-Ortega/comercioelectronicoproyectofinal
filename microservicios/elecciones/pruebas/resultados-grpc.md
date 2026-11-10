# Evidencia de integración gRPC

Fecha: 10 de noviembre de 2026. Proyecto principal Docker Compose: `sigape`.

## Revisión inicial y contrato

Solo existía `compartido/contratos/grpc/padron-v1.proto`, sin cliente ni servidor implementados. Se implementó la llamada prevista `sigape.padron.v1.ServicioPadron/ConsultarElegibilidad`, con elecciones como consumidor y padrón electoral como productor.

Se verificó automáticamente que el `.proto` conserva paquete, método, mensajes, nombres y números de campos y valores del enum respecto a HEAD. Solo se agregaron comentarios de comportamiento. El contrato sigue siendo una propuesta pendiente de revisión humana.

## Implementación y despliegue

- Cliente gRPC real en elecciones, deadline predeterminado de 1200 ms, correlación, cancelación al desconectarse HTTP, sin reintentos automáticos y traducción de estados.
- Servidor gRPC en padrón, puerto 50051 exclusivamente interno, consulta de solo lectura a su PostgreSQL propio y comprobación de asociación entre inscripción y elección.
- Nueva ruta REST documentada: `/api/v1/elecciones/{idEleccion}/inscripciones/{idInscripcion}/elegibilidad`.
- `npm run compilar`: correcto en ambos servicios.
- Cinco pruebas automatizadas aprobadas: tres del cliente y dos del servidor, con tráfico gRPC HTTP/2 real local y almacén simulado en las pruebas del servidor. Se ejecutaron también durante la construcción Docker.
- `docker compose config --quiet`: correcto.
- `docker compose up -d --build elecciones padron-electoral`: correcto, conservando bases y volúmenes.
- Healthchecks de elecciones, padrón y GraphQL: correctos tras la actualización.
- NGINX validado y recargado sin detenerlo; la ruta nueva usa el proxy REST existente.

## Prueba reproducible entre contenedores

Comando ejecutado:

```sh
python3 microservicios/elecciones/pruebas/grpc-principal.py
```

| Caso | Resultado real |
| --- | --- |
| NGINX → elecciones → gRPC padrón → PostgreSQL propio | Correcto |
| Inscripción elegible / no elegible | HTTP 200, booleano correcto |
| Correlación en los registros del cliente y servidor | Coincidente |
| Inscripción inexistente | gRPC NOT_FOUND (5), HTTP 404 |
| Inscripción de otra elección | gRPC FAILED_PRECONDITION (9), HTTP 409 |
| UUID REST inválido | HTTP 400 |
| UUID inválido enviado directamente por gRPC desde elecciones | INVALID_ARGUMENT (3) real |
| Deadline de 100 ms frente al doble de red que demora 1500 ms | DEADLINE_EXCEEDED (4), traductor HTTP 504 |
| Doble de red que devuelve indisponibilidad | UNAVAILABLE (14), traductor HTTP 503 |
| Query GraphQL con elecciones, inscripciones y candidaturas reales | Correcta, sin errores |
| Votación → RabbitMQ → conteo y auditoría | Ambos totalizaron un registro nuevo |
| Salud final de las seis API y BFF mediante NGINX | Siete respuestas 200 |

Las pruebas de deadline e indisponibilidad utilizan un contenedor independiente del perfil `pruebas-grpc`, sin bases ni puertos publicados. El código del cliente ejecutado es el mismo que usa la ruta REST. No se detuvo ni degradó el padrón real. El doble se detuvo al finalizar y conserva salida 0.

## Datos y volúmenes conservados

| Dato sintético | Identificador |
| --- | --- |
| Elección A | `fd6aab6d-3b48-48ce-8188-ae72c0ce4edb` |
| Elección B | `89127d50-d46a-4a11-8e79-c6bf909b0c1e` |
| Inscripción elegible | `7079bbd9-c850-419b-9f89-596f8a681bc2` |
| Inscripción no elegible | `acb3f6c9-b798-40a5-ab83-9aaff5d70915` |
| Evento de votación | `0853109f-6595-4560-b918-5d4226379efe` |

Evidencia JSON original: `/tmp/sigape-evidencia-grpc-df748eac-f7d3-4c7e-8b0e-e704fbda3a5d.json`.

Antes y después de la prueba: elecciones 10003 → 10005, inscripciones 2 → 4, identidades 1 → 1 y candidaturas 2 → 2. Los registros nuevos son sintéticos y se conservaron. No se almacenó identidad de electores.

Los volúmenes de PostgreSQL, MongoDB (incluido el volumen anónimo existente), Redis y RabbitMQ coinciden antes y después. No se borraron datos ni volúmenes. Estado final: 14 contenedores permanentes saludables; importación de RabbitMQ y doble de prueba detenidos con código 0. Sin commit ni push.

## Pendientes

Revisión humana de los contratos, autenticación/mTLS y reglas electorales completas. El transporte de desarrollo usa HTTP/2 sin TLS en la red interna. El timeout de lectura SQL limita la espera del driver; no garantiza cancelación inmediata de una consulta PostgreSQL en ejecución. La consulta implementada es una lectura por clave primaria.
