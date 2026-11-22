# Formularios en modal y operadores por institución

- Responsable: Codex. Siguiente responsable: QA por asignar. Estado: `listo_para_qa` con despliegue comprobado; falta recorrido con sesión real autorizado.
- Base observada: rama `main`, revisión `2c51ae2`. Conservados los cambios locales previos; no se cambió de rama ni se publicó Git.
- Alcance: únicamente frontend y selectores de pruebas afectados. No se modificaron servicios, contratos, permisos, Compose, datos ni volúmenes.

## Cambios

- `ModalFormulario.jsx`: diálogo nativo accesible, cierre por botón/fondo/Escape, cierre bloqueado durante escrituras y restauración del foco.
- `ImportarExcel.jsx`: todas las instancias pasan a botón y modal; conserva plantilla, revisión, resolución de conflictos y confirmación del servidor. Cancelar desmonta el archivo y borra contenido y revisión, incluidas contraseñas importadas. El éxito cierra el formulario y conserva la confirmación global.
- `MesasCompartidas.jsx`: Crear mesa abre el formulario único en modal, conservando uno o varios cargos y adaptación de unidades/sectores. Un error permanece visible dentro del diálogo.
- `AsignacionesOperadores.jsx`, `EditarOperador.jsx`, `api/operadores.js` y `PanelPrivado.jsx`: lista institucional primero, seguida de botones Crear operador e importaciones de operadores/asignaciones. Se eliminaron el panel Asignar responsables, la tabla duplicada y el formulario separado de creación. La institución es la seleccionada, sin selector en el alta. Se puede crear sin mesa (Pendiente de asignación), o elegir varias actas por cargo. Editar mesas permite completar asignaciones en borrador; conserva las existentes.
- Reutiliza POST `/usuarios` (respuesta real `idUsuario`) y POST `/configuracion/mesas/:id/asignar`. No existe endpoint de retirada de asignaciones; no se simula esa operación. El backend sigue validando organización, operador y estado.
- Identidad y elecciones no comparten transacción: si el alta termina y falla una asignación, la cuenta se conserva, se informa el avance y el reintento reutiliza su UUID y omite los envíos ya confirmados. Una respuesta incierta de creación exige consultar el listado antes de repetir, como indica el cliente REST existente.
- Estilos adaptables en `administracion.css`. Nuevas pruebas `operadores.test.mjs`, `formularios-interfaz.mjs` y su fixture exclusivamente sintético. Actualizados selectores afectados de las suites persistentes sin ejecutarlas.

## Verificación ejecutada

- `npm --prefix frontend run probar`: **57/57**. Regresiones de selección de borradores, creación sin asignaciones y fallo parcial con reintento.
- `npm --prefix frontend run compilar`: OK.
- `node frontend/pruebas/formularios-interfaz.mjs`: Firefox instalado, API completamente interceptada con respuestas sintéticas, sin peticiones a microservicios. Alta con fallo de asignación y reintento sin duplicar cuenta, alta sin mesa, edición de asignaciones, creación de mesa, revisión/confirmación Excel, cancelación que elimina archivo/revisión y restauración de foco. Anchos 390/768/1440 sin desbordamientos ni errores JavaScript. Log `/tmp/tuvoto-formularios-navegador.log`; capturas `/tmp/tuvoto-formularios-<ancho>.png`. Requiere compilación previa y permiso local de servidor/navegador; no instala dependencias.
- Sintaxis de las dos suites de integración adaptadas: OK. No ejecutadas contra bases de datos.
- `git diff --check -- frontend pruebas/ampliacion/probar-interfaz.mjs`: OK. La comprobación no atribuye cambios anteriores ajenos a esta tarea.
- Despliegue autorizado únicamente de frontend: **13 saludables**, otros 12 IDs y todos los montajes conservados, fuentes sin cambios concurrentes durante la construcción y recursos servidos idénticos a compilación. [Evidencia](../despliegue-formularios-operadores.json). Sin migraciones ni escrituras de prueba en bases de datos.

## Siguiente acción

Recargar `http://127.0.0.1:8890` con Ctrl+F5 y revisar las pantallas con sesión autorizada. La prueba de navegador anterior demuestra comportamiento de React con API sintética; no acredita una nueva escritura persistente real. Retirar o reasignar eliminando una asignación requiere un contrato backend adicional, fuera de esta tarea. Sin commit, push ni tags.
