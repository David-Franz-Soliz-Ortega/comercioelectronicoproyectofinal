# Lecciones verificadas de TUVOTO

Registrar solo casos demostrados. Cada entrada identifica la decisión que conviene conservar y dónde comprobarla; las evidencias históricas no sustituyen una ejecución nueva.

## Versión del frontend

Una modificación local de React puede no estar en la imagen servida. Antes de atribuirlo a CSS o caché del navegador, comparar el recurso servido por NGINX con la compilación y revisar el [Dockerfile](../../frontend/Dockerfile). Comprobar después los recursos efectivamente servidos. La compilación, la salud y el despliegue son comprobaciones diferentes. En Node/TypeScript, comparar la imagen con los módulos de fuentes vigentes o con una compilación temporal limpia: `dist` puede conservar archivos retirados que `tsc` no elimina. El verificador de [operadores y mesas](entregas/importacion-operadores-mesa.md) detectó ese caso; no borrar cambios locales para resolver una comparación.

## Fotografías de candidatos

Los borradores necesitan lectura privada con sesión y organización. Ver [cliente de fotografías](../../frontend/src/api/fotografiasCandidatos.js) y [componente administrativo](../../frontend/src/componentes/FotoCandidatoAdministracion.jsx). Una foto cargada debe decodificarse en el navegador; un HTTP 200 por sí solo no lo demuestra. Las iniciales identifican ausencia de foto y el error de carga debe distinguirse de esa ausencia.

## Mesa física y actas por cargo

Una mesa física puede tener varios cargos; sus actas y resultados conservan identificadores independientes. No agrupar registros históricos solo porque coincida el texto del código, ni mezclar docentes y estudiantes. Comprobar [mesas compartidas](../../microservicios/elecciones/src/mesas-compartidas.ts) y su [prueba real aislada](../../microservicios/elecciones/pruebas/probar-mesas-compartidas.py).

Los contadores por facultad se calculan después de agrupar por ID físico, conservando mesas individuales no vinculadas y sectores distintos. Usar la facultad explícita de los cargos asociados o, si falta, la unidad registrada; no deducir una facultad por el nombre de una carrera. Ver [la prueba de contadores](../../frontend/pruebas/mesas-compartidas.test.mjs).

## Esperas en pruebas del navegador

La presencia de un contenedor del listado no implica que sus opciones hayan terminado de cargar. Tras recargar o guardar, esperar el elemento de destino disponible o la confirmación de persistencia, en lugar de usar una pausa fija como garantía. Ver el recorrido de [interfaz](../../pruebas/ampliacion/probar-interfaz.mjs).

## Evidencia y bloqueos

Un nombre de proyecto distinto no garantiza aislamiento; comprobar conexiones y almacenamiento antes de escribir. Un comando preparado, una aprobación o un intento rechazado no prueban ejecución. Registrar la etapa y el diagnóstico seguro, dejar lo no ejecutado pendiente y revalidarlo antes de cerrar la tarea.

## Listados de cuentas independientes del catálogo y separados por función

La carga de cuentas debe ser independiente de los procesos electorales para que un fallo de catálogo no oculte administradores. Por petición posterior del usuario, el apartado Usuarios se dedica a **administradores** y filtra exclusivamente cuentas que realmente tengan ADMINISTRADOR; operadores permanecen en Asignar operadores. No filtrar la colección compartida recibida de identidad: otros apartados la necesitan completa. Una cuenta con varios roles sigue siendo administrativa si tiene ese rol real. El filtro de pantalla no concede ni revoca permisos del backend. Ver [ListadoCuentas.jsx](../../frontend/src/componentes/ListadoCuentas.jsx), su [prueba](../../frontend/pruebas/listado-cuentas.test.mjs) y la [entrega actual](entregas/administradores-separados.md). La entrega histórica de Usuarios documenta el comportamiento anterior.

## Cargo abierto y selección de portada

El cargo abierto para gestionar no equivale a los cargos que el administrador desea destacar al público. Mantener una selección persistida independiente; no deducirla del último cargo consultado ni publicar un borrador al seleccionarlo. Ver [portada.ts](../../microservicios/elecciones/src/portada.ts) y las [pruebas de modelo](../../microservicios/elecciones/pruebas/modelo-importacion.test.mjs): en PostgreSQL efímero se verificaron guardado múltiple, concurrencia, rechazo de cargos ajenos y conservación del estado y de la publicación. La verificación del navegador queda pendiente en la entrega.

## Confirmaciones que sobreviven al formulario

Emitir el éxito después de la respuesta de la API y mostrarlo en un componente global evita perder el aviso cuando se cierra o recarga el formulario. No convertir las confirmaciones previas, errores o estados de carga en éxitos. Al desmontar un diálogo, restaurar explícitamente el foco si el control anterior aún existe: la prueba real de Firefox detectó que cerrar un diálogo ya retirado no lo restauraba automáticamente. Ver [ConfirmacionGlobal.jsx](../../frontend/src/componentes/ConfirmacionGlobal.jsx) y [modal-interfaz.mjs](../../frontend/pruebas/modal-interfaz.mjs), probada a tres tamaños con datos sintéticos y sin escrituras en servicios.
