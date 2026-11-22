---
name: tuvoto-desarrollar
description: Implementar o corregir funciones de TUVOTO en React, gateway o microservicios, conservando contratos y preparando la entrega a QA. Para solicitudes de cambios de código, no consultas conceptuales.
---
# Desarrollar en TUVOTO

Lee [AGENTS.md](../../../AGENTS.md). Si retomas trabajo, consulta el [estado compartido](../../../docs/colaboracion/estado.md) y contrástalo con la rama, el diff y el código actuales; una conversación anterior no acredita el estado del repositorio.

## Implementación

- Delimita el resultado solicitado y revisa solo sus componentes, contratos y pruebas cercanas. El frontend está en `frontend/src/`, el BFF en `gateway/graphql/` y los cuatro servicios activos en `microservicios/`.
- Reutiliza las APIs existentes. Al cambiar un contrato, identifica sus consumidores y actualiza la especificación en `compartido/contratos/` junto con la implementación.
- Conserva el estilo y los cambios locales existentes. No interpretes una tarea de frontend como autorización para ampliar reglas de negocio.
- Antes de reparar un defecto, identifica una causa reproducible. Consulta las [lecciones verificadas](../../../docs/colaboracion/lecciones.md) cuando el problema coincida con uno de esos casos.
- Ejecuta las comprobaciones necesarias para el cambio, usando los ejecutores del área. Las pruebas con escrituras requieren aislamiento acreditado; preparar código no autoriza despliegues ni publicar Git.

## Transferencia

Al cerrar una fase, registra archivos, contratos o migraciones afectados, pruebas realmente ejecutadas y próximos pasos en la entrega compartida. Usa `listo_para_qa` si falta revisión, y `requiere_correccion` si persiste un fallo. Un comando preparado o bloqueado no cuenta como ejecutado.

El siguiente responsable debe poder continuar con el código y esa entrega sin reconstruir todo el chat. El procedimiento de cierre está en [tuvoto-entregar](../tuvoto-entregar/SKILL.md).
