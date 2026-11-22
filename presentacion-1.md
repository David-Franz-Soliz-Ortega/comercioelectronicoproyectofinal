# Guía Oficial de Demostración — Presentación 1 (30 Puntos)

**Materia:** COM-600 Microservicios · Gestión 2/2026  
**Sistema:** TUVOTO (Seguimiento y Cómputo Electoral Preliminar Basado en Actas)  
**Tiempo límite de exposición:** 12 minutos de demostración en vivo + 8 minutos de preguntas  

---

## Índice de Pruebas de la Rúbrica

| Paso | Criterio de Evaluación | Requisito Rúbrica | Puntaje |
| :---: | :--- | :--- | :---: |
| **1** | Docker Compose y Proxy Reverso | 2.6 Contenerización y NGINX | 6 pts |
| **2** | Arquitectura C4 y Decisiones (ADR) | 1.0 Documento de arquitectura (PDF) | 6 pts |
| **3** | APIs REST, Swagger UI y Errores Uniformes | 2.2 CRUD REST y contratos OpenAPI | 5 pts |
| **4** | 10.000 Registros, Filtros y Paginación | 2.2 Gran volumen y rendimiento | *Rúbrica* |
| **5** | Gateway GraphQL / BFF (3 Servicios) | 2.3 Orquestación y DataLoader | 4 pts |
| **6** | Comunicación gRPC Interna con Deadline | 2.4 RPC binario tipado y timeout | 4 pts |
| **7** | RabbitMQ: Topic, 2 Consumidores y DLQ | 2.5 Eventos asíncronos e idempotencia | 5 pts |
| **8** | Frontend Web Ciudadano y Panel Privado | 2.13 Vista conectada con datos reales | *Rúbrica* |

---

## Paso 1: Docker Compose y Proxy Reverso (6 puntos)

**Objetivo:** Demostrar que el sistema levanta completo con un único comando en una máquina limpia, sin errores, con imágenes multietapa no-root y NGINX como única puerta de enlace.

### Comando a ejecutar:
```powershell
docker compose ps
```

### Qué mostrar y explicar al docente:
1. **13 contenedores en estado `healthy`:**
   - Bases de datos: `base-postgres`, `base-mongodb`, `cache-redis`.
   - Broker de mensajería: `mensajeria-rabbitmq`.
   - Microservicios de negocio: `identidad`, `elecciones`, `actas`, `resultados`.
   - Consumidores asíncronos: `resultados-conteo`, `resultados-auditoria`.
   - Gateway y Frontend: `gateway-graphql`, `frontend`.
   - Proxy de entrada: `entrada-nginx`.
2. **Aislamiento de red:**
   - Señalar que el único puerto publicado hacia el exterior es el **`8890`** (NGINX). Las bases de datos y microservicios operan en redes internas (`tuvoto_interna`), garantizando que nadie pueda consultar las persistencias directamente.
3. **Buenas prácticas en Dockerfile:**
   - Mostrar cualquier Dockerfile (ej. `microservicios/actas/Dockerfile`) destacando la compilación en etapas múltiples (*multi-stage build*) y la ejecución bajo usuario no privilegiado (`USER tuvoto`).

---

## Paso 2: Arquitectura y Decisiones de Diseño ADR (6 puntos)

**Objetivo:** Presentar el documento formal de arquitectura y justificar las decisiones de comunicación elegidas.

### Archivo a mostrar:
Abrir el documento PDF:
📂 `docs/presentaciones/arquitectura-p1.pdf` (8 páginas)

### Qué explicar al docente:
1. **Diagrama C4 de Contexto y Contenedores:**
   - Descomposición en 4 microservicios con límites claros de contexto (*Bounded Contexts*).
   - Base de datos por servicio (*Database-per-service*): PostgreSQL para `identidad`, `elecciones` y `actas`; MongoDB y Redis para `resultados`.
2. **Los 3 ADRs (Architecture Decision Records):**
   - **ADR 1 (REST / OpenAPI):** Elegido para la interoperabilidad externa y documentación pública con Swagger UI.
   - **ADR 2 (gRPC):** Elegido para la comunicación síncrona servicio a servicio entre `actas` y `elecciones` por su alto rendimiento, tipado estricto y control de latencia (*deadlines*).
   - **ADR 3 (RabbitMQ Topic):** Elegido para la emisión asíncrona de eventos tras la publicación de actas, permitiendo a múltiples consumidores procesar conteos y auditorías en paralelo sin bloquear al usuario.

---

## Paso 3: APIs REST y Documentación Swagger UI (5 puntos)

**Objetivo:** Verificar que cada microservicio cuenta con su CRUD REST documentado bajo la especificación OpenAPI 3.0, con códigos de respuesta semánticos (200, 201, 204, 400, 403, 404, 422).

### Enlaces a abrir en el navegador:
- **Identidad:** [http://127.0.0.1:8890/api/v1/documentacion/identidad/](http://127.0.0.1:8890/api/v1/documentacion/identidad/)
- **Elecciones:** [http://127.0.0.1:8890/api/v1/documentacion/elecciones/](http://127.0.0.1:8890/api/v1/documentacion/elecciones/)
- **Actas:** [http://127.0.0.1:8890/api/v1/documentacion/actas](http://127.0.0.1:8890/api/v1/documentacion/actas)
- **Resultados:** [http://127.0.0.1:8890/api/v1/documentacion/resultados](http://127.0.0.1:8890/api/v1/documentacion/resultados)

### Qué explicar:
- Todas las rutas están en plural y siguen el estándar RFC 7807 (`Problem Details`) para catálogos de errores homogéneos (`type`, `title`, `status`, `detail`, `idCorrelacion`).
- Los contratos JSON crudos están versionados en el repositorio en `compartido/contratos/openapi/`.

---

## Paso 4: Evidencia de los 10.000 Registros, Filtros y Paginación

**Objetivo:** Demostrar que la colección más grande del sistema cuenta con al menos 10.000 registros sembrados y soporta filtros y paginación inmediata mediante índices.

### Demostración 1: Consulta vía API REST (NGINX)
Ejecutar en PowerShell:
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8890/api/v1/publico/actas/a8f54c16-d6d1-4eb9-9d0c-aec4359a0dec/avance" -Method Get | ConvertTo-Json
```
**Respuesta:**
```json
{
  "idProceso": "a8f54c16-d6d1-4eb9-9d0c-aec4359a0dec",
  "mesasConActa": 10000,
  "versiones": 10000
}
```

### Demostración 2: Filtros por estado en la base de datos
```powershell
docker compose exec -T base-postgres psql -U tuvoto_admin -d actas_db -c "SELECT estado, count(*) FROM versiones_actas GROUP BY estado;"
```
*Salida:* Exactamente 5.000 actas `publicada` y 5.000 actas `observada`.

### Demostración 3: Paginación instantánea (índice PostgreSQL)
```powershell
docker compose exec -T base-postgres psql -U tuvoto_admin -d actas_db -c "SELECT id, estado, creado_en FROM versiones_actas WHERE estado = 'publicada' ORDER BY creado_en, id LIMIT 5 OFFSET 0;"
```

> **Nota:** Si el docente pide generar los 10.000 registros en vivo desde cero, ejecuta:
> ```powershell
> .\sembrar-10000-actas.ps1
> ```

---

## Paso 5: Gateway GraphQL / BFF Combinando 3 Servicios (4 puntos)

**Objetivo:** Demostrar que el Gateway GraphQL orquesta datos de al menos 3 microservicios (`elecciones`, `actas` y `resultados`) en una sola petición y resuelve el problema $N+1$ con DataLoaders.

### Consulta combinada a ejecutar en PowerShell:
```powershell
$cuerpo = @{
    query = @"
    query {
      portal {
        proceso {
          id
          nombre
          cargo
        }
        resultados {
          esperadas
          contabilizadas
          avance
          validos
        }
        recepcion {
          mesasConActa
          versiones
        }
      }
    }
"@
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:8890/graphql" -Method Post -ContentType "application/json" -Body $cuerpo | ConvertTo-Json -Depth 5
```

### Qué explicar al docente:
- El Gateway actúa como BFF (*Backend for Frontend*).
- En una sola consulta resuelve:
  - `proceso`: Datos del microservicio **Elecciones**.
  - `resultados`: Cómputo agregado de **Resultados** (MongoDB/Redis).
  - `recepcion`: Total de actas computadas de **Actas** (PostgreSQL).
- Utiliza **DataLoader** para agrupar las peticiones y evitar el problema de $N+1$ consultas hacia los microservicios aguas abajo.

---

## Paso 6: Comunicación Interna gRPC con Deadline (4 puntos)

**Objetivo:** Validar la comunicación síncrona binaria con contrato Proto compartido, códigos de estado gRPC y política de timeout (*deadline*).

### Comando a ejecutar:
```powershell
$env:TUVOTO_COMPILACION_ELECCIONES="microservicios/elecciones/dist"
node microservicios/elecciones/pruebas/mesas-grpc.test.mjs
```

### Qué mostrar:
```text
✔ gRPC real local: contrato, autenticación, permisos y deadline sin bases reales (175ms)
ℹ pass 1
ℹ fail 0
```

### Qué explicar al docente:
- **Contrato:** `compartido/contratos/grpc/mesa-v1.proto` (`ServicioMesas`).
- El servicio `actas` consulta por RPC la validez de una mesa en `elecciones` en el puerto interno `50051`.
- La prueba valida los códigos de retorno:
  - `OK` (0): Respuesta exitosa.
  - `UNAUTHENTICATED` (16): Clave interna de microservicio rechazada.
  - `PERMISSION_DENIED` (7): Operador sin asignación.
  - `DEADLINE_EXCEEDED` (4): Corte forzado por límite de tiempo (25 ms) para garantizar resiliencia.

---

## Paso 7: RabbitMQ con Topic, 2 Consumidores y DLQ (5 puntos)

**Objetivo:** Demostrar el desacoplamiento mediante mensajería asíncrona: intercambio tipo topic, 2 consumidores independientes, persistencia, confirmación manual (ACK) y cola de mensajes muertos (DLQ).

### 1. Comprobar el Intercambiador Topic:
```powershell
docker compose exec -T mensajeria-rabbitmq rabbitmqctl list_exchanges name type | Select-String "tuvoto"
```
*Salida:*
- `tuvoto.actas`: Tipo **topic**.
- `tuvoto.dlq`: Tipo **direct** para mensajes fallidos.

### 2. Comprobar los 2 consumidores activos y las colas DLQ:
```powershell
docker compose exec -T mensajeria-rabbitmq rabbitmqctl list_queues name messages consumers | Select-String "resultados"
```
*Salida:*
```text
resultados.conteo.v1            0    1
resultados.auditoria.v1         0    1
resultados.conteo.v1.dlq        0    0
resultados.auditoria.v1.dlq     0    0
```

### Qué explicar al docente:
- Cuando se registra un acta, se emite el evento al exchange `tuvoto.actas`.
- **Dos consumidores independientes reciben el mismo evento al mismo tiempo:**
  1. `resultados-conteo`: Suma los votos en MongoDB y limpia la caché pública de Redis.
  2. `resultados-auditoria`: Valida la huella criptográfica de la imagen y guarda la auditoría.
- **Idempotencia:** Si un mensaje llega duplicado, el consumidor verifica el hash/versión en MongoDB y no duplica el cálculo.
- **DLQ:** Los mensajes corruptos o que fallan repetidamente son desviados a las colas `.dlq` sin bloquear la cola principal.

> **Comando rápido para ejecutar Pasos 6 y 7 juntos:**
> ```powershell
> .\demostrar-grpc-rabbitmq.ps1
> ```

---

## Paso 8: Demostración en el Frontend Web

**Objetivo:** Mostrar la integración completa desde la perspectiva del usuario final y del personal electoral.

1. **Abrir en el navegador:** [http://127.0.0.1:8890](http://127.0.0.1:8890)
2. **Vista Pública (Observatorio Ciudadano):**
   - Sin autenticación, muestra el resumen de la elección activa, el gráfico de avance de actas y los resultados preliminares resueltos vía GraphQL y Redis.
3. **Inicio de Sesión y Panel Administrativo:**
   - Pulsar en **Iniciar Sesión**.
   - **Usuario:** `admin`
   - **Contraseña:** `Admin12345678!`
   - Explicar la separación estricta de roles:
     - `ADMINISTRADOR`: Configura procesos, mesas y asigna operadores. **No puede publicar actas ni alterar votos** (regla de integridad de TUVOTO).
     - `OPERADOR`: Sube fotos de actas y digita los votos de su mesa asignada.
     - `AUDITOR`: Acceso de solo lectura para fiscalización de actas y auditoría.

---

## Cronograma sugerido para los 12 Minutos de Exposición

| Minutos | Acción |
| :---: | :--- |
| **00:00 – 02:00** | Abrir PDF de arquitectura, explicar C4 y los 3 ADRs fundamentados. |
| **02:00 – 03:30** | Ejecutar `docker compose ps` (13 servicios healthy) y explicar NGINX proxy reverso. |
| **03:30 – 05:30** | Mostrar Swagger UI de los microservicios y la prueba de los 10.000 registros sembrados. |
| **05:30 – 07:30** | Ejecutar la consulta GraphQL combinada (`portal`) de 3 servicios y explicar DataLoader. |
| **07:30 – 09:30** | Ejecutar `.\demostrar-grpc-rabbitmq.ps1` (gRPC con deadline + RabbitMQ topic con 2 consumidores). |
| **09:30 – 12:00** | Recorrido en el navegador de [http://127.0.0.1:8890](http://127.0.0.1:8890) (Observatorio + Login de Administrador). |
| **12:00 – 20:00** | Ronda de preguntas individuales del docente. |
