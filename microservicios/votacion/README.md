# Votación sintética

Servicio Go con PostgreSQL como fuente de verdad y Redis como caché de consultas inmutables. No recibe identidad, selección ni candidatura. No valida elegibilidad ni implementa una elección real o anonimato criptográfico.

## REST

- `POST /api/v1/votos`: cuerpo `{"idEleccion":"UUID"}` y cabecera obligatoria `Idempotency-Key: UUID` canónica. Devuelve 201 al crear y 200 al repetir la solicitud. Reutilizar la clave con otra elección devuelve 409.
- `GET /api/v1/votos/{idEvento}`: consulta persistida; Redis es prescindible para leer. TTL de caché: 60 segundos.
- `GET /api/v1/salud`: comprueba PostgreSQL, Redis y conexión del publicador RabbitMQ; devuelve 503 si falla alguna dependencia.
- `/openapi.yaml`: propuesta del contrato REST en `compartido/contratos/openapi/votacion.yaml`.

El registro PostgreSQL contiene el evento y su estado de publicación en una sola inserción. El publicador bloquea filas pendientes con `FOR UPDATE SKIP LOCKED`, publica mensajes persistentes con `mandatory` y publisher confirms, y solo marca la fila después de la confirmación. Una caída entre confirmación y actualización puede duplicar el evento; ambos consumidores lo deduplican. Un 201 confirma persistencia, no procesamiento por resultados. Los registros pendientes sobreviven a la caída de RabbitMQ y al reinicio de votación.

## Configuración y ejecución

La configuración sensible viene exclusivamente del entorno: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSLMODE`, `REDIS_HOST`, `REDIS_CLAVE`, `RABBITMQ_HOST`, `RABBITMQ_USUARIO`, `RABBITMQ_CLAVE`. Compose reutiliza las variables existentes de `.env`, sin introducir secretos en la imagen.

Desde la raíz: `docker compose up -d --build votacion resultados resultados-conteo resultados-auditoria`. El esquema se crea aditivamente en la base lógica propia `votacion_db`; no se borran tablas ni registros. La infraestructura existente ya prevé esta base y su usuario. Si el volumen fue inicializado antes de esa previsión, un administrador debe crear únicamente la base y el usuario que falten: no reinicializar volúmenes.

NGINX incorpora rutas `/api/v1/votos`, `/api/v1/resultados` y `/api/v1/salud/{votacion,resultados}`. Para usar las nuevas rutas en una instalación existente se requiere recargar su configuración. Las pruebas no recargan ni reinician el NGINX existente.

## Pruebas reales

Desde la raíz: `sh microservicios/votacion/pruebas/ejecutar.sh`. Requiere Docker Compose, acceso al daemon y Python 3 para generar credenciales efímeras. Construye imágenes, ejecuta pruebas Go y levanta PostgreSQL, MongoDB, Redis, RabbitMQ y ambos servicios con un nombre de proyecto único, sin publicar puertos ni usar los volúmenes actuales.

Comprueba contrato, validación REST, idempotencia HTTP concurrente, reentrega del mismo evento, conflictos y DLQ independientes, conteos concurrentes, consumidor detenido, RabbitMQ detenido, bandeja pendiente tras reiniciar publicador, persistencia tras reiniciar bases y aplicaciones, ACK manual inspeccionado en el broker, agotamiento real de reintentos ante escritura fallida, fallback sin Redis y rutas NGINX. El script conserva contenedores, volúmenes, evidencia y el archivo temporal privado del entorno; imprime sus identificadores para inspección. No ejecuta `down -v` ni elimina datos.

Referencias del diseño: [confirmaciones RabbitMQ](https://www.rabbitmq.com/docs/confirms), [fiabilidad y deduplicación](https://www.rabbitmq.com/docs/reliability).
