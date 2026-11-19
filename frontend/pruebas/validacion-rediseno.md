# Validación del rediseño del observatorio

Fecha: 19 de noviembre de 2026.

## Resultado

- `npm run compilar --prefix frontend`: correcto; Vite compiló 37 módulos.
- `npm run probar-interfaz --prefix frontend`: correcto en Chromium headless, con `CHROMIUM_EJECUTABLE` apuntando a un navegador ya instalado.
- `git diff --check`: correcto.
- Sin errores de JavaScript durante la prueba de interfaz.

La prueba aislada intercepta GraphQL dentro del navegador. No accede a bases de datos ni crea registros en servicios. Docker no estaba activo, por lo que **no se ejecutó nuevamente la prueba real de integración** `navegador.mjs`. Se adaptó su navegación a la portada nueva y al menú móvil, conservando sus comprobaciones contra REST y persistencia.

## Cobertura comprobada

1. Porcentajes por estamento que suman 100 %, con el avance de actas calculado de forma independiente.
2. Demostración identificada y sin solicitudes GraphQL al abrir resultados.
3. Filtros combinados de facultad, carrera y cargo; búsqueda sin tildes; limpieza de filtros y estado sin coincidencias.
4. Cambio de estudiantes a docentes que cambia votos, porcentajes y orden de candidaturas.
5. Detalle con válidos, blancos, nulos, total y actas; cierre con Escape y devolución del foco.
6. Navegación por fragmentos, botón Atrás y guía con enlaces a fuentes oficiales.
7. Gestión con paginación, filtros, referencias y creación desde otra sección, conservando la confirmación y emitiendo una sola mutation contra respuestas interceptadas.
8. Urna mientras carga una consulta, controles bloqueados, error visible, eliminación de totales anteriores y recuperación mediante reintento.
9. Ausencia de desbordamiento horizontal a 320, 390, 768, 1024, 1280 y 1440 px. Menú móvil, Escape y preferencia de movimiento reducido.
10. Revisión visual de portada, versión móvil, gestión y ventana de detalle mediante capturas.

## Evidencia local

La ejecución final guardó capturas y `evidencia.json` en:

```text
/tmp/sigape-rediseno-1795096792039/
```

Archivos: `escritorio.png`, `movil.png`, `detalle.png`, `gestion.png`, `gestion-movil.png`, `carga.png` y `evidencia.json`. Esta carpeta es temporal y no forma parte de Git.

Para repetir la prueba, iniciar Vite y ejecutar `npm run probar-interfaz --prefix frontend`. Consultar las variables opcionales y la prueba real en [README](../README.md).
