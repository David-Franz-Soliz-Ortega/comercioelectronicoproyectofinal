# Registro único y lectura móvil de feria

Rama `TUVOTO-feria`, base `a7237ec`. Entrega de Codex el 25 de noviembre de 2026. Estado `listo_para_qa` de cámara física. La carga por partes está desplegada en `tuvoto`. Siguiente responsable por asignar.

## Cambios desplegados

- En el frontend, el operador envía una copia JPEG reducida para OCR cuando la fotografía es grande. Conserva el original para revisar y registrar. La lectura dispone de 120 segundos y el envío del original de 180 segundos. Una interrupción de la lectura permite escoger el cargo y transcribir con la foto a la vista.
- Actas repite la lectura de códigos de baja confianza a otra resolución. La pasada alternativa debe confirmar el código completo. El mapa distingue una solicitud incompleta, un exceso de tamaño y un rechazo de validación.
- Compose configura la institución de registro único mediante la variable privada `TUVOTO_FERIA_ORGANIZACION_REGISTRO_UNICO`. Actas publica el indicador `registroUnico` en el listado autenticado. Tras comprobar la idempotencia y bajo el bloqueo de mesa, impide corregir o anular una versión existente en esa institución. React muestra que el registro está cerrado.
- Se actualizaron las 63 cuentas de práctica manteniendo sus identificadores y asignaciones. Se comprobó una ronda distinta de la inicial con 34 cargos en recepción y 249 actas esperadas. El PDF de registro único está junto a los Excel privados de la feria.

## Carga por partes de la fotografía

- Las solicitudes de 6,6–7 MB del túnel se cortaban antes de completarse. La copia reducida de OCR no resolvía el envío del original, que seguía viajando completo al registrar.
- `microservicios/actas/app/cargas.py` guarda la foto en partes temporales de 128 KiB, aisladas por organización y operador, con caducidad de una hora, reintento idempotente y límite de 1024 partes. La limpieza periódica corre junto a la bandeja de eventos.
- `PUT /api/v1/actas/cargas/{carga}` recibe cada parte. `NuevaActa` y `FotoParaLectura` aceptan `idCargaFoto` como alternativa exclusiva a `foto`; Actas reconstruye y valida la imagen antes de leerla o registrarla.
- `frontend/src/api/cargaFoto.js` divide el original en partes de 128 KiB, reintenta solo la parte interrumpida y muestra el progreso. El OCR usa la copia reducida; el registro sube el original una sola vez y GraphQL solo transporta `idCargaFoto`.
- Contrato `compartido/contratos/openapi/actas.openapi.json` y clasificación del mapa vivo actualizados (`Carga de fotografía por partes`).

## Verificación

- El túnel registró cargas de unos 6,6 MB interrumpidas. Chromium reprodujo el corte con una subida limitada a 120 000 bytes/s. La copia reducida de OCR dejó la lectura en unos 535 KB, pero el registro del original seguía fallando; por eso se añadió la carga por partes.
- Proyecto aislado `tuvoto-prueba-sectores-5b577a0e` (puerto 18891): recorrido completo de feria con tres actas nuevas por GraphQL, una corrección, una observada, resultados y eventos de RabbitMQ. El último paso de caos de auditoría no reinició el contenedor dentro del plazo y quedó pendiente; no afecta la carga.
- Foto de 6,23 MB con subida limitada a 120 000 bytes/s: el OCR real identificó mesa, cargo y cinco cifras; se enviaron 70 partes de hasta 128 KB; una parte se interrumpió y se repitió con los mismos bytes; GraphQL recibió 0,5 KB y la base conservó los 6 535 400 bytes originales.
- Con el motor de Actas aislado se cotejaron destino, votos de cada candidatura, blancos, nulos y total de las 251 hojas rasterizadas del juego inicial. La primera ejecución dejó tres incompletas. Tras la corrección coincidieron las 251. El PDF de registro único contiene las 249 hojas ordinarias y se contrastó su texto con el juego inicial.
- Pasaron 84 pruebas de frontend, 16 de mapa vivo y 41 de Actas (32 unitarias y 9 de persistencia efímera), además de la compilación Vite. La prueba de persistencia comprobó partes privadas, reintento idempotente, rechazo de partes alteradas y caducidad.
- Pendiente para el puesto de feria fotografiar una hoja impresa con el celular del visitante y comprobar el enfoque bajo la iluminación del puesto.
- Se reconstruyeron Actas, frontend y gateway GraphQL en el proyecto de feria y los tres servicios pasaron su comprobación de salud. El contrato servido por el portal incluye la ruta de carga por partes. Un segundo recorrido aislado recuperó los 3 570 140 bytes originales después de interrumpir y reintentar una parte.
- En `tuvoto` se comprobó el contrato servido, la ruta `PUT` de partes (401 sin sesión), el campo `idCargaFoto` en el esquema GraphQL y el paquete del frontend con partes de 131 072 caracteres. La prueba con una cuenta de operador por el túnel quedó pendiente porque las credenciales del Excel de práctica no autenticaron.
