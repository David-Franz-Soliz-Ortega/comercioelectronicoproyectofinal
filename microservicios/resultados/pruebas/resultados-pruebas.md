# Evidencia de pruebas reales

Fecha: 10 de noviembre de 2026. Proyecto Docker aislado: `sigape-pruebas-1794326091`.

Se construyeron y ejecutaron votación Go, API FastAPI y dos consumidores independientes contra PostgreSQL 17, MongoDB 8, Redis 7 y RabbitMQ 4.4.0 reales. Se conservan contenedores, volúmenes y evidencia; no se usaron los datos del proyecto `sigape` existente.

| Verificación | Resultado |
| --- | --- |
| `go test ./...` durante construcción de la imagen final | Correcto |
| Salud de API, almacenes y consumidores | Correcto |
| Productor validado contra JSON Schema compartido | Correcto |
| POST y consulta persistida, UUID, campo adicional y errores REST | Correcto |
| 16 solicitudes concurrentes con una clave: mismo evento, sin duplicación | Correcto |
| Misma clave con distinta elección: 409 | Correcto |
| Ocho publicaciones repetidas: un registro por consumidor | Correcto |
| JSON inválido, propiedad adicional y conflicto de idEvento | Tres mensajes conservados en cada DLQ |
| 20 solicitudes distintas concurrentes más registro inicial | 21 registros en cada proyección |
| Detener auditoría | Conteo continúa; la otra cola conserva su evento |
| Reiniciar auditoría | Ambas proyecciones recuperan el mismo conteo |
| Detener RabbitMQ, registrar y reiniciar publicador antes de recuperar broker | Bandeja PostgreSQL recuperada; conteo final de la elección de prueba: 23 |
| Reiniciar PostgreSQL, MongoDB, Redis y aplicaciones | Registros, idempotencia y DLQ conservados |
| Inspección de consumidores mediante API de RabbitMQ | Dos conexiones diferentes, ACK manual y prefetch 1 |
| Fallo real de escritura MongoDB, solo para un nuevo evento sintético de conteo | Reintentos acotados; evento conservado en DLQ de conteo, auditoría procesa |
| Restablecer escritura y reprocesar el mismo evento | Un registro en cada proyección; DLQ conservada como evidencia |
| Redis detenido | Consulta desde PostgreSQL correcta; salud 503 |
| Redis recuperado | Salud recuperada |
| REST, salud y contratos a través de NGINX aislado | Correcto |
| `docker compose config --quiet` y `git diff --check` | Correcto |
| Diff de los cuatro servicios originales y esquema del evento | Sin cambios |

La prueba de agotamiento detectó que `basic.nack(requeue=true)` no incrementa el contador de fallos en RabbitMQ 4.4. Se corrigió a `basic.reject(requeue=true)`, se reconstruyeron los consumidores y se repitió satisfactoriamente la prueba. El validador temporal de MongoDB se retiró en `finally`; no se eliminaron registros.

Estado final: servicios originales saludables y sin reinicios; servicios nuevos aislados saludables. DLQ de conteo: cuatro mensajes; DLQ de auditoría: tres. La evidencia de la elección principal está en el volumen `sigape-pruebas-1794326091_evidencia`.

Reproducción desde un entorno nuevo: `sh microservicios/votacion/pruebas/ejecutar.sh`. El guion crea un proyecto único y credenciales aleatorias privadas en `/tmp`; conserva los datos. Las pruebas también se ejecutaron por fases durante la corrección de compatibilidad del broker.

Pendientes funcionales: revisión de propuestas REST/evento, autenticación y autorización, reglas electorales y operación de reproceso de DLQ. La activación posterior en el Compose principal se documenta en [integración principal](integracion-principal.md), con sus verificaciones y datos sintéticos conservados.
