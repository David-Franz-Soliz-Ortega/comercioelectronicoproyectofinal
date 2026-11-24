# Operador, acta imprimible y presentación móvil

Fecha: 2026-11-24. Responsable: Codex. Siguiente responsable: QA de cámara, por asignar.
Estado: **listo_para_qa** de fotografía física; frontend y OCR sintético verificados en los recorridos detallados abajo.

## Alcance y continuidad

Se continuó desde `main`, `1e73b07`. Durante la tarea apareció el commit ajeno `85159ee` («Subido de actas para la prueba»), que incorporó el acta, el bloqueo de mesas y la primera parte de los cambios de operador/OCR. Se contrastó con código y diff y se conservó. Codex no ejecutó commit, push ni despliegue. El diff restante comprende principalmente el ajuste móvil, la prueba pública y esta documentación.

El usuario pidió una réplica ficticia imprimible, un acta independiente por cargo, conservar la edición de mesas bloqueando las ocupadas por otros operadores y mejorar la portada y el operador en celular. Indicó expresamente dejar el botón de cierre duplicado para retirarlo por su cuenta; se conservaron los controles de cierre.

## Cambios

- `frontend/public/ejemplos/acta-escrutinio-prueba.{html,pdf,png}`: formato sintético con estructura de tabla de la referencia y marca visible SIN VALIDEZ. PDF de una página A4; HTML con campos editables antes de imprimir. No contiene nombres, firmas ni resultados del documento real. El generador local está en `microservicios/actas/pruebas/generar_acta_impresa.mjs`; solo renderiza el HTML sintético.
- `EditarOperador`, `AsignacionesOperadores`, `api/operadores.js` y `administracion.css`: se conserva el formulario; mesas ajenas deshabilitadas, propias y libres editables, grupos que omiten ocupadas y asignaciones parciales reconocidas. Se comparan IDs físicos/lógicos, no códigos repetidos. Antes de guardar se vuelve a consultar disponibilidad. Los reintentos de alta parcial conservan la cuenta y los vínculos ya confirmados.
- `PanelPrivado.jsx` / `panel-sencillo.css`: foto independiente para cada destino, sin reutilizar la de otro cargo; contexto de mesa, cargo y sector visible; correcciones identificadas y recepción cerrada bloqueada. Cabecera móvil compacta, controles de cámara antes de la vista previa, foto ampliable dentro del ancho de pantalla, campos numéricos amplios y acciones táctiles. Diferencia entre carga, error y ausencia de asignaciones.
- `PortalPublico.jsx`, `ResultadosSectores.jsx` y `observatorio.css`: nombres y porcentajes separados en móvil, filtros adaptados al ancho, grupos de cargos desplegables sin comprimir facultades y tablas de unidades/sectores presentadas como filas apiladas sin arrastre lateral. Se reutiliza el marcado existente y se conserva la tabla de escritorio. Retirado el estilo de ayuda lateral que perdió su consumidor.
- `microservicios/actas/app/lectura.py`: reconoce etiquetas de totales del ejemplo; una segunda copia temporal con contraste alto recupera cifras perdidas entre líneas claras. Las discrepancias y filas repetidas siguen vacías; nunca rellena por aproximación y siempre requiere revisión humana. Ambas pasadas comparten el límite de 15 s. Sin contratos, migraciones ni permisos nuevos.
- `LECTURA.md` documenta impresión, lectura, límites y pruebas. `pruebas/Dockerfile` copia el PNG sintético para poder ejecutar la prueba de tabla dentro de la imagen; esa variante Docker quedó sin ejecutar.

## Verificaciones ejecutadas

Todas las pruebas de navegador sirvieron archivos locales con API sintética en memoria; no escribieron en servicios ni bases de datos del usuario.

| Comprobación | Resultado y alcance |
| --- | --- |
| `npm --prefix frontend run probar` | **76/76 pasaron**. Incluye ocupación, grupos físicos y códigos repetidos. |
| `npm --prefix frontend run compilar` | **Pasó**, Vite 7.1.7, 89 módulos. |
| `node frontend/pruebas/movil-publico-interfaz.mjs` | **Pasó** a 320, 360, 390, 430, 768, 1440 y 2560 px: nombres largos, cinco decanatos desplegados, filtros por unidad, todos los cargos, estados cero/vacío/error, reintento y acceso. Sectores comprobados a cinco tamaños. |
| `node frontend/pruebas/operador-lectura-interfaz.mjs` | **Pasó**: captura/carga, lectura asistida, error/reintento, revisión, creación, corrección con versión, foto separada y recepción cerrada; 320, 390, 768, 1024 y 1440 px. La propuesta OCR de este recorrido es un doble explícito. |
| `node frontend/pruebas/edicion-operadores-interfaz.mjs` | **Pasó** a 390, 768, 1440 y 2560 px: propias/libres/ocupadas, selección de grupo, cargos parciales, eliminación solo de vínculos propios, cambio de disponibilidad posterior a abrir y reintento sin duplicar cuenta. Se corrigió el recorrido para desplegar los grupos inicialmente cerrados del alta. |
| `python -B -m unittest test_lectura.LecturaReal test_formato_tabla -v` | **12/12 pasaron** con Tesseract real: formatos PNG/JPEG, EXIF, mesa diferente, archivo corrupto, blanco, baja confianza, filas repetidas, conflictos entre pasadas, sumas y límites. El nuevo ejemplo devuelve 120/80/3/2/205 y requiere revisión. |
| `pdfinfo frontend/public/ejemplos/acta-escrutinio-prueba.pdf` | **1 página, A4**. PDF/PNG revisados visualmente. |
| `git diff --check` | **Pasó**. |

OCR local: venv `/tmp/tuvoto-actas-qa`, Tesseract 5.5.4 y datos españoles extraídos bajo `/tmp/tuvoto-ocr-bin`; `PATH`, `LD_LIBRARY_PATH`, `TESSDATA_PREFIX` y `PYTHONPATH=microservicios/actas/pruebas` apuntaron a esas rutas. La instalación completa de dependencias de producción no fue posible con Python 3.14 del host por `psycopg-binary==3.2.9`; se instalaron solo las dependencias de lectura necesarias en el venv. No se alteraron requisitos de producción ni se ejecutaron pruebas SQL/HTTP integrales como parte de esta entrega.

Capturas locales revisadas: `/tmp/tuvoto-publico-movil-{390,1440}.png`, `/tmp/tuvoto-publico-sectores-{390,1440}.png`, `/tmp/tuvoto-operador-lectura-{390,1440}.png` y `/tmp/tuvoto-edicion-ocupadas-{390,1440}.png`. Son datos ficticios. Las capturas públicas finales vuelven arriba antes de capturar: el enlace accesible fijo fuera de pantalla podía aparecer dentro de una captura larga si el navegador conservaba desplazamiento; se comprobó que permanece fuera del viewport sin foco.

## Límites y siguiente acción

1. Imprimir el ejemplo y fotografiarlo con un celular; verificar enfoque, perspectiva, iluminación y selección de destino en una elección aislada. PNG renderizado/JPEG convertido y Chromium con anchos móviles no prueban una cámara física, Safari ni manuscritos. El original institucional no se publicó ni se usó como resultado.
2. La detección automática de mesa/cargo por nombres sigue pendiente. El operador selecciona el destino y compara todos los datos propuestos.
3. El bloqueo de ocupadas es del editor con relectura previa. No introduce exclusividad atómica en Elecciones: una carrera entre GET y POST o un cliente diferente requiere una regla de negocio y transacción específicas si se decide ampliar el alcance.
4. La [revisión anterior](revision-flujo-operador-avance.md) mantiene pendientes sus indicadores administrativos de avance/faltantes y la distinción entre 100 %, revisiones pendientes y cierre. No se cambiaron cálculos ni reglas de conteo con esta mejora visual.
5. No se actualizó ningún despliegue existente. Para servir estos recursos en un entorno desplegado hace falta reconstruir/actualizar frontend y, para el formato OCR nuevo, Actas bajo autorización de ese entorno.
