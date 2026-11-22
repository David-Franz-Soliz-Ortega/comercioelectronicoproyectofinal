# Operadores según referencia visual

Fecha: 2026-11-22. Responsable: Codex; QA por asignar. Base: main, a5ee8e2, con cambios locales anteriores conservados. Estado: listo_para_qa visual; despliegue verificado.

## Cambios

- AsignacionesOperadores.jsx: cabecera institucional con Crear operador y menú Importar Excel (operadores con mesa opcional o asignaciones existentes), filtros y tabla compacta de cinco columnas. Mesas físicas desplegables por operador, número de cargos separado, estados derivados de cuenta/asignaciones y acciones en la misma fila. Paginación local 10/25/50, anterior/siguiente y rango. Se mantiene el alcance institucional del endpoint, la visualización de cuentas históricas no disponibles y las restricciones de asignación para cuentas activas con rol OPERADOR sin rol administrativo. La revocación conserva confirmación y endpoint existentes.
- Clientes y modelos: listarOperadoresInstitucion en api/operadores.js reutiliza las cuentas y asignaciones reales; indexa mesas por usuario, filtra por consulta/usuario/pendientes y ordena pendientes primero. Sin APIs nuevas ni reglas de negocio de backend. agruparMesasFisicas conserva la diferencia entre mesas y cargos.
- PanelPrivado pasa el estado ocupado e institución, y evita contexto institucional duplicado sobre Asignar operadores. Estilos en tema-claro.css; retirados estilos reemplazados del listado anterior en administracion.css. Se conservan EditarOperador e ImportarExcel existentes, sin formularios paralelos ni nuevas dependencias.

## Verificaciones ejecutadas

- npm --prefix frontend run probar: 68/68, incluida cobertura de alcance institucional, pendientes, búsqueda sin acentos, datos históricos y conservación de entradas.
- npm --prefix frontend run compilar: OK.
- Firefox con API sintética en diseno-claro-interfaz.mjs: doce operadores ficticios, paginación 10/2 y 25, cuenta inactiva bloqueada, filtro sin mesa, búsqueda vacía/sin coincidencias, selector de usuario, despliegue de dos mesas, conservación de asignaciones en modal, alta y ambas importaciones en modal. Error HTTP 503 de asignaciones y Reintentar recupera el listado. También se verifica regresión del catálogo y Mesas. Anchos 390/768/1440/2560, sin desbordamiento global. Todas las solicitudes GET; no se creó ni revocó ninguna cuenta real. Capturas /tmp/tuvoto-operadores-referencia-ANCHO.png y /tmp/tuvoto-operadores-referencia-lista.png.
- git diff --check: OK.

## Límites y siguiente acción

El usuario autorizó posteriormente actualizar únicamente frontend. Se ejecutaron build y up --no-deps sobre ese servicio: trece contenedores saludables, otros doce conservan IDs y todos los montajes permanecen idénticos. Recursos servidos en http://127.0.0.1:8890 coinciden byte a byte con la compilación; comprobados los controles y estilos de Operadores. [Evidencia](../despliegue-operadores-referencia.json). Sin migraciones, cambios de credenciales ni escrituras de prueba en bases de datos. Pruebas sintéticas no acreditan persistencia nueva en APIs reales. Siguiente acción: Ctrl+F5 y revisar Asignar operadores con la sesión del usuario. Sin commit, push ni tags.
