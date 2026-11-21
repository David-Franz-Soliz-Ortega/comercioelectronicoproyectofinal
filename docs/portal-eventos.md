# Portal de eventos y cargos — integración local

La portada de `origin/main` se integra con Excel, sectores, ponderación y estados locales. Un evento agrupa cargos con el mismo nombre y organización; no comparte sus votos ni sus mesas. Se conservan fotografías, filtros por unidad, actualización automática, estados vacíos y carga diferida del panel privado.

## Preparación

1. Iniciar sesión y seleccionar la organización.
2. Usar **Nuevo evento** para el primer cargo. **Añadir cargo a este evento** conserva su nombre, ámbito y configuración opcional; cada nuevo cargo comienza en borrador y mantiene candidatos, mesas y resultados independientes.
3. Completar candidatos/fotografías, mesas, operadores y asignaciones. Las cuatro importaciones Excel siguen disponibles con revisión y confirmación.
4. Desde **Estado y publicación**, abrir recepción con confirmación. Se publica el cargo y bloquea su configuración. Los otros cargos ya abiertos conservan su recepción y sus permisos de mesa.
5. Cerrar recepción para impedir nuevas actas, correcciones y anulaciones. Archivar únicamente una elección cerrada: deja de verse públicamente y conserva el historial. No se incorporó el botón remoto «Ocultar y desactivar» porque permitía saltarse este ciclo.

Las mesas de docentes, estudiantes u otros sectores permanecen separadas. Sin ponderación, los porcentajes son votos válidos por candidato. Si se activa, las tarjetas se ordenan por el porcentaje ponderado y conservan los votos absolutos como una cifra distinta. El desglose muestra pesos y resultados de cada sector. Si falta un porcentaje ponderado, se muestra pendiente; no se reemplaza por el porcentaje bruto. El indicador opcional de segunda vuelta sigue siendo preliminar.

La agrupación por nombre no crea una entidad electoral independiente; conviene incluir año/ciclo y distinguir los ámbitos. El orden de cargos prioriza Rectorado, Vicerrectorado, Decanato, Dirección y después otros. El ámbito y la segunda vuelta aparecen en la selección para distinguir procesos.

## Contratos y seguridad

- Elecciones añade `GET /api/v1/publico/eventos`; solo sirve cargos publicados, no archivados ni eliminados.
- GraphQL agrega `eventos` y conserva `eleccionesPublicadas`, `portal(idProceso, unidad)`, sectores y la mutation autorizada.
- Actas conserva gRPC con deadline, reservas durante escrituras, versiones y outbox. Cerrar espera las operaciones en curso; ningún servicio accede a la base de otro.
- Resultados comprueba la publicación antes de consultar MongoDB o Redis y devuelve 404 si el proceso fue retirado.
- Se conservan las cuentas, cookies HttpOnly, CSRF y autorización del backend. No se agregan credenciales a React.

No se importó la exportación de conversación `codex-session-ahora.md`, ni se ejecutaron scripts remotos de creación de administradores o datos demostrativos. No se instala otro navegador ni se considera completa la rúbrica por integrar este diseño. OCR y prueba de carga siguen pendientes.

Las evidencias actuales se encuentran en `pruebas/ampliacion/`: HTTP real en recursos sintéticos, Firefox con login/estados y portada a 390/768/1440 px. Las comprobaciones de otro equipo no se presentan como ejecutadas localmente.
