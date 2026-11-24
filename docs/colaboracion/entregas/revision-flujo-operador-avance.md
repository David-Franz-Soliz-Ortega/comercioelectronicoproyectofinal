# Revisión del operador y avance de actas

Fecha: 2026-11-24. Responsable: Codex. Siguiente responsable: desarrollo, por asignar. Estado: **requiere_correccion**.

Base observada: `main`, revisión `1e73b07`, árbol limpio al comenzar y después de la interrupción de sesión. Alcance solicitado: revisar el registro del operador, la fotografía, las mesas y el avance en administración y público. Esta entrega documenta hallazgos; no cambia código operativo, contratos, datos ni despliegues.

## Funcionamiento comprobado en código

- Mesas sigue activo en **Elección → Mesas de la elección**. Se verificó su ruta desde `principal.jsx`, `Aplicacion.jsx` y la carga diferida de `PanelPrivado.jsx`; el componente `MesasCompartidas` continúa montándose. Se retiró el apartado lateral independiente, no la configuración de mesas.
- Cada vínculo de mesa con cargo representa un acta esperada. Una mesa física con Rector, Vicerrector y Director tiene tres actas esperadas; una fotografía puede reutilizarse explícitamente entre cargos, pero sus conteos son independientes. Los totales dependen del catálogo configurado, no de fotos recibidas.
- El administrador configura cargos, candidatos, mesas y asignaciones; iniciar habilita recepción. El operador elige una de sus mesas/cargos, toma o sube una imagen, revisa cifras y confirma. La primera versión usa `registrarActa` por GraphQL; las siguientes usan `PUT /actas/mesas/:id`, conservando versiones anteriores.
- El lector recibe obligatoriamente `idMesa`. Busca nombres completos de las candidaturas de ese contexto, normaliza tildes/mayúsculas y propone cifras. Una mesa leída diferente rechaza la propuesta; sin código legible advierte al operador. No identifica ni cambia automáticamente el cargo o la mesa. La transcripción manual sigue disponible ante fallos de lectura.
- El conteo público utiliza una contribución vigente por mesa y cargo. En el consumidor, la clave es proceso + mesa y la actualización exige una versión superior; no suma cada fotografía o versión como una mesa adicional. Se revisó ese código, sin ejecutar mensajería real.

Referencias: [navegación](../../../frontend/src/api/navegacionAdministracion.js), [operador](../../../frontend/src/paginas/PanelPrivado.jsx), [lector](../../../microservicios/actas/app/lectura.py), [registro de versiones](../../../microservicios/actas/app/servidor.py), [consumidor](../../../microservicios/resultados/app/consumidor.py).

## Hallazgos y correcciones propuestas

1. **Alta: falta seguimiento del conteo en administración.** `ConteoInstitucion` recibe configuración y consulta asignaciones; no consulta resultados. Sus tarjetas y tabla muestran actas esperadas, pero no contabilizadas, pendientes de contabilizar ni avance. El listado llamado «actas pendientes» corresponde a asignaciones sin operador. Incorporar seguimiento por cargo y total institucional, con nombres distintos para pendientes de asignación y de conteo. Fuente: [ConteoInstitucion.jsx](../../../frontend/src/componentes/ConteoInstitucion.jsx) y [estadoInstitucion.js](../../../frontend/src/api/estadoInstitucion.js).
2. **Alta: el 100 % puede coexistir con una corrección pendiente.** Cuando una corrección queda observada, Actas conserva el aporte válido anterior. La proyección puede devolver `avance=100`, `pendientes=0`, `observadas=0` y `requierenRevision=1`. El portal solicita este último campo pero no lo muestra directamente. Si la regla de segunda vuelta está desactivada, tampoco aparece su aviso provisional. Mostrar revisiones pendientes aparte del porcentaje; no presentar 100 % contabilizado como ausencia de incidencias. Fuente: [proyeccion.py](../../../microservicios/resultados/app/proyeccion.py), [PortalPublico.jsx](../../../frontend/src/paginas/PortalPublico.jsx) y [ResultadosSectores.jsx](../../../frontend/src/componentes/ResultadosSectores.jsx).
3. **Media: «Finalizada» significa recepción cerrada, no conteo completo.** El cierre comprueba registros en curso, pero no exige todas las actas esperadas. La interfaz transforma `cerrada` en «Finalizada». Mostrar «Recepción cerrada» junto al avance real y advertir de faltantes al cerrar; una prohibición absoluta de cierre sería una decisión adicional de negocio. Fuente: [conteo-institucion.ts](../../../microservicios/elecciones/src/conteo-institucion.ts) y `ConteoInstitucion.jsx`.
4. **Media: alcance y terminología del avance público.** La barra es del cargo seleccionado y, si hay filtro, de esa unidad. No constituye el porcentaje de toda la elección. El texto visible habla de actas mientras la etiqueta accesible y la ayuda hablan de mesas. Unificar «actas contabilizadas del cargo» y, si se añade avance general, calcularlo con todos los cargos del evento correspondiente, sin promediar porcentajes ni mezclar vueltas o históricos.
5. **Mejora del operador, todavía no implementada:** foto → sugerencia de mesa/cargo entre sus asignaciones → confirmación del destino → propuesta de cifras → revisión y publicación. Los nombres de candidatos solos no identifican de forma única una mesa o un sector. Mantener selección manual cuando falten datos o existan coincidencias múltiples; el backend debe conservar la comprobación de asignación y recepción. El autollenado de cifras del cargo ya seleccionado existe, aunque su funcionamiento actual con cámara/formato institucional no se verificó en esta revisión.

## Criterios para el seguimiento

- Actas esperadas: vínculos configurados de mesa y cargo dentro del alcance elegido.
- Actas contabilizadas: vínculos con una contribución válida vigente en Resultados.
- Pendientes de contabilizar: esperadas menos contabilizadas. Una foto recibida u observada sin aporte válido no completa el vínculo.
- Avance: contabilizadas / esperadas × 100. Sin mesas configuradas, mostrar estado vacío, nunca 100 %.
- Mesas físicas completas: todas sus actas esperadas tienen contribución vigente; mostrar por separado sus incidencias. No se puede deducir este número únicamente de la suma de actas de todos los cargos. Requiere un contrato de estado por vínculo, sin exponer imágenes ni identificadores del operador.
- Revisiones pendientes: indicador independiente, también visible si existe una contribución válida anterior. El porcentaje mide cobertura del conteo, no autenticidad ni proclamación.

Ejemplo sintético: 10 mesas físicas con los mismos 3 cargos equivalen a 30 actas esperadas. Con 24 contabilizadas hay 6 pendientes y 80 % de avance; el número de mesas físicas completas depende de cuáles actas falten.

## Evidencia ejecutada y límites

| Comprobación | Resultado |
| --- | --- |
| Revisión desde la entrada de React hasta administración, operador, API de Actas y proyección de Resultados | **Pasó** la inspección; hallazgos anteriores confirmados en el código actual. No equivale a aprobación funcional integral. |
| Node: siete archivos de pruebas focalizadas con `--test-isolation=none --test-reporter=tap` | **Pasó: 27/27**. Estado institucional, mesas compartidas, resumen, consultas por cargo, creación de mesas, preparación y cliente de APIs. Log: `/tmp/tuvoto-revision-flujo-20261124-frontend-detalle.log`. |
| `python3 -B -m unittest discover -s microservicios/resultados/pruebas-tuvoto -p 'test_proyeccion.py' -v` | **Pasó: 3/3**. |
| Mismo comando con `test_sectores.py` | **Pasó: 7/7**. |
| `python3 -B -m unittest discover -s microservicios/actas/pruebas -p 'test_dominio.py' -v` | **Pasó: 4/4**. La prueba de foto valida bytes/firma; no acredita decodificación de una foto de cámara. |
| Caso sintético en memoria: una mesa contabilizada y corrección observada | **Pasó** la reproducción: `{esperadas: 1, contabilizadas: 1, pendientes: 0, avance: 100, observadas: 0, requierenRevision: 1}`. Archivo `/tmp/tuvoto-revision-flujo-20261124-revision.json`. |
| Consulta Docker de contenedores e imágenes | **Pasó** como inspección de lectura. No había contenedores TUVOTO en ejecución ni imágenes TUVOTO disponibles en el momento consultado. No se inspeccionaron datos privados. |
| OCR real y fotografía institucional/manuscrita | **no_ejecutado**: faltan Tesseract y FastAPI en el entorno disponible. La entrega histórica prueba un formato impreso sintético; no acredita fotos institucionales ni esta ejecución. |
| Navegador, compilación y publicación integral | **no_ejecutado**: sin `frontend/node_modules`, sin compilación local y sin servicios TUVOTO activos. No se instaló ni levantó otra plataforma para esta revisión. |

Las pruebas ejecutadas son puras o usan dobles de `fetch`; el caso adicional usa datos sintéticos en memoria. No hubo escrituras en servicios, puertos de prueba, conexiones a bases, montajes ni volúmenes. El primer comando Node con aislamiento predeterminado informó siete archivos; para acreditar los casos individuales se repitió con la opción del proyecto y se obtuvo 27/27. Total de pruebas de suite acreditadas: **41**, más la reproducción adicional.

Comando frontend reproducible desde la raíz:

```sh
node --test --test-isolation=none --test-reporter=tap frontend/pruebas/estado-institucion.test.mjs frontend/pruebas/mesas-compartidas.test.mjs frontend/pruebas/resumen-institucion.test.mjs frontend/pruebas/conteo-institucion.test.mjs frontend/pruebas/creacion-mesa.test.mjs frontend/pruebas/preparacion.test.mjs frontend/pruebas/tuvoto.test.mjs
```

## Siguiente acción

Desarrollo: incorporar avance y faltantes reales en Conteo y publicación, hacer visibles las revisiones y distinguir cierre de recepción de cobertura completa; después ampliar la sugerencia de mesa/cargo del operador. Mantener el catálogo de mesas y la confirmación humana. QA debe verificarlo con un formato de fotografía sintético representativo, correcciones y varios cargos/sectores, primero en almacenamiento aislado. Un despliegue sobre proyectos existentes requiere autorización; esta revisión no lo realiza. Sin commit, push ni tags.
