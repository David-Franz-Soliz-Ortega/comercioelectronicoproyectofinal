# Modelo de Amenazas OWASP API Security Top 10 — TUVOTO

Este documento modela las amenazas del sistema TUVOTO frente al estándar **OWASP API Security Top 10 (2023)** y detalla los controles técnicos implementados.

---

### API1:2023 — Broken Object Level Authorization (BOLA)
- **Riesgo:** Un operador intenta registrar o modificar un acta de una mesa que pertenece a otra facultad u otro operador.
- **Control TUVOTO:** Validación a nivel de PDP (`/interno/autorizar`) donde se comprueba el `idOrganizacion` y la asignación explícita de mesa. Si el usuario intenta acceder a un objeto ajeno, la API rechaza con `403 Forbidden`.

### API2:2023 — Broken Authentication
- **Riesgo:** Fuerza bruta en inicio de sesión, tokens predecibles o robo de credenciales.
- **Control TUVOTO:**
  1. Hashing de contraseñas con **bcrypt** (factor de costo 12).
  2. Limitación de tasa de intentos por usuario e IP (`intentos_autenticacion`) con bloqueo temporal de 15 minutos tras fallos reiterados.
  3. Tokens de sesión con 32 bytes de entropía criptográfica (`randomBytes(32).toString('base64url')`) y tokens JWT con expiración estricta y firma HMAC-SHA256.

### API3:2023 — Broken Object Property Level Authorization
- **Riesgo:** Modificación indebida de campos sensibles (p. ej. alterar votos directos o campos de auditoría).
- **Control TUVOTO:** Validación estricta con esquemas **Zod** y **Pydantic** usando validación `.strict()`. Cualquier propiedad extra no declarada en el contrato es rechazada de inmediato con `422 Unprocessable Entity` o `400 Bad Request`.

### API4:2023 — Unrestricted Resource Consumption
- **Riesgo:** Ataques de denegación de servicio (DoS) por consultas masivas de cómputo o queries GraphQL excesivamente profundos.
- **Control TUVOTO:**
  1. Caché Redis de 3 segundos para el endpoint público de resultados (`tuvoto:publico:<idProceso>:<hash>`).
  2. DataLoader para deduplicación de consultas y prevención del problema N+1.
  3. Límite de profundidad (máximo 8 niveles) y de campos (máximo 150 campos) en el analizador AST de GraphQL.
  4. Límite de tamaño de cuerpo (`client_max_body_size 15m` en NGINX y límite en express).

### API5:2023 — Broken Function Level Authorization (BFLA)
- **Riesgo:** Un auditor u operador intentando invocar funciones administrativas (como `/api/v1/configuracion/procesos`).
- **Control TUVOTO:** Separación funcional estricta: `proceso:configurar` solo permitido para `ADMINISTRADOR`, `actas:registrar` exclusivo para `OPERADOR`, y consultas de auditoría restringidas a `AUDITOR` y `ADMINISTRADOR`.

### API6:2023 — Unrestricted Access to Sensitive Business Flows
- **Riesgo:** Automatización maliciosa para adulterar actas electorales o computar mesas fantasmas.
- **Control TUVOTO:** Flujo de actas inmutable: cada acta registrada genera una versión inalterable en `versiones_actas` con huella SHA-256 (`foto_hash`), firma de conteo y publicación transaccional mediante patrón Outbox y RabbitMQ.

### API7:2023 — Server-Side Request Forgery (SSRF)
- **Riesgo:** Inducción al servidor a enviar peticiones HTTP a recursos internos o metadatos de nube.
- **Control TUVOTO:** Los microservicios backend no aceptan URLs arbitrarias de usuarios. Todas las URLs de destino entre microservicios se configuran de manera fija mediante variables de entorno (`ELECCIONES_URL`, `IDENTIDAD_URL`, etc.) dentro de una red Docker/Kubernetes aislada (`internal: true`).

### API8:2023 — Security Misconfiguration
- **Riesgo:** Exposición de endpoints de depuración, cabeceras inseguras o mensajes de error detallados con stack traces.
- **Control TUVOTO:**
  1. NGINX bloquea cualquier llamada externa hacia `/interno/` o `/api/v1/interno/` con `403 Forbidden`.
  2. Cabeceras de seguridad activas: `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` en APIs privadas.
  3. Formato uniforme de errores RFC 7807 (`application/problem+json`) sin volcar trazas de pila a clientes.

### API9:2023 — Improper Inventory Management
- **Riesgo:** Versiones obsoletas de endpoints expuestas sin control o falta de documentación del contrato.
- **Control TUVOTO:** Versionado explícito de APIs (`/api/v1/`), contrato OpenAPI sincronizado y Swagger UI interactivo en `/docs`. Generación de inventario SBOM CycloneDX automatizado.

### API10:2023 — Unsafe Consumption of APIs
- **Riesgo:** Confianza ciega en respuestas de servicios externos o microservicios dependientes.
- **Control TUVOTO:** Todas las respuestas remotas se validan con timeouts estrictos (`AbortSignal.timeout(6000)` en GraphQL, `timeout=4` en Python) y manejo controlado de excepciones con degradación elegante.
