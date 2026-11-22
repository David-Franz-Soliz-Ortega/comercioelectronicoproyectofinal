# Instrucciones del repositorio — TUVOTO

TUVOTO reemplaza el flujo activo SIGAPE por seguimiento académico de resultados preliminares basados en actas. El usuario autorizó archivar componentes sustituidos. El material SIGAPE retirado se conserva en `.respaldo-local/`, ignorado por Git/Docker; no desplegarlo como TUVOTO.

- Español para archivos propios, dominio, comentarios y mensajes. Conservar nombres técnicos de frameworks y herramientas.
- Cuatro servicios de negocio activos: identidad (Node/TypeScript/PostgreSQL), elecciones (Node/TypeScript/PostgreSQL), actas (FastAPI/PostgreSQL), resultados (FastAPI/MongoDB; Redis como caché pública).
- Cada servicio consulta exclusivamente su persistencia lógica. Integraciones mediante REST/OpenAPI, GraphQL o eventos explícitos en `compartido/contratos/`. El gateway no es dueño de reglas de negocio ni de datos.
- Roles asignables: ADMINISTRADOR, OPERADOR y AUDITOR. Administrador configura procesos/usuarios/asignaciones; operador registra únicamente sus mesas; auditor consulta sin modificar y público consulta sin login. No conceder al administrador el permiso de publicar actas.
- No reintroducir voto individual ni padrón. No contar fotos recibidas como mesas procesadas ni sumar una corrección dos veces.
- Conservar originales y versiones; una huella no certifica autenticidad. Nunca publicar imágenes de actas o identificadores de operadores en eventos/resultados públicos.
- No simular OCR, resultados o salud. Sin datos, mostrar estados vacíos. OCR sigue pendiente.
- Mantener pruebas, configuración y código de cada servicio bajo `microservicios/`.
- No agregar secretos, credenciales ni información electoral real. Entornos sensibles fuera de Git y del contexto Docker.
- No borrar datos/volúmenes antiguos ni desplegar sobre proyectos existentes sin autorización. El Compose nuevo usa proyecto `tuvoto` y variables nuevas `TUVOTO_*`.
- Conservar los cambios locales del usuario. No hacer commit/push/tags sin solicitud explícita.

- La rúbrica oficial está desglosada en `docs/presentaciones/requisitos.md`: conservar 4 CRUD reales, GraphQL de 3 servicios, gRPC, eventos y avances P2/P3; nunca marcar evidencia no ejecutada como cumplida.

## Reutilización y limpieza

- Antes de declarar un archivo sin uso, comprobar sus importaciones desde la entrada de la aplicación, incluidas las cargas diferidas. Las pruebas por sí solas no demuestran uso operativo.
- Reutilizar componentes, formularios y utilidades existentes. Al sustituir una implementación, retirar sus restos confirmados sin borrar funciones activas ni trabajo ajeno. Evitar duplicar formularios, mapas de etiquetas y reglas CSS para resolver el mismo comportamiento.
- Verificar las cuadrículas anidadas con grupos desplegados y varios elementos, tanto en móvil como en escritorio ancho; comprobar el ancho legible de los nombres además del desbordamiento global.

## Continuidad entre agentes

- Las skills del proyecto están en `.agents/skills/`: `tuvoto-desarrollar`, `tuvoto-verificar` y `tuvoto-entregar`.
- Al retomar una tarea de otro agente, leer [el estado compartido](docs/colaboracion/estado.md) y contrastarlo con la rama, el diff y el código actuales.
- Al cerrar una fase de desarrollo o QA, actualizar su entrega con cambios, pruebas realmente ejecutadas, pendientes y siguiente acción. Para tareas simultáneas, usar entregas separadas y enlazarlas en el estado.
- Incorporar solo aprendizajes demostrados a [las lecciones](docs/colaboracion/lecciones.md), a la skill pertinente o a una prueba de regresión; conservar el registro breve y sin secretos.
