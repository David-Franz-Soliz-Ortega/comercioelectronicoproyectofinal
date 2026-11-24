# Panel sencillo y lectura asistida de actas

Fecha: 2026-11-23. Responsable: Codex. Siguiente responsable: por asignar. Estado: **verificado** para el panel y la lectura del formato impreso de prueba; validación de documentos institucionales y manuscritos pendiente.

Referencia observada al comenzar: rama `main`, revisión `bbcf627`, árbol limpio. El usuario autorizó continuar localmente y prohibió publicar en Git: no se hicieron commits, push ni cambios de rama.

## Entrega

- Administración agrupada en Resumen, Elección, Equipo y Conteo y publicación. Mesas deja de ser un apartado lateral y permanece dentro de Elección para conservar asignaciones y denominadores. Continúan cargos, candidatos, administradores, operadores, importaciones, pendientes y ciclo de conteo existentes.
- Portada con animación continua y sin control de pausa ni preferencia local antigua. Se conserva el movimiento reducido del sistema.
- Operador con tres pasos, lectura al seleccionar foto, cifras editables, ampliación de original y confirmación obligatoria. Lo no leído queda vacío. Cambiar cifras invalida la confirmación; nuevas fotos y cambios de mesa cancelan respuestas anteriores. Reutilizar una foto de otro cargo continúa con transcripción manual explícita.
- Nuevo `POST /api/v1/actas/lectura`: autorización/CSRF del operador, asignación por gRPC y recepción abierta; Tesseract español local, sin escrituras en bases ni eventos. No concede publicación al administrador. Imagen limitada, procesos acotados, timeout y temporales eliminados.
- Acta sintética descargable, marcada SIN VALIDEZ, sin publicarla como resultado. Ver [instrucciones y límites](../../../microservicios/actas/pruebas/LECTURA.md).

Archivos principales: `frontend/src/paginas/{PanelPrivado,PortalPublico}.jsx`, `api/navegacionAdministracion.js`, `panel-sencillo.css`, `componentes/Sesion.jsx`; `microservicios/actas/app/{lectura,servidor}.py`, Dockerfile y dependencias; contrato `compartido/contratos/openapi/actas.openapi.json`. No hay migraciones nuevas ni cambios al conteo persistido.

## Evidencia ejecutada

| Comprobación | Resultado y alcance |
| --- | --- |
| `npm run probar --prefix frontend` | **Pasó: 74/74**. Log `/tmp/tuvoto-panel-pruebas.log`. Se corrigieron tres raíces Vite que usaban `.pathname` y fallaban con espacios; ahora usan `fileURLToPath`. |
| `npm run compilar --prefix frontend` | **Pasó**; frontend y Actas también compilados en Docker. Log `/tmp/tuvoto-panel-compilacion.log`. |
| `frontend/pruebas/diseno-claro-interfaz.mjs` | **Pasó** con Chromium instalado: 34 cargos sintéticos, navegación, filtros, modales, mesas integradas y operadores a cuatro anchos. Log `/tmp/tuvoto-panel-interfaz.log`; capturas `/tmp/tuvoto-diseno-claro-390.png` y `-1440.png`. |
| Mismo ejecutor con `--pendientes-inicio` | **Pasó**: pendientes exactos, fallo/reintento y asignación sintética, sin inicio/cierre real. Tres tamaños. |
| `frontend/pruebas/operador-lectura-interfaz.mjs` | **Pasó**: animación y movimiento reducido; autollenado, lectura parcial/error, revisión humana, publicación interceptada, ampliación de foto y cancelación de respuestas antiguas. Cinco anchos de 320 a 1440 px. Capturas `/tmp/tuvoto-operador-lectura-390.png` y `-1440.png`. APIs interceptadas: no acredita publicación integral en servicios reales. |
| Suite Actas en imagen `tuvoto-actas-lectura-pruebas` | **17 pasaron, 7 SQL omitidas** de 24 descubiertas. Incluye 9 pruebas nuevas de OCR real/HTTP: dos PNG con cifras distintas, JPEG/EXIF, imagen en blanco, corrupta, mesa distinta, ambiguos, suma discrepante, concurrencia y fronteras de permisos. Log `/tmp/tuvoto-lectura-pruebas.log`. |
| Aislamiento de Actas | Contenedor `--network none`, raíz de solo lectura, sin puertos/volúmenes/credenciales; `/tmp` tmpfs de 160 MB, 768 MB de memoria, dos CPU, 96 procesos y sin capacidades. HTTP TestClient sin lifespan y persistencia prohibida por el test. |
| Versión local | Frontend y Actas actualizados con `up -d --no-deps`; los otros 11 contenedores conservan sus IDs. 13 saludables. JS servido y ejemplo idénticos a la compilación; contrato nuevo disponible y lectura sin sesión rechazada con 401. Tesseract instalado con `spa`. Evidencia `/tmp/tuvoto-panel-verificacion-local.json`. |
| Diff | `git diff --check` sin errores. |

Los fallos iniciales de la prueba visual correspondían a Firefox ausente y selectores antiguos (Cerrar/Cancelar, enlace a operadores y casillas ya editables). Se usó Chromium existente y se ajustaron a los controles activos; se repitieron ambos recorridos hasta pasar. Las capturas desactivan transiciones para representar el estado final.

## Límites y siguiente paso

No se ejecutaron las siete pruebas SQL ni se registró ninguna acta de prueba en servicios reales. No cambió la persistencia; los ensayos de escritura del navegador están interceptados. La suite histórica `observatorio.mjs` solo recibió el ajuste de expectativas de animación; no se acredita su recorrido completo, que conserva selectores de pantallas anteriores.

El OCR entregado es lectura asistida de texto y números impresos del formato descrito, no certificación de autenticidad ni soporte probado para manuscritos. Siguiente paso: acordar un formato institucional y preparar un conjunto anonimizado/sintético de fotos tomadas con cámara; medir campos correctos, errores y rechazos antes de ampliar los formatos admitidos. No introducir esos ensayos como resultados electorales.
