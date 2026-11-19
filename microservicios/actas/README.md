# Actas TUVOTO

Recepción privada de fotografías JPEG/PNG y cantidades confirmadas manualmente. API FastAPI `/docs`, `/openapi.json`. Solo OPERADOR con asignación verificada mediante Elecciones.

Persistencia propia PostgreSQL: `versiones_actas` y `bandeja_actas`. Original y datos no se sobrescriben: las correcciones son versiones adicionales. La publicación utiliza outbox transaccional, confirms y RabbitMQ. El evento no contiene identificador del operador ni fotografía.

No hay OCR implementado. No usar con datos electorales reales. Las pruebas SQL efímeras y de dominio están en `pruebas/`; no ejecutar scripts P1 sobre este servicio.
