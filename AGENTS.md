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
