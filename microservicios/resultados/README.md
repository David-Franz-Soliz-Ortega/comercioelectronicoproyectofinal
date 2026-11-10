# Resultados sintéticos

API FastAPI con MongoDB y dos procesos consumidores independientes. Solo cuenta registros sintéticos por elección; el evento compartido no permite calcular resultados por candidatura. El esquema compartido permanece intacto y pendiente de aprobación.

## REST

- `GET /api/v1/resultados/{idEleccion}`: `idEleccion` y `totalRegistros`.
- `GET /api/v1/resultados/{idEleccion}/auditoria`: `idEleccion` y `totalEventosAuditados`.
- `GET /api/v1/salud`: MongoDB disponible y latidos recientes de ambos consumidores (15 segundos). 503 si falta alguno.
- `/docs`, `/openapi.json`: documentación generada; `/openapi.yaml`: propuesta REST compartida.

Conteo y auditoría pueden diferir temporalmente: son proyecciones eventualmente consistentes. Una elección sin eventos devuelve cero, sin consultar la base de elecciones.

## Consumidores y persistencia

| Proceso Compose | Cola durable | Colección propia | Cola de fallos |
| --- | --- | --- | --- |
| `resultados-conteo` | `resultados.conteo.v1` | `registros_conteo` | `resultados.conteo.v1.dlq` |
| `resultados-auditoria` | `resultados.auditoria.v1` | `registros_auditoria` | `resultados.auditoria.v1.dlq` |

Ambas colas se enlazan al exchange topic durable `sigape.eventos`, ruta `voto.registrado.v1`. Auditoría es una segunda proyección técnica dentro de resultados; no agrega otro microservicio de dominio. Cada consumidor ejecuta `python -m app.consumidor` con `CONSUMIDOR=conteo` o `auditoria`, conexión y ACK manual propios, prefetch 1 y reconexión automática.

Los consumidores validan JSON Schema Draft 2020-12, formatos UUID y fecha/hora y propiedades adicionales contra el archivo compartido copiado en la imagen. Cada evento ocupa un documento con `_id=idEvento` e índice por elección. Insertar, deduplicar y contabilizar son una sola operación atómica: el total se consulta con `count_documents`, sin una actualización separada susceptible de perderse. Se usan escrituras `majority` con journal y no se necesita replica set. Un idEvento repetido con otro contenido se rechaza.

El ACK ocurre después de persistir o comprobar el duplicado. Los mensajes inválidos o conflictivos reciben NACK sin requeue. Ante fallos MongoDB, `basic.reject` con requeue (incrementa `delivery-count` también en RabbitMQ 4.3+); las colas quorum limitan las reentregas a cinco. Cada cola tiene su propia DLQ quorum mediante `sigape.dlq`, con dead-lettering `at-least-once` y `reject-publish`. Las DLQ no tienen consumidores automáticos: se conservan para revisión y eventual reproceso tras resolver el fallo. Los latidos y los healthchecks verifican el bucle de consumo y el acceso a MongoDB.

Variables: `MONGODB_HOST`, `MONGODB_DATABASE`, `MONGODB_USERNAME`, `MONGODB_PASSWORD`, `MONGODB_AUTH_SOURCE`, `RABBITMQ_HOST`, `RABBITMQ_USUARIO`, `RABBITMQ_CLAVE`; sin credenciales predeterminadas. Los procesos acceden exclusivamente a `resultados_db` en producción.

Las pruebas reales y el guion de ejecución están documentados en `../votacion/README.md`; el consumidor de pruebas está en `pruebas/integracion.py`. El proyecto de prueba usa un administrador MongoDB efímero solo en sus volúmenes aislados.

Limitaciones pendientes: autenticación/autorización, reglas electorales, revisión de contratos y operación de recuperación de DLQ. No se garantiza disponibilidad de un clúster con un único nodo RabbitMQ; las colas quorum utilizadas en desarrollo tienen una sola réplica.

Referencia: [atomicidad de documentos MongoDB](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/).

Se verifica la limitación de reintentos con un fallo real de validación de escritura limitado a un evento nuevo en el MongoDB de pruebas. Referencia: [contador de entregas de colas quorum](https://www.rabbitmq.com/docs/quorum-queues#when-is-delivery-count-incremented).

## Verificación del Compose principal

NGINX espera los healthchecks de votación y resultados, además de los cuatro servicios existentes. Desde la raíz, levantar con `docker compose up -d --build`, validar con `docker compose exec -T entrada-nginx nginx -t` y recargar con `docker compose exec -T entrada-nginx nginx -s reload` cuando la configuración montada haya cambiado.

Prueba aditiva de extremo a extremo sobre los servicios principales:

```sh
docker compose exec -T resultados python - < microservicios/resultados/pruebas/principal.py
```

La prueba comprueba las seis API por NGINX, contratos publicados, dos conexiones RabbitMQ con ACK manual, colas y DLQ durables, registro sintético, consulta, idempotencia HTTP, conflicto 409 y cinco reentregas reales con deduplicación MongoDB. No detiene componentes ni elimina registros: conserva una inscripción de participación sintética en votación y un evento en cada proyección de resultados. El UUID de elección generado sirve únicamente para aislar esta prueba; no se crea ni modifica una elección en el servicio elecciones.
