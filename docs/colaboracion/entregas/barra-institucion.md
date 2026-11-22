# Barra de institución estable

- **Objetivo:** dejar únicamente Cambiar institución en la barra de contexto. Responsable Codex; base main@2c51ae2; cambios locales conservados.
- **Causa comprobada:** `mostrarAccionesCargo` añadía Elegir cargo existente y Crear nuevo cargo según pestaña y estados de creación/edición. Se retiraron esos dos accesos y su condición de PanelPrivado.jsx. Cambiar institución conserva su acción y las reglas de carga. Crear/seleccionar cargos siguen disponibles en Elección; no se agregaron barras a Resumen o Usuarios.
- **Pruebas:** frontend 54/54, compilación y diff de archivos de tarea OK. Recorrido probar-interfaz.mjs adaptado a la única acción y a gestionar cargos desde Elección; sintaxis OK, no ejecutado contra servicios ni datos reales. No se añadieron tests permanentes para esta eliminación visual.
- **Despliegue verificado:** solamente frontend actualizado. Recursos servidos idénticos a compilación, accesos retirados ausentes del JavaScript y acción Cambiar institución presente. Trece contenedores saludables, los otros doce con IDs originales y montajes conservados. [Evidencia](../despliegue-barra-institucion.json). Sin cambios de backend, permisos, contratos o datos, sin commit/push/tags.

- **Siguiente acción:** Ctrl+F5 y navegar por los módulos; la barra mantiene un solo botón. La suite de escrituras queda pendiente para un entorno aislado.
