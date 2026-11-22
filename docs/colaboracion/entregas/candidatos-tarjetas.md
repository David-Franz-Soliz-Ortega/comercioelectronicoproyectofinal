# Candidatos en tarjetas

- **Objetivo:** candidatos de cada cargo en tarjetas distribuidas en columnas para escritorio y una columna para móviles.
- **Responsable:** Codex; siguiente responsable por asignar. **Estado:** verificado para presentación y despliegue.
- **Base:** `main`, revisión `2c51ae2`; cambios anteriores conservados, incluida [la entrega de modales](entregas/confirmaciones-modales.md).
- **Cambio:** únicamente `frontend/src/administracion.css` para esta tarea: rejilla autoajustable en `.nombres-candidatos-cargo`, tarjetas centradas, fotografías/iniciales de 88 px y acciones alineadas; una columna hasta 600 px. Se mantienen componentes, contratos y confirmación previa de eliminación. No se modificaron servicios, permisos ni datos.
- **Verificación:** frontend 46/46 y compilación OK; `git diff --check -- frontend` OK. Firefox existente con HTML generado desde el componente real CandidatosAdministracion, CSS compilado y candidatos explícitamente sintéticos: comprobados 320/390/600/768/1024/1440 px, dos tarjetas de Rector y tres de Vicerrector en columnas visibles en escritorio, una columna móvil, cinco botones de eliminación conservados, sin desbordamientos ni errores JavaScript. Sin consultas a APIs ni escrituras. Verificación temporal: `/tmp/probar-tarjetas-candidatos.mjs`, fixture `/tmp/tuvoto-candidatos-tarjetas.html`, capturas `/tmp/tuvoto-candidatos-tarjetas-<ancho>.png`; log unitario `/tmp/tuvoto-pruebas-candidatos-tarjetas.log`. No se añadieron tests permanentes para un ajuste puramente visual.
- **Despliegue:** actualizado únicamente frontend; recursos servidos idénticos a compilación, trece contenedores saludables, otros doce con IDs originales y montajes conservados. [Evidencia](despliegue-tarjetas-candidatos.json). Sin migraciones ni escrituras en BD; sin commit, push ni tags.
- **Siguiente acción:** recargar con Ctrl+F5. La prueba visual usó datos sintéticos y no acredita una carga nueva de fotos privadas; ese mecanismo no se modificó.

