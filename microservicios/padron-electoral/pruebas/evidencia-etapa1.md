# Evidencia de Etapa 1 — Integrante 2

Verificación local realizada el **10 de noviembre de 2026** sobre la base `34880d4` de `main`, con los cambios propios de la rama `feature/integrante-2-etapa-1`.

## Alcance

Candidaturas (FastAPI/MongoDB) y Padrón electoral (Node.js/TypeScript/PostgreSQL). Los cambios están limitados a sus dos carpetas. Se conservaron los contratos, el Compose compartido, los servicios de los otros integrantes, frontend y gateway. Los contratos revisados son los dos OpenAPI de estos servicios y `padron-v1.proto`; el evento `voto.registrado.v1` pertenece a Votación/Resultados. Todos mantienen su estado de propuesta del equipo.

## Resultados observados

| Comprobación | Resultado |
| --- | --- |
| Construcción de Padrón con TypeScript | Correcta |
| Dos pruebas gRPC existentes durante construcción | 2 aprobadas |
| Prueba de Padrón con PostgreSQL real | Aprobada: salud, CRUD, filtros, validación, persistencia y gRPC |
| Tres pruebas de Candidaturas | 3 aprobadas: CRUD/persistencia, salud/documentación/carga, error de salud 503 |
| Swagger aislado | HTML y contrato referenciado disponibles |
| Carga de demostración | Dos candidaturas y dos inscripciones; segunda carga inserta cero registros |
| Caída controlada de PostgreSQL | `/salud` devuelve 503 y recupera 200 al volver la base |
| Caída controlada de MongoDB | `/salud` devuelve 503 y recupera 200 al volver la base |
| Reinicio de bases y de APIs | Registros de ejemplo y fechas conservados |
| Configuración local | `.env` ignorados por Git, claves distintas y permisos 600 |
| Contexto mínimo de construcción | Padrón 12 archivos, unos 24 KB comprimidos; Candidaturas 5 archivos, unos 5 KB |

La comprobación del CRUD realiza operaciones HTTP y consulta solamente la base propia del servicio para verificar persistencia. La prueba de recuperación corta de verdad la base aislada y reinicia cada API; no simula PostgreSQL ni MongoDB. Los ejemplos pertenecen a una elección sintética de referencia, sin escribir en el servicio de Elecciones. Estas comprobaciones no equivalen a una prueba de carga ni a validar el sistema electoral completo.

## Memoria

Muestra de `docker stats --no-stream` en reposo, después de las pruebas funcionales:

| Contenedor | Uso observado | Límite |
| --- | ---: | ---: |
| Padrón | 31,70 MiB | 128 MiB |
| PostgreSQL propio | 18,79 MiB | 128 MiB |
| Candidaturas | 39,64 MiB | 128 MiB |
| MongoDB propio | 130,40 MiB | 512 MiB |
| Total | **220,53 MiB** | **896 MiB** |

Es una muestra local, no una garantía bajo carga. Los límites corresponden a los Compose aislados de esta etapa; no cambian el Compose compartido ni incluyen memoria de Docker, construcción o cachés del anfitrión. No se levantaron servicios de otros integrantes.

## Reproducir

Desde la raíz del repositorio:

```sh
sh microservicios/padron-electoral/desarrollo/etapa1.sh iniciar
sh microservicios/padron-electoral/desarrollo/etapa1.sh cargar
sh microservicios/padron-electoral/desarrollo/etapa1.sh probar
python3 microservicios/padron-electoral/pruebas/recuperacion.py
sh microservicios/padron-electoral/desarrollo/etapa1.sh estado
```

`recuperacion.py` interrumpe brevemente **solo** las bases y APIs de estos dos proyectos aislados; las restaura antes de terminar normalmente. Debe ejecutarse sin otra prueba escribiendo al mismo tiempo. Si se interrumpe el proceso externamente, `etapa1.sh iniciar` vuelve a levantarlo. No elimina volúmenes.

Para liberar la memoria al terminar, conservando los ejemplos:

```sh
sh microservicios/padron-electoral/desarrollo/etapa1.sh detener
```

El trabajo usa los contratos existentes; no verifica aquí frontend, GraphQL, RabbitMQ ni los servicios de otros integrantes. La documentación de arquitectura compartida contiene secciones anteriores al código actual; se deja su actualización a la coordinación del equipo.
