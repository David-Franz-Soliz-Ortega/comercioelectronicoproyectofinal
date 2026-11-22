---
name: tuvoto-entregar
description: Registrar la entrega de una tarea TUVOTO para que otro agente continúe, con cambios, pruebas, pendientes y lecciones verificadas. Para cerrar fases o transferir trabajo; no para generar entregables académicos ni publicar Git.
---
# Entregar trabajo entre agentes

Sigue [AGENTS.md](../../../AGENTS.md). Usa [estado.md](../../../docs/colaboracion/estado.md) como índice breve de continuidad, no como historial de conversaciones.

## Registrar la entrega

Deja únicamente información que permita continuar:

- Objetivo y alcance de la tarea; rama y revisión de referencia realmente observadas.
- Responsable que entrega, siguiente responsable por asignar o ya acordado y estado: `pendiente`, `en_curso`, `listo_para_qa`, `requiere_correccion` o `verificado`.
- Archivos y contratos afectados; migración o despliegue, si forman parte del cambio.
- Pruebas ejecutadas con resultado y referencia a evidencia; comprobaciones pendientes o bloqueadas por separado.
- Una siguiente acción concreta y las autorizaciones que aún sean necesarias.

Contrasta el registro con `git status` y el diff. Una rama puede haber cambiado desde la última entrega. Conserva el trabajo ajeno y anota cambios concurrentes relevantes sin atribuirte su autoría. Mantén credenciales, cookies, dumps y datos electorales reales fuera del registro.

En trabajo secuencial actualiza el estado vigente. Si hay tareas simultáneas, cada responsable registra su entrega en `docs/colaboracion/entregas/<id-tarea>.md`; quien coordina mantiene los enlaces en el índice y evita que dos agentes sobrescriban la misma entrega. Asignar el siguiente responsable no inicia ni coordina agentes automáticamente.

## Incorporar aprendizaje

Ante un fallo demostrado, registra causa, corrección y comprobación en [lecciones.md](../../../docs/colaboracion/lecciones.md). Convierte solo lo reutilizable en una regla: procedimientos en la skill correspondiente, normas generales en AGENTS.md y fallos de código en pruebas de regresión cuando aporten valor.

Actualiza una lección existente antes de duplicarla. Revisa las pruebas y el alcance antes de conservar una nueva instrucción; una sugerencia o una suposición no se registra como lección verificada. El aprendizaje consiste en esos archivos y pruebas revisados, no en prometer memoria compartida o ausencia de errores.

Al recibir una entrega, el siguiente agente lee las referencias pertinentes, confirma el estado actual y continúa desde el pendiente. Gemini u otras herramientas pueden seguir el mismo registro si se les pide leerlo explícitamente.
