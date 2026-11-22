---
name: tuvoto-verificar
description: Verificar cambios de TUVOTO con pruebas de frontend, contratos e integración aislada y registrar evidencias para desarrollo. Úsala para QA o regresiones; no convierte una revisión en autorización de despliegue.
---
# Verificar TUVOTO

Lee [AGENTS.md](../../../AGENTS.md) y la [entrega vigente](../../../docs/colaboracion/estado.md). Compara sus afirmaciones con el diff y el código; no des por aprobado un resultado de otro agente.

## Comprobaciones proporcionales

- Elige pruebas por el cambio. Para React existen `npm --prefix frontend run probar` y `npm --prefix frontend run compilar`; para el gateway, `npm --prefix gateway/graphql run verificar`. Los servicios mantienen sus pruebas bajo `microservicios/`.
- Si cambia un flujo operativo, consulta sus ejecutores y requisitos antes de correrlos. Las suites TUVOTO están en `pruebas/ampliacion/`; las evidencias SIGAPE no demuestran el producto actual.
- Antes de cualquier escritura de prueba, acredita proyecto, destinos, puertos, montajes y exclusividad de almacenamiento. Un nombre de proyecto distinto no demuestra aislamiento. Si falta esa evidencia, limita el trabajo a comprobaciones de lectura y registra el bloqueo.
- Comprueba las propiedades afectadas: permisos y organización en accesos; persistencia tras recarga en escrituras; cargo y sector en conteos; carga real de imágenes cuando corresponda. Distingue salud del contenedor, versión servida y funcionamiento del flujo.
- Reutiliza herramientas disponibles. No instales navegadores ni levantes otra plataforma completa si una verificación más ligera resuelve el riesgo.

## Dictamen y devolución

Registra revisión de código, entorno, comando, resultado, evidencia y límites de cada comprobación. Distingue `pasó`, `falló`, `no_ejecutado` y `bloqueado`; un informe anterior no acredita esta ejecución.

Si la petición es solo revisar, devuelve los defectos al desarrollo. Si autoriza repararlos, limita la corrección al fallo demostrado y repite las comprobaciones afectadas. Marca `verificado` solo cuando no queden requisitos de la tarea sin comprobar; en otro caso deja el pendiente y su siguiente acción.

Incorpora una prueba de regresión útil cuando se corrija un defecto relevante. Transfiere el resultado mediante [tuvoto-entregar](../tuvoto-entregar/SKILL.md).
