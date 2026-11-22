# Entrega: Estado y publicación según referencia visual exacta

- **Fecha:** 2026-11-22
- **Responsable:** Antigravity
- **Estado:** listo_para_qa

## Resumen de cambios

1. **Cabecera y métricas KPI (5 tarjetas en fila):**
   - Título `Estado y publicación` con píldora de estado global (`Estados mixtos`, `En preparación`, etc.) y subtítulo institucional.
   - Selector superior derecho para alcance institucional (`Toda la organización` / facultades / ámbitos).
   - 5 tarjetas de métricas en una fila (`grid-template-columns: repeat(5, minmax(0, 1fr))`):
     - `Cargos` con icono de maletín.
     - `Candidaturas` con icono de usuarios.
     - `Mesas físicas` con icono de mesa/mobiliario.
     - `Actas esperadas` con icono de documento.
     - `Operadores asignados` con icono de usuario.

2. **Banner de alerta:**
   - Barra ámbar de advertencia si existen actas sin operador (`⚠️ X actas por cargo sin operador asignado.`) con enlace `Revisar asignaciones →` navegable a la pestaña de asignaciones.

3. **Panel principal con pestañas, filtros y tabla:**
   - Tarjeta blanca con pestañas superiores: `Todos`, `En preparación`, `En recepción`, `Finalizados` con sus conteos respectivos.
   - Barra de herramientas con caja de búsqueda (`Buscar cargo o facultad…`) e icono de lupa, más selector de cargos/ámbitos.
   - Tabla con encabezados en mayúsculas (`CARGO Y ÁMBITO`, `CANDIDATURAS`, `ACTAS ESPERADAS`, `ESTADO`).
   - Filas estilizadas con subtítulo de ámbito y píldoras de color para los estados (`En preparación` en celeste, `En recepción` en verde, `Finalizada` en gris).
   - Paginación integrada con selector `Filas por página: 7`, conteo `X de Y cargos` y botones de páginas numeradas.

4. **Barra inferior "Control del conteo":**
   - Tarjeta horizontal completa con resumen de cargos en preparación/recepción y nota sobre cargos finalizados.
   - Botón primario azul `Iniciar conteo` y secundario `Terminar conteo` (manteniendo compatibilidad accesible con `.sr-only`).
   - Flujo de confirmación atómica con casilla de verificación y botones `Confirmar` / `Cancelar`.

5. **Pruebas y despliegue:**
   - 68/68 pruebas unitarias del frontend ejecutadas y pasadas exitosamente (`npm run probar --prefix frontend`).
   - Compilación exitosa en producción con Vite.
   - Despliegue en caliente en el contenedor Docker `tuvoto-frontend-1` en el puerto 8890 verificado.
