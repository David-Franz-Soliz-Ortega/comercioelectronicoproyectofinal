# Padrón electoral: REST y gRPC

## Integrante 2 — Etapa 1

El reparto del repositorio asigna Candidaturas y Padrón al integrante 2. Esta entrega conserva el CRUD, el contrato REST y el servidor gRPC existentes. La tabla propia es `padron_electoral_db.inscripciones`, con `id_inscripcion`, `id_eleccion`, `elegible`, `creado_en` y `actualizado_en`. No almacena identidad, candidato ni voto.

Desde la raíz, con Docker Engine, Docker Compose y Python 3:

```sh
sh microservicios/padron-electoral/desarrollo/etapa1.sh iniciar
sh microservicios/padron-electoral/desarrollo/etapa1.sh cargar
sh microservicios/padron-electoral/desarrollo/etapa1.sh probar
sh microservicios/padron-electoral/desarrollo/etapa1.sh estado
```

El script genera `.env` locales con secretos distintos y permisos 600 sin sobrescribir los existentes. Levanta únicamente tus dos servicios y sus bases, con proyectos y volúmenes propios. Construye las imágenes secuencialmente. `desarrollo/construir.py` envía a Docker un archivo tar con una lista explícita de fuentes y contratos: excluye `.env`, Git y dependencias locales incluso con el constructor clásico. No arranca el Compose general ni necesita servicios de otro integrante. Para construir este entorno usa el script `iniciar`.

Padrón queda en <http://127.0.0.1:3004/salud>, Swagger en <http://127.0.0.1:3004/docs/> y el listado en <http://127.0.0.1:3004/api/v1/inscripciones>. Candidaturas responde en <http://127.0.0.1:8003/salud>. Se conservan las rutas `/salud` y `/api/v1/salud`; la conexión se comprueba en cada solicitud. PostgreSQL no se publica al anfitrión y el usuario de aplicación no es administrador.

`src/cargar-demostracion.ts` crea dos inscripciones sintéticas (elegible y no elegible), con IDs terminados en `0011` y `0012`, para `idEleccion=20000000-0000-4000-8000-000000000001`. Se ejecuta dentro del contenedor con `node dist/cargar-demostracion.js`. Usa `ON CONFLICT DO NOTHING`: repetirlo no duplica registros ni modifica fechas o ediciones. Esa elección es una referencia de demostración; el script no crea elecciones en bases ajenas. Los mismos IDs de elección se usan en los ejemplos de Candidaturas.

`src/persistencia.ts` concentra la creación idempotente de tabla/índice y un pool de hasta cinco conexiones, liberando las ociosas tras diez segundos. Limita la espera de conexión a dos segundos y la ejecución SQL a tres. Un error de conexión ociosa se registra sin terminar el proceso; `/salud` devuelve 503 mientras la base no está disponible.

Los contenedores de Padrón y PostgreSQL tienen límites de 128 MiB cada uno; junto a Candidaturas y MongoDB suman 896 MiB. Son límites de ejecución de estos Compose locales, no consumo garantizado ni límites de la construcción. El Compose del equipo queda intacto. Para liberar memoria sin perder datos:

```sh
sh microservicios/padron-electoral/desarrollo/etapa1.sh detener
```

`pruebas/etapa1.mjs` verifica salud, persistencia real, carga repetible, CRUD, filtros, rechazo de datos ajenos al contrato y elegibilidad REST/gRPC. Solo elimina registros creados por la propia prueba; conserva los ejemplos. Se ejecuta con `node --test pruebas/etapa1.mjs` dentro del contenedor de Padrón. No se añaden dependencias.

La configuración aislada está en `compose.etapa1.yml`, `.env.example` y `desarrollo/`; la configuración compartida conserva sus nombres, puertos internos y contratos. Para cambiar el puerto local usa `PUERTO_HTTP_PADRON` en `.env` y vuelve a ejecutar el script. No cambies credenciales de un volumen inicializado sin migrar también el usuario en PostgreSQL.

Los contratos siguen siendo propuestas del equipo. Esta etapa no implementa nuevas reglas electorales, autorización para votar ni eventos; `voto.registrado.v1` pertenece a Votación y Resultados. Más detalles del arranque conjunto en [Candidaturas](../candidaturas/README.md).

## Integración gRPC existente

Conserva su CRUD REST académico y añade `sigape.padron.v1.ServicioPadron/ConsultarElegibilidad` en el puerto interno 50051. Usa exactamente el contrato compartido `compartido/contratos/grpc/padron-v1.proto`, copiado por Docker en `/app/padron-v1.proto`. No cambia los campos ni los números protobuf.

El servidor valida correlación y UUID, consulta exclusivamente su tabla propia `inscripciones`, verifica que `id_proceso_electoral` corresponde a `id_eleccion` y devuelve el enum de elegibilidad sintética. No recibe identidad ni selección. La base no se reinicializa ni se modifica con la consulta gRPC.

Estados: `INVALID_ARGUMENT` para datos mal formados, `NOT_FOUND` para inscripción ausente, `FAILED_PRECONDITION` para elección distinta, `DEADLINE_EXCEEDED` para plazo agotado, `UNAVAILABLE` para fallos de conexión de persistencia, `RESOURCE_EXHAUSTED` para capacidad de PostgreSQL agotada e `INTERNAL` para errores inesperados. El cliente recibe un mensaje de dominio breve; los errores SQL internos no se exponen.

El deadline recibido acota el timeout de lectura del driver PostgreSQL a un máximo de 1000 ms. Si la llamada se cancela, su resultado ya no se envía. El timeout del driver no constituye una garantía de cancelación inmediata de una consulta ya en ejecución en PostgreSQL. La consulta es una lectura indexada por la clave primaria de inscripción.

`GRPC_DIRECCION=0.0.0.0:50051` se configura en Compose, en `red_interna`, sin publicar el puerto en el anfitrión. `CONTRATO_GRPC` permite indicar otro archivo de contrato en desarrollo; en Docker la ubicación predeterminada ya existe. El servidor HTTP arranca después de inicializar persistencia y enlazar gRPC; por tanto, un fallo de enlace evita reportar salud REST antes de arrancar el protocolo nuevo. Los endpoints y las respuestas REST anteriores se conservan.

Ambos transportes tienen cierre ordenado al recibir SIGTERM/SIGINT. El cliente de elecciones tiene deadline obligatorio. El transporte de desarrollo usa HTTP/2 sin TLS dentro de la red interna de Compose; autenticación/mTLS y revisión humana del contrato quedan pendientes.

Pruebas del servidor:

```sh
npm ci --prefix microservicios/padron-electoral --ignore-scripts
npm run compilar --prefix microservicios/padron-electoral
npm run probar-grpc --prefix microservicios/padron-electoral
```

Para la prueba real entre contenedores y las verificaciones de REST, GraphQL y RabbitMQ, consulte `../elecciones/README.md` y ejecute desde la raíz `python3 microservicios/elecciones/pruebas/grpc-principal.py`.
