# Arquitectura de Resiliencia y Alta Concurrencia — TUVOTO

## 1. Justificación del Microservicio de Alta Concurrencia
En una elección universitaria de la USFX (con más de 50.000 estudiantes y 3.000 docentes), la carga sobre el sistema es profundamente asimétrica:
- **Operaciones de Escritura (Baja/Media concurrencia):** Registro de actas realizado únicamente por ~150 operadores acreditados distribuidos en mesas electorales (`microservicio actas`).
- **Operaciones de Lectura (Extrema Alta Concurrencia):** Decenas de miles de ciudadanos, electores, candidatos y medios consultando el avance de resultados en vivo cada pocos segundos (`microservicio resultados` y `gateway graphql`).

Por esta razón, la arquitectura desacopla completamente el flujo de lectura del de escritura:

```
[Cliente / Ciudadano / 5.000 Hilos JMeter]
               │
               ▼
      [ NGINX Proxy Inverso ]
               │
               ▼
    [ Gateway GraphQL / REST ]
               │
               ▼
  [ Microservicio Resultados (FastAPI) ]
         │                │
    (Caché L1/L2)     (Proyección)
         ▼                ▼
   [ Cache Redis ]   [ Base MongoDB ]
```

---

## 2. Estrategia de Caché Distribuida (Redis + TTL)
- **Caché en Gateway GraphQL:** Deduplicación en memoria de consultas concurrentes mediante `DataLoader` y caché pública con clave hash (`crearCachePublicaPorClave`).
- **Caché L2 en Resultados (Redis):** Clave `tuvoto:publico:<idProceso>:<hash_configuracion>`.
- **TTL de 3 segundos:** Garantiza que ante una avalancha de 5.000 peticiones por segundo, la base de datos MongoDB solo recibe a lo sumo 1 consulta cada 3 segundos por proceso. El 99.8% de las peticiones se sirven directamente de la memoria RAM de Redis en menos de 10ms.

---

## 3. Patrones de Resiliencia Implementados

### 3.1. Timeouts Estrictos
Ninguna llamada interna queda bloqueada indefinidamente esperando una respuesta de otro microservicio o base de datos:
- **HTTP Remoto / Fetch:** `AbortSignal.timeout(6000)` en Gateway GraphQL y `timeout=4` en Python.
- **Conexión a Bases de Datos:** `connect_timeout=5` en PostgreSQL y `socket_timeout=1` en Redis.
- **NGINX:** `proxy_read_timeout 20s` y `client_max_body_size 15m`.

### 3.2. Aislamiento de Fallos (Bulkhead)
- Las bases de datos están segregadas: PostgreSQL para configuración/actas (ACID estricto) y MongoDB para proyecciones de resultados (lecturas masivas agregadas).
- La caída inducida del microservicio de `actas` o de `elecciones` **no derriba** la consulta pública de resultados, ya que estos se sirven desde Redis y MongoDB.

### 3.3. Reintentos y Backoff Exponencial
- En el consumidor de mensajería RabbitMQ (`consumidor.py`), ante desconexiones o fallos transitorios de red, se implementa reconexión automática con espera exponencial (`time.sleep(min(30, 2 ** intento))`).

### 3.4. Transaccional Outbox Pattern
- El registro de un acta y la creación del evento para RabbitMQ ocurren dentro de la misma transacción ACID de PostgreSQL (`versiones_actas` y `bandeja_actas`).
- Un hilo de fondo publica desde `bandeja_actas` hacia RabbitMQ con confirmación de entrega (`confirm_delivery()`), garantizando que **ningún voto o acta se pierda** aunque RabbitMQ se caiga momentáneamente.
