# Limpieza y separación de paneles

Fecha: 2026-11-22. Responsable: Codex; siguiente responsable QA por asignar.
Estado: listo_para_qa visual; despliegue verificado. Base observada: main, a5ee8e2; no se cambió de rama ni se publicó Git. Conservados los cambios locales anteriores de diseño, candidatos, sesión, importación y pruebas.

## Cambios

- Causa comprobada del fallo: cuadrícula exterior de cargos con columnas de 300 px, combinada con dos columnas interiores de candidatos. Un cargo ocupa ahora una fila completa; sus candidatos conservan dos columnas en escritorio y una en pantallas menores. Separación mediante divisores, fondo común y sombras reutilizables en paneles y tarjetas.
- CamposCargo comparte los campos de alta/edición entre PanelPrivado y SeleccionAdministracion. datosEleccionVacia/datosDeProceso y los nombres de roles/estados se centralizan en API. Alta de cargo y alta de administrador abren ModalFormulario; el catálogo permanece detrás. Se conserva el bloqueo durante el guardado. Los modales de candidatos y operadores ya existían y se conservaron.
- Eliminados únicamente los módulos sin ruta de uso: EstadoPublicacion.jsx, GuiaEleccion.jsx y api/mesasPorUnidad.js; retirada su prueba obsoleta y las funciones de selección de eventos sin consumidores. Retirados estilos de guía sin referencias.
- Los otros ocho módulos API señalados por la revisión sí tienen consumidores: se conservan. completarNombreEleccion ya era compartida. agruparMesasFisicas/listarMesasInstitucion ya centralizan las agrupaciones; los resúmenes de operadores disponibles y operadores asignados representan métricas diferentes.
- AGENTS.md incorpora reglas de reutilización y comprobación de referencias. La regresión de importaciones recorre módulos estáticos y lazy imports literales desde principal.jsx; no considera pruebas como uso operativo.

## Verificación ejecutada

- npm --prefix frontend run probar: 67/67.
- npm --prefix frontend run compilar: OK.
- node frontend/pruebas/candidatos-flotantes-interfaz.mjs: Firefox, API sintética, fotos decodificadas, edición nombre/foto con fallo parcial y reintento, menú de eliminación sin DELETE, alta/Excel, logout y anchos 390/768/1440/2560. Decanos desplegados con varios candidatos: comprobados ancho de cargos y ancho legible de nombres, sin desbordamiento. Capturas en /tmp/tuvoto-candidatos-flotantes-ANCHO.png.
- node frontend/pruebas/diseno-claro-interfaz.mjs: filtros y grupos, detalle/edición, alta de cargo en modal conservando catálogo, Excel y alta de administrador en modal; tres tamaños. Sin escrituras ni APIs reales.
- git diff --check: OK.

## Límites y siguiente acción

Sin Docker, escrituras en bases de datos, cambios de backend, credenciales ni volúmenes. No se afirma persistencia nueva contra APIs reales a partir de pruebas sintéticas. Frontend actualizado con autorización posterior explícita: construcción y recreación únicamente de frontend, con --no-deps. Trece contenedores saludables; los otros doce conservan sus IDs y todos los montajes permanecen idénticos. Index y recursos servidos por http://127.0.0.1:8890 coinciden byte a byte con la compilación local, incluidos la cuadrícula corregida, sombras y campos compartidos. [Evidencia de despliegue](../despliegue-limpieza-paneles.json). No se hicieron escrituras de prueba ni migraciones. Siguiente acción: recargar con Ctrl+F5 y revisar los paneles con la sesión del usuario. No ejecutar las suites históricas con escrituras en el entorno existente.
