# Usuarios sin institución

- **Objetivo:** mostrar las cuentas autorizadas en Usuarios sin seleccionar primero una institución.
- **Responsable:** Codex; siguiente responsable: QA por asignar. **Estado:** listo_para_qa.
- **Base observada:** rama `main`, revisión `2c51ae2`; sin commit ni despliegue. Cambios previos de `.gitignore`, AGENTS.md y las guías conservados.
- **Causa:** la tabla filtraba exclusivamente ADMINISTRADOR y la carga de cuentas compartía `Promise.all` con la configuración electoral; un fallo electoral impedía actualizar las cuentas.
- **Cambios:** `frontend/src/paginas/PanelPrivado.jsx` separa las cargas; `frontend/src/componentes/ListadoCuentas.jsx` muestra todos los usuarios devueltos por identidad con roles, instituciones, carga, error y vacío. Conserva las autorizaciones y la revocación administrativa existentes. Sin contratos ni migraciones.
- **Pruebas:** `npm --prefix frontend run probar`: 48/48; incluye renderizado SSR de cuentas sintéticas sin institución seleccionada, roles, cuenta actual y estados de error/carga/vacío. `npm --prefix frontend run compilar`: OK. `git diff --check` de los archivos de esta tarea: OK; el global advierte una línea vacía previa al final de `.gitignore`, sin corregir por ser cambio ajeno.
- **Pendiente:** QA en navegador contra backend real y comprobar recursos servidos; no se ejecutó Docker ni se modificaron datos. Actualizar el contenedor frontend existente requiere autorización.
- **Siguiente acción:** verificar login → Usuarios antes de seleccionar institución en un entorno autorizado, incluida separación de organizaciones. Los tests de presentación no acreditan por sí solos ese recorrido real.

