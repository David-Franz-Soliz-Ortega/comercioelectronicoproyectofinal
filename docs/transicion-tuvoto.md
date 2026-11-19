# Transición a TUVOTO — implementación de desarrollo

Cambio autorizado: seguimiento de resultados por actas; no emisión individual. Servicios activos: identidad, elecciones, actas y resultados. Padrón, votación y candidaturas se retiraron del Compose y se respaldaron privadamente en `.respaldo-local/` antes de retirarlos. Se conservaron sus cambios locales. No se borraron volúmenes ni se modificaron datos existentes.

## Cambios concretos

- Catálogo de candidatos integrado en Elecciones, con fotografía opcional JPEG/PNG; nueva configuración de procesos, unidades y mesas. Asignación validada contra roles reales de identidad. Catálogo congelado al asignar mesas.
- Administrador global o de organización configura; solo operador asignado registra actas. Incluso combinar ADMINISTRADOR y OPERADOR en la misma organización no habilita publicación con esa cuenta.
- Actas: fotografía original, huella SHA-256, versión esperada, reintento por UUID y contenido; serialización PostgreSQL por mesa y detección de foto idéntica usada para otra mesa del proceso.
- Una transacción inserta versión y bandeja de publicación. Sumas incorrectas generan observación sin aporte nuevo. Las correcciones preservan versiones previas.
- Evento nuevo `acta.actualizada.v1`, sin operador/foto/sesión. Dos consumidores independientes y DLQ; proyección por mesa/versiones, sin sumar duplicados ni retroceder por eventos tardíos.
- Query pública de elección actual y resultados; mutation GraphQL autenticada en Actas. Caché pública en gateway, agrupación de visitas concurrentes, Redis con TTL breve y actualización periódica del portal.
- Nueva interfaz TUVOTO sin elección ficticia. Portal público, configuración y captura manual con cámara/archivo. Cookies nuevas `tuvoto-*` para no sobrescribir sesiones SIGAPE en el mismo host.
- Compose separado `tuvoto`, trece contenedores, volúmenes nuevos y variables `TUVOTO_*` requeridas. No se ejecutó el despliegue del producto.

## Evidencia ejecutada

- Compilación TypeScript de identidad y elecciones.
- Pruebas frontend de estado vacío, reintento, 401/403 y login/logout; compilación Vite.
- GraphQL: contrato sin voto/padrón, portal null y caché frente a 50 solicitudes concurrentes simuladas.
- Actas: reglas puras de sumas, foto, huella y contenido del evento; HTTP ASGI en memoria (sin lifespan ni bases).
- PostgreSQL 17 efímero en tmpfs: publicación/reintento, segunda captura, dos capturas simultáneas, observación/corrección y fallo del outbox con rollback seguido de reintento correcto. La suite ampliada aprueba siete pruebas: añade anulación versionada y 10.000 registros sintéticos con filtros, paginación y separación de organización.
- RabbitMQ 4 y MongoDB 8.0 efímeros: consumidores reales, ACK manual/prefetch 1, duplicados, versión tardía ignorada y mensaje inválido en ambas DLQ. Prueba aprobada. Contenedores de prueba retirados sin volúmenes persistentes.
- Reglas de proyección: sumas, porcentajes y observadas incluidas entre pendientes.
- Validación estática Compose usando marcadores de prueba, sin leer/imprimir secretos de `.env`.

Los almacenes de pruebas no pertenecen a SIGAPE ni a sigape-auth-test y no contienen datos reales.

## Pendientes que no se presentan como completados

- OCR y reconocimiento por formato; la entrada es manual, respaldada y confirmada frente al original.
- Migración de datos previos: no se inventan cargo/unidad/organización para adaptar registros antiguos. El nuevo proyecto empieza vacío.
- Prueba de extremo a extremo entre todos los servicios nuevos y revisión visual de escritorio/móvil.
- Construcción íntegra de imágenes y ensayo de arranque del nuevo proyecto: no ejecutados sin autorización de despliegue.
- Pruebas de carga: la caché y los tests de concurrencia no acreditan miles de visitantes reales.
- La adaptación conserva cuatro CRUD y sustituye la consulta gRPC al padrón por asignaciones de mesas; su conformidad integral sigue pendiente.

Los documentos SIGAPE retirados quedan en el respaldo privado. La arquitectura nueva está en `docs/presentaciones/arquitectura-p1.md`. No se hizo commit, push ni tag.
