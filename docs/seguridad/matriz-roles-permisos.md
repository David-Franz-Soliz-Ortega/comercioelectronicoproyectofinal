# Matriz de Roles, Permisos y Control de Acceso (RBAC) — TUVOTO

## 1. Definición de Roles del Sistema
TUVOTO implementa un modelo estricto de control de acceso basado en roles (RBAC) con separación de funciones (Separation of Duties - SoD). Se definen exactamente tres perfiles autenticados más el acceso público sin autenticación:

| Rol | Alcance | Descripción y Límites Operativos |
|---|---|---|
| **ADMINISTRADOR** | Global / Institucional | Configura y gestiona elecciones, cargos, candidatos, facultades y cuentas. **Límite de negocio estricto:** No tiene permiso para registrar actas de escrutinio (`actas:registrar` denegado). |
| **OPERADOR** | Mesa y Organización asignada | Responsable de registrar las actas físicas digitalizadas y el desglose de votos de las mesas asignadas. No puede crear elecciones ni modificar usuarios. |
| **AUDITOR** | Organización / Solo lectura | Inspecciona y audita actas, observaciones, registros de trazabilidad y eventos de seguridad. No tiene permisos de mutación o escritura sobre ningún recurso. |
| **PÚBLICO** | Sin autenticación | Ciudadanos, docentes y estudiantes que consultan el cómputo preliminar en tiempo real, actas computadas y reportes consolidados sin credenciales. |

---

## 2. Matriz de Endpoints y Permisos HTTP

| Recurso / Endpoint | Método | Acción de Negocio | Roles Permitidos | Respuesta no autenticado | Respuesta rol no autorizado |
|---|---|---|---|:---:|:---:|
| `/api/v1/publico/resultados/{id}` | GET | Consultar cómputo preliminar | Todos (incluido Público) | 200 OK | 200 OK |
| `/graphql` (Query portal/eventos) | POST | Consultar catálogo y cómputo | Todos (incluido Público) | 200 OK | 200 OK |
| `/api/v1/autenticacion/login` | POST | Iniciar sesión (Cookie + CSRF) | Anónimo / Todos | 401 Credenciales | - |
| `/api/v1/autenticacion/token` | POST | Obtener Token JWT | Anónimo / Todos | 401 Credenciales | - |
| `/api/v1/configuracion/procesos` | POST | Crear/configurar elección | **ADMINISTRADOR** | 401 Unauthorized | 403 Forbidden |
| `/api/v1/configuracion/procesos/{id}`| PUT/DELETE | Modificar estado de elección | **ADMINISTRADOR** | 401 Unauthorized | 403 Forbidden |
| `/api/v1/usuarios` | GET/POST | Administrar cuentas y roles | **ADMINISTRADOR** | 401 Unauthorized | 403 Forbidden |
| `/api/v1/actas` | POST | Registrar acta de mesa | **OPERADOR** | 401 Unauthorized | 403 Forbidden |
| `/api/v1/actas` | GET | Consultar actas registradas | **OPERADOR**, **AUDITOR** | 401 Unauthorized | 403 Forbidden |
| `/api/v1/informes` | POST | Generar informe oficial | **ADMINISTRADOR** | 401 Unauthorized | 403 Forbidden |
| `/api/v1/informes` | GET | Descargar informe oficial | **ADMINISTRADOR**, **AUDITOR** | 401 Unauthorized | 403 Forbidden |
| `/api/v1/auditoria-seguridad` | GET | Consultar bitácora de auditoría | **AUDITOR**, **ADMINISTRADOR** | 401 Unauthorized | 403 Forbidden |

---

## 3. Mecanismos de Autenticación Soportados
1. **Cookie de sesión HttpOnly y Strict SameSite**:
   - Cookie segura (`__Host-tuvoto-sesion` en HTTPS o `tuvoto-sesion` en local).
   - Protección obligatoria contra CSRF (`X-CSRF-Token` verificado en tiempo constante contra `s.csrf_hash`).
2. **Token JWT (JSON Web Token - RFC 7519)**:
   - Cabecera estándar `Authorization: Bearer <token_jwt>`.
   - Firma HMAC-SHA256 (`HS256`) con secreto centralizado.
   - Expiración obligatoria (`exp`), identificador de usuario (`sub`) y roles.
   - Ideal para automatizaciones, pruebas de carga (JMeter) y llamadas entre componentes.
