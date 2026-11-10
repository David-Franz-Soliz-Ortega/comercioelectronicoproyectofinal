# Integración verificada en Compose principal

Fecha: 10 de noviembre de 2026. Proyecto: `sigape`. NGINX público: `http://localhost:8080`.

## Cambios y despliegue

- Se conservaron las definiciones de identidad, elecciones, candidaturas y padrón electoral, sus contratos y sus archivos.
- NGINX espera también los healthchecks de votación y resultados. Los nuevos servicios usan la red interna y sus bases lógicas propias; solo NGINX publica HTTP.
- PostgreSQL ya contenía `votacion_db` y MongoDB el usuario propio de `resultados_db`: no fue necesario reinicializar bases, cambiar credenciales ni recrear volúmenes.
- Se ejecutó `docker compose config --quiet` y, correctamente, `docker compose up -d --build`.
- Se ejecutaron `docker compose exec -T entrada-nginx nginx -t` y `nginx -s reload` para activar las rutas montadas sin detener NGINX.

## Verificación real

Los 13 contenedores permanentes quedaron `healthy`: las cuatro API originales, votación, resultados, dos consumidores, cuatro almacenes y NGINX. La tarea `configurar-mensajeria` terminó con código 0, como corresponde a una importación de configuración.

Prueba ejecutada:

```sh
docker compose exec -T resultados python - < microservicios/resultados/pruebas/principal.py
```

Resultado:

- Las seis API respondieron salud 200 mediante NGINX y los contratos REST de votación y resultados se descargaron correctamente.
- Se comprobó en RabbitMQ que conteo y auditoría tienen conexiones independientes, ACK manual y prefetch 1; sus colas y DLQ son durables.
- POST por NGINX devolvió 201 y un evento válido según el JSON Schema compartido, que permanece intacto. La misma solicitud devolvió 200 con el mismo evento; otra elección con la misma clave devolvió 409.
- El evento atravesó NGINX → votación → PostgreSQL/bandeja transaccional → RabbitMQ → dos consumidores → MongoDB → consulta REST de resultados.
- Cinco reentregas reales conservaron exactamente un documento en cada colección y un total de uno en ambas proyecciones.
- PostgreSQL confirmó el registro y `publicado_en IS NOT NULL`; Redis confirmó la existencia de la entrada de caché consultada.
- Se verificaron desde el anfitrión las rutas de salud nuevas y resultados en `http://127.0.0.1:8080`, con respuestas 200.

Datos sintéticos conservados para inspección:

| Campo | Valor |
| --- | --- |
| UUID de elección sintética de prueba | `ceba6973-7cd7-4d7c-81d8-c7e917f88f2e` |
| Evento | `9f2a50b1-8ac1-4cf3-a199-42ac67e642ac` |
| Total de registros | 1 |
| Total de eventos auditados | 1 |

El UUID de elección aísla la prueba; no se creó ni modificó ninguna elección en el servicio elecciones. Las comprobaciones de los cuatro servicios existentes fueron de lectura.

## Conservación y pendientes

Se compararon antes y después los identificadores de los cuatro contenedores originales y de PostgreSQL, MongoDB, Redis y RabbitMQ, junto con sus volúmenes: coincidieron exactamente. No se borraron datos ni volúmenes y no se ejecutaron acciones destructivas, commits ni push.

Pendientes: revisión humana de los contratos propuestos, autenticación/autorización, reglas electorales completas y procedimiento operativo de revisión/reproceso de DLQ. El servicio sigue siendo una demostración académica sin identidad, candidatura ni selección en el evento.
