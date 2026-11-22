# Base visual clara y catálogo electoral

- Responsable: Codex; siguiente responsable QA por asignar. Base observada `main@a5ee8e2`, árbol inicialmente limpio. Estado: `listo_para_qa` con sesión real; interacción sintética y despliegue verificados. Referencia: imagen de panel claro facilitada por el usuario el 2026-11-22.
- Alcance: solo frontend y adaptación de selectores de pruebas; sin cambios de servicios, contratos, permisos o datos. No se hizo commit/push/tag.

## Implementación

- `frontend/src/tema-claro.css`: base visual centralizada, importada después de los estilos privados existentes. Barra lateral blanca, selección azul, cabecera compacta, bordes suaves y superficies claras para administrador, operador y auditor. Fondo `#F3F7FC` compartido con acceso y portal público mediante `estilos.css`. Mantiene identidad TUVOTO, sesión y cierre de sesión visibles.
- `SeleccionAdministracion.jsx`: catálogo con título Cargos electorales, indicadores reales por familia, pestañas de grupo, búsqueda sin tildes por cargo/facultad/ámbito/carreras, estado y casilla Mostrar archivados. Filas alineadas con estado, vuelta, cantidades y acciones reales. Grupos grandes muestran tres filas y permiten expandir/contraer; Directores inicialmente plegado. Los archivados siguen accesibles mediante la casilla, sin borrar registros.
- Conserva los modales existentes de detalle y edición, selección del cargo, creación y confirmación de retirada. No inventa contadores ni fija los números de la imagen. Se adapta a tipos de cargo distintos de universidad mediante la agrupación existente.
- `api/seleccionAdministracion.js`: filtro puro sobre los datos autorizados de la institución, sin alterar sus IDs u objetos. `PanelPrivado.jsx`: Importar Excel y Crear cargo juntos en la cabecera; selector de institución como acceso a Resumen, sin crear otro flujo de organizaciones. La barra contextual se conserva en los demás módulos. El control institucional de conteo mantiene su alcance global.
- `ImportarExcel.jsx`: propiedad opcional `textoBoton` para abreviar únicamente el botón del catálogo; modalidad de revisión, confirmación, seguridad y endpoints sin cambios.
- Adaptación a móvil/tablet: navegación y pestañas desplazables, indicadores en dos columnas, acciones flexibles, tabla con desplazamiento horizontal interno. Las columnas no provocan desbordamiento de toda la página. Los permisos siguen comprobándose en backend.

## Verificación ejecutada

- `npm --prefix frontend run probar`: **65/65**. Regresión nueva de búsqueda sin tildes, filtros, recuperación de archivados y conservación del catálogo original.
- `npm --prefix frontend run compilar`: OK. `git diff --check` del alcance y sintaxis de la suite de integración adaptada: OK.
- `node frontend/pruebas/diseno-claro-interfaz.mjs`: Firefox ya instalado, sin nuevas dependencias. Renderiza PanelPrivado y sesión desde un fixture inequívocamente sintético, que intercepta todas las API y aborta rutas imprevistas; no contacta microservicios reales. Verifica 34 cargos sintéticos en cuatro grupos y un archivado adicional, búsqueda, grupo, estado y archivados, detalles y edición del cargo, entrada a crear e importar, y barra lateral blanca. Capturas a 390/768/1440 px sin errores JavaScript ni desbordamiento global. Verifica expansión/contracción de grupos grandes. Capturas `/tmp/tuvoto-diseno-claro-<ancho>.png`; log `/tmp/tuvoto-diseno-claro-navegador.log`. Capturas de escritorio y móvil inspeccionadas visualmente. No prueba nuevas escrituras persistentes.
- Despliegue autorizado de la actualización visual únicamente sobre **frontend**: **13 saludables**, otros **12 IDs** y todos los montajes conservados; fuentes estables durante la construcción y recursos servidos idénticos a compilación. [Evidencia](../despliegue-diseno-claro.json). Sin escrituras de prueba en bases de datos.

## Siguiente acción

Recargar `http://127.0.0.1:8890/#panel` con Ctrl+F5 y revisar Elección con sesión propia. El fondo claro se comparte con el resto del sistema; la referencia se aplicó a la estructura electoral sin sustituir los diseños de resultados ni las funciones operativas. Las cifras 1/1/12/20 del fixture son exclusivamente datos de prueba, nunca datos de las pantallas operativas.
