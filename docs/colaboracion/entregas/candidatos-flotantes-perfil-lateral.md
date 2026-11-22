# Candidatos en tarjetas y cuenta lateral

- Responsable: Codex; siguiente responsable QA por asignar. Base `main@a5ee8e2`, conservadas las modificaciones locales del diseño claro anterior. Estado: `listo_para_qa` con sesión real; pruebas de interfaz y despliegue verificados. Sin commit, push ni tags.

## Cambios

- `PanelPrivado.jsx` y `Sesion.jsx`: organización activa y cuenta del administrador trasladadas al pie del menú izquierdo. Organización abre Resumen para cambiarla; la cuenta despliega Cerrar sesión usando el handler existente. Eliminados selector y perfil superiores del administrador y el botón contextual duplicado. Ambos controles siguen accesibles en móvil. Los selectores de sesión de operador/auditor mantienen su comportamiento previo; no se cambian roles ni autorización.
- `CandidatosAdministracion.jsx` y `tema-claro.css`: disposición basada en la referencia facilitada: cuatro indicadores reales (candidaturas, cargos, fotos cargadas y pendientes), grupos, búsqueda, tipo de cargo, filtro Sin fotografía, expansión y tarjetas horizontales con foto privada/iniciales, nombre y acciones. Rectorado/Vicerrectorado abiertos inicialmente; otras familias plegadas. Las cifras provienen del catálogo autorizado, no de los números de la imagen. Filtrar pendientes no cambia los totales globales ni los objetos originales.
- Importar Excel y Agregar candidato en la cabecera. Alta en modal con el selector de cargos editables y el formulario real anterior. Retirados el editor duplicado de fotografías y la navegación intermedia por cargo para modificar una fotografía. No ofrece alta si no hay cargos en borrador disponibles.
- `EditarNombreCandidato.jsx` conserva su nombre de archivo por compatibilidad, pero ahora abre **un único modal de nombre y foto**, con vista previa, JPEG/PNG y límite de 2 MB. `api/editarCandidato.js` reutiliza PUT `/configuracion/candidatos/:id` y PUT `/configuracion/candidatos/:id/foto`, con sesión, organización y CSRF existentes. No es una transacción única: si se confirma el nombre y falla la foto, informa el avance y reintenta solo lo pendiente. Cancelar después de ese avance refresca el nombre realmente persistido; nunca lo presenta como revertido. No crea endpoints ni modifica servicios.
- Tres puntos abre únicamente la retirada del candidato, conservando la confirmación explícita existente. Editar/retirar disponibles solo en borrador, sin actual/publicado; los bloqueos del backend siguen siendo definitivos.
- Fotografías mediante `FotoCandidatoAdministracion` y lectura privada existente. No se exponen borradores al público ni se usan fotos ficticias en las pantallas operativas. Se mantiene la revisión para recargar la foto después del guardado.

## Pruebas y evidencia

- Frontend **68/68**, compilación Vite y `git diff --check` del alcance OK. Pruebas nuevas de fallo parcial nombre/foto, reintento sin repetir nombre, rechazo del nombre antes de enviar foto y filtro de fotografías sin alterar catálogo/totales.
- `node frontend/pruebas/candidatos-flotantes-interfaz.mjs`: Firefox instalado y todas las API interceptadas en fixture sintético. Verifica organización/cuenta a la izquierda, ausencia de controles superiores duplicados, fotos privadas realmente decodificadas, edición conjunta con error de foto y reintento, menú Eliminar con confirmación deshabilitada hasta aceptar, alta/Excel en modal y cierre de sesión desde el pie. Anchos 390/768/1440 sin desbordamientos ni errores JS. Capturas `/tmp/tuvoto-candidatos-flotantes-<ancho>.png`, inspeccionadas visualmente; log `/tmp/tuvoto-candidatos-tarjetas-navegador.log`. Los PUT del caso de prueba solo modifican objetos del fixture; no se hicieron escrituras HTTP contra datos reales.
- Corregidos estilos heredados que apilaban las acciones y ensanchaban tarjetas en móvil; la prueba comprueba dirección horizontal y ausencia de desbordamiento. Los HTML de los fixtures declaran UTF-8, igual que el index real, para no producir falsos iconos corruptos en las capturas.
- Adaptados los selectores afectados de las suites persistentes; sintaxis OK, sin ejecutarlas. No se afirma una nueva prueba integral con datos reales.
- Solo frontend actualizado en el proyecto existente: **13 contenedores saludables**, otros **12 IDs** y todos los montajes intactos, recursos servidos idénticos byte a byte a compilación. [Evidencia](../despliegue-candidatos-flotantes.json). Sin cambios de backend, contratos, esquemas, sesiones, permisos ni datos electorales.

## Siguiente acción

Ctrl+F5 → Candidatos. Probar una edición autorizada con la cuenta propia o ejecutar una nueva prueba persistente en un entorno aislado. La confirmación de retirada sigue siendo necesaria. El menú de la cuenta se abre para cerrar sesión; la organización se cambia desde su acceso lateral.
