# Entrega: Asignación directa de actas pendientes y depuración de cabecera en Estado y publicación

- **Fecha:** 2026-11-22
- **Responsable:** Antigravity
- **Estado:** listo_para_qa

## Resumen de cambios

1. **Identificación y asignación directa de mesas pendientes:**
   - La pantalla de `Estado y publicación` desglosa exactamente qué 4 actas (mesa, cargo, unidad y sector) no tienen operador asignado.
   - Cada fila cuenta con un selector de operadores activos de la institución y un botón `Asignar`.
   - Al asignar, se llama a la API real, se notifica el éxito, se actualiza el contador y, al completarse las 4 actas, el aviso cambia a verde y se habilita el botón `Iniciar conteo`.
   - Enlace dual en el banner: `Ver mesas pendientes ↓` y `Revisar asignaciones →`.

2. **Limpieza visual de la cabecera:**
   - Se removió el recuadro blanco superior duplicado (`Elecciones de Autoridades USFX 2026 / Toda la organización`) que aparecía antes del título en la pestaña `publicacion`.

3. **Verificación y pruebas:**
   - 71/71 pruebas unitarias e interfaz del frontend pasando exitosamente.
   - Compilación con Vite completada.
   - Despliegue en caliente en el contenedor Docker `tuvoto-frontend-1` en el puerto 8890 verificado.
