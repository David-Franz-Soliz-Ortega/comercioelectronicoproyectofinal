# Resumen sin guía

- **Objetivo:** simplificar Resumen y retirar completamente la guía paso a paso.
- **Responsable:** Codex; siguiente responsable: QA por asignar. **Estado:** listo_para_qa.
- **Base observada:** `main`, revisión `2c51ae2`; conservada la [corrección anterior de Usuarios](entregas/usuarios-sin-institucion.md) y los cambios locales ajenos.
- **Cambios:** eliminado el bloque «¿Qué necesitas hacer?» y su contexto repetido de cargo en `ResumenAdministracion.jsx`; retirados selector, preferencia local, renderizado y cálculo de pasos de `PanelPrivado.jsx`. Eliminados `PasosEleccion.jsx`, `pasosEleccion.js`, sus pruebas exclusivas y estilos sin uso. Se mantienen indicadores, vista previa, formularios, menú y comprobaciones de preparación de apertura. La navegación interna utiliza nombres de apartados.
- **Pruebas:** `npm --prefix frontend run probar`: 43/43. La reducción desde 48 corresponde a pruebas exclusivas de la guía retirada. `npm --prefix frontend run compilar`: OK (69 módulos). `node --check pruebas/ampliacion/probar-interfaz.mjs`: OK; recorrido adaptado al menú lateral, sin ejecución contra servicios. `git diff --check -- frontend pruebas/ampliacion/probar-interfaz.mjs`: OK. El test SSR evita la exploración de dependencias en segundo plano al cerrar Vite. Evidencia local: `/tmp/tuvoto-pruebas-sin-guia.log`.
- **Pendiente:** QA visual y despliegue del frontend, ambos sin ejecutar. No se modificaron backend, contratos, datos ni contenedores. Continúa pendiente comprobar Usuarios contra backend real. El aviso previo de `.gitignore` permanece sin tocar.
- **Siguiente acción:** con autorización, actualizar solo frontend y comprobar Resumen, menú lateral y formularios en escritorio y móvil.

