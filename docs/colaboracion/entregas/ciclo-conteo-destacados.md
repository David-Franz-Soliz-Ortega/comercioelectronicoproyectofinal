# Ciclo institucional y destacados públicos

Fecha: 2026-11-22. Responsable: Codex. Estado: listo_para_qa visual; despliegue verificado. Conservados los cambios recientes de Antigravity en Resumen y Estado/publicación; no se sustituyó su diseño.

## Diagnóstico y cambios

El inicio institucional existente solo abría borradores; los cargos cerrados conservaban datos y no se reiniciaban. La interfaz mostraba Terminar aun sin recepción (deshabilitado). Los destacados ya se persistían en elecciones y CargosDestacados filtraba destacadoPortada en la portada pública; un borrador sigue sin publicarse por seleccionarlo.

- ConteoInstitucion: Terminar solo aparece con recepción; iniciar se bloquea mientras queden cargos cerrados. Tras finalizar, Preparar nuevo conteo de la institución requiere confirmación explícita, archiva el intento anterior y genera borradores nuevos antes de Iniciar. La nota explica el ciclo y la conservación de históricos.
- elecciones/conteo-institucion.ts: POST /configuracion/institucion/preparar con el middleware administrativo, organización y CSRF existente. Reutiliza prepararNuevoConteo bajo una única transacción/bloqueo. Rechaza recepción o registros en curso; rollback total y reintentos concurrentes sin duplicación. Iniciar devuelve 409 si hay cargos cerrados para impedir mezclar intentos.
- elecciones/reiniciar.ts copia destacado_portada al nuevo UUID además de configuración/candidatos/mesas/asignaciones. Los originales quedan archivados; no se copian actas ni proyecciones. No se borran datos ni se vacían bases de otros servicios. Los resultados se consultan por el nuevo idProceso; la comprobación HTTP completa con actas/resultados reales permanece pendiente.
- OpenAPI actualizado. PortadaAdministracion aclara que sus seleccionados son los cargos de la portada pública de Resultados, visibles una vez publicados; no inicia el conteo.

## Pruebas ejecutadas

- Frontend: 70/70; incluye renderizado de estados (sin Terminar antes/después, preparación nueva y bloqueo de iniciar cerrado) y destacados públicos únicamente seleccionados. Compilación Vite OK.
- TypeScript elecciones: OK.
- ejecutar-modelo.py: 9/9, PostgreSQL efímero con tmpfs, puerto aleatorio, sin volúmenes persistentes ni conexión al proyecto existente. Verifica migración, ciclo original, preparación con rollback ante registro en curso, concurrencia/reintento, UUID nuevos, borradores sin publicación/actual, asignaciones y destacados conservados, históricos no borrados y nuevo inicio/cierre. Log /tmp/tuvoto-ciclo-pg.log.
- git diff --check: OK. No se ejecutaron acciones de conteo sobre TUVOTO. El despliegue posterior autorizado se detalla a continuación. Sin commit/push/tag.

## Siguiente acción

El usuario autorizó actualizar elecciones y frontend con respaldo. Se creó un respaldo privado PostgreSQL de elecciones, excluido de Git/Docker, validado mediante pg_restore --list (sin restaurar). Solo conteo-institucion.js y reiniciar.js diferían de los módulos desplegados; los demás se verificaron idénticos antes de actualizar. Build/up --no-deps de elecciones/frontend: trece contenedores saludables, otros once con sus IDs originales y todos los montajes conservados. Cantidades y huellas de todas las filas de las tablas de elecciones idénticas antes/después; estados, configuración, candidatos y asignaciones intactos. Compilados del contenedor, OpenAPI (incluida /institucion/preparar), index y recursos servidos coinciden con el repositorio compilado. [Evidencia](../despliegue-ciclo-conteo.json). Referencia privada del respaldo: /tmp/tuvoto-respaldo-ciclo-conteo-ruta. Siguiente acción: Ctrl+F5 en http://127.0.0.1:8890/#panel y revisar Estado y publicación. Para cambiar los datos del usuario, confirmar por separado la institución y ejecutar la acción explícita desde su panel. No afirmar que los estados cerrados existentes eran falsos: en esta tarea no se inspeccionaron sus datos/historial reales ni se alteraron.
