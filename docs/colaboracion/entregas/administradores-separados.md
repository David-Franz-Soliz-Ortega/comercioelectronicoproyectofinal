# Administradores separados de operadores

- Responsable: Codex; siguiente responsable QA por asignar. Base observada: `main@3dcdf5b`, cambios locales conservados. Estado: `listo_para_qa` visual con sesión real; código y despliegue verificados.
- Solicitud expresa: Usuarios es exclusivamente para administrar administradores. La lección histórica de mostrar todos los roles en esa pantalla deja de ser el comportamiento esperado; se conserva la carga independiente del catálogo electoral.
- `frontend/src/componentes/ListadoCuentas.jsx`: filtra únicamente su presentación por presencia real de ADMINISTRADOR. Conserva administradores inactivos, cuentas con varios roles y control de cuenta actual. No modifica la colección compartida ni llama al backend para cambiar roles.
- `PanelPrivado.jsx`: título Administradores del sistema, descripción y botón Crear administrador. La lista institucional de operadores y sus asignaciones no cambia.
- `frontend/pruebas/listado-cuentas.test.mjs`: regresión para excluir operadores/auditores, mostrar administradores sin institución seleccionada, mantener cuentas mixtas e inactivas y conservar estados de carga/error y controles de revocación.
- Verificación: frontend **62/62**, Vite y diff del alcance OK. Misma actualización autorizada de frontend junto con elecciones: [evidencia](../despliegue-conteo-institucion.json); 13 saludables, otros 11 IDs y montajes conservados, recursos servidos coincidentes. Sin cambios de identidad, cuentas, roles, credenciales ni sesiones. No se usó una sesión real para una nueva prueba visual del listado.
- Siguiente acción: Ctrl+F5 → Usuarios para comprobar con sesión autorizada. Los operadores se consultan y editan en Asignar operadores. No se hizo commit, push ni tag.
