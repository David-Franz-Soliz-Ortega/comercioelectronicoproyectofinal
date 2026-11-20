# Portal de eventos electorales

La portada pública presenta primero el evento destacado por el administrador. Dentro de cada evento, el catálogo ordena Rectorado, Vicerrectorado, Decanato, Dirección y después los demás cargos. La interfaz no inventa opciones si esos cargos no se han configurado y publicado.

## Preparar el contenido

1. Seleccionar una organización en el panel administrativo.
2. Crear un proceso por cargo. Para agruparlos, usar exactamente el mismo nombre de evento en la misma organización: por ejemplo, «Elecciones universitarias 2026», con cargos «Rectorado», «Vicerrectorado» y «Decanato · Tecnología». Un centro de estudiantes o una escuela puede tener su propio nombre de evento.
3. Registrar candidaturas y sus fotografías, mesas y unidades antes de asignar operadores. El nombre de candidatura es el texto que aparece grande; no se inventa un partido independiente cuando el modelo no lo tiene.
4. En Publicación, revisar y publicar cada cargo. «Publicar y destacar evento» decide cuál abre la portada y mantiene ese proceso como actual para la recepción de actas. Los demás cargos públicos siguen consultables. «Ocultar» los retira del catálogo.

Los eventos se agrupan por organización y nombre exacto. No hay todavía una entidad independiente con fechas, prioridad editorial o múltiples ciclos de un mismo nombre: conviene incluir el año/ciclo. Cambiar el nombre cambia la agrupación. La migración conserva público solo el proceso actual anterior; no expone borradores existentes.

## Lectura pública

- Tarjetas ordenadas por votos, con fotografía o iniciales cuando no hay foto. «Lidera el conteo» solo aparece si hay un primer lugar único con votos; los empates se muestran como empates. No se declara un ganador oficial.
- Porcentaje por candidato sobre votos válidos. Blancos y nulos aparecen por separado.
- Filtro de facultad/unidad que consulta los votos y recalcula el denominador para esa selección. Los botones de cada unidad llevan al mismo filtro.
- Actas contabilizadas: una contribución vigente por mesa; una corrección no suma otra mesa. Las observadas forman parte de las pendientes. El total de fotografías/versiones recibidas no se presenta como actas contabilizadas.
- Animación de urna, pausa persistente y movimiento reducido; imágenes de candidatos con carga diferida salvo las dos primeras. No se descargan el panel privado ni sus estilos hasta abrir su acceso.

## Alcance técnico

Elecciones incorpora una columna aditiva `publicado` y un catálogo público. Actas y Resultados consultan la publicación de cada proceso antes de servir sus agregados. GraphQL conserva `portal(unidad)` y añade `eventos` e `idProceso` opcional. Sus cachés se separan por proceso y unidad. No se comparten bases ni modelos internos.

La recepción de actas sigue restringida al proceso actual único y a las mesas asignadas. El cambio habilita múltiples cargos para consulta pública; la recepción simultánea de varios cargos es una evolución pendiente. El OCR también sigue pendiente: el operador transcribe y confirma las cantidades frente a la fotografía. Los originales y la identidad de operadores siguen fuera del portal público.

Desplegar juntos frontend, gateway y los servicios afectados. Un frontend nuevo contra un gateway anterior mostrará un error de consulta; no rellenará la pantalla con cifras ficticias. La columna nueva no exige borrar tablas ni volúmenes.

## Módulos necesarios

**Elecciones sí**: define evento/cargo, mesas, unidades y publicación. **Candidaturas sí como función**, ya integrada en Elecciones; no necesita un microservicio separado para este alcance. **Padrón individual no**: el portal informa resultados a partir de actas y no emite votos. Si luego se publica participación, necesitará cantidades agregadas de habilitados por mesa y estamento, con fuente verificable; no datos personales.

Mantener Identidad, Elecciones, Actas y Resultados. Antes de añadir microservicios, conviene modelar eventos independientes, separar estamentos y reglas de cómputo cuando corresponda, permitir recepción simultánea de cargos y incorporar revisión asistida de actas. Un OCR futuro debe proponer cifras para revisión humana, conservando original, versión, origen y trazabilidad.

## Verificación de este cambio

Pruebas de navegador con respuestas controladas: evento/cargo/unidad, fotografías, empates, cero votos, reintentos, datos inválidos, pausa, movimiento reducido, pestaña oculta, acceso privado y anchos de 320 a 1440 px. Capturas en `/tmp/tuvoto-observatorio-*`.

Pruebas del catálogo y TypeScript; gateway HTTP real con dobles de servicios; publicación HTTP con PostgreSQL efímero y un doble de Identidad; pruebas de Actas y Resultados. Estas comprobaciones no equivalen a una elección real ni a un despliegue integral con datos de producción.

## Preparación desde la interfaz

Cuando el catálogo está vacío, la portada incluye «Configurar un evento», que lleva al acceso del personal. Después de iniciar sesión como administrador, Resumen indica los datos pendientes para mostrar ese cargo: organización, evento, candidaturas, mesas y revisión de publicación. Las acciones abren el formulario correspondiente y no publican automáticamente.

«Añadir cargo a este evento» conserva el nombre exacto y el tipo de organización del evento seleccionado, y solicita el nuevo cargo. El formulario también permite elegir otro evento de la misma organización o crear uno nuevo. Así Rectorado y Vicerrectorado pueden compartir evento sin volver a escribir su nombre. La preparación de operadores y asignaciones sigue disponible para recibir actas; publicar el catálogo no añade votos.
