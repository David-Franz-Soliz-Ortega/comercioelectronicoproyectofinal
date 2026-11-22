# Entrega: Resumen y portada institucional según referencia visual

- **Fecha:** 2026-11-22
- **Responsable:** Antigravity
- **Estado:** listo_para_qa

## Resumen de cambios

1. **Botón y modal "+ Nueva institución":**
   - Corregido el componente `ModalFormulario`: ahora asigna `abierto = true` por defecto y maneja `elemento.showModal()` de forma segura comprobando `!elemento.open`.
   - Vinculado explícitamente `abierto={creandoInstitucionModal}` en `PanelPrivado.jsx`.
   - Estilizado el botón `+ Nueva institución` con enlace sutil azul en la cabecera derecha, accesible para los administradores.

2. **Barra de accesos rápidos:**
   - Incorporados los iconos exactos de la referencia (`IconoUsuarioMas`, `IconoCalendario`, `IconoUsuario`, `IconoEnlaceExterno`).
   - Aplicado el diseño de barra horizontal blanca con borde sutil `#E2E8F0`, iconos azules `#2563EB` y texto `#1E293B`.

3. **Cargos destacados:**
   - Grilla exacta en 2 columnas (`grid-template-columns: repeat(2, minmax(0, 1fr))`) de tarjetas blancas independientes.
   - Lista vertical de candidatos con avatares circulares de 36px (`border-radius: 50%`) y nombres legibles.
   - Botón de 3 puntos verticales (`IconoPuntosVerticales`) con estilo sutil, conservando accesibilidad y pruebas.
   - Enlaces inferiores `Candidatos →` y `Revisar publicación →`.

4. **Pruebas y despliegue:**
   - 68/68 pruebas unitarias del frontend ejecutadas satisfactoriamente.
   - Compilación de producción con Vite completada sin errores.
   - Despliegue en caliente en el contenedor Docker `tuvoto-frontend-1` (`/usr/share/nginx/html/`).
