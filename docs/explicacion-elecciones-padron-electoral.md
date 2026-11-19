# Elecciones y padrón electoral: quién usa a quién

**SIGAPE · COM-600 · explicación para presentación**

> Corte: 11/11/2026. Los datos del sistema son sintéticos y académicos. No representan reglas electorales reales ni autorizan a votar.
>
> Versión visual para abrir o proyectar: [`explicacion-elecciones-padron-electoral.html`](explicacion-elecciones-padron-electoral.html).

## 1. La idea en 30 segundos

- `elecciones` administra los procesos electorales.
- `padron-electoral` administra inscripciones sintéticas y su elegibilidad.
- La única llamada directa entre ambos es **`elecciones` → `padron-electoral` por gRPC**, para consultar elegibilidad.
- El `gateway-graphql` consume a los dos por REST; el `frontend` consume al gateway.
- `candidaturas`, `votacion` y `resultados` solo guardan o usan `idEleccion` como referencia. No consultan la base de elecciones ni la del padrón.

La frase para recordar:

> **Cada servicio es dueño de su base. La relación elección-inscripción es lógica, no un `JOIN` entre bases.**

## 2. Los dos servicios principales

### `elecciones`

| Aspecto | Detalle |
| --- | --- |
| Tecnología | Node.js, TypeScript, Express y PostgreSQL |
| Base lógica | `elecciones_db` |
| Tabla | `elecciones` |
| Campos | `id_eleccion`, `nombre`, `estado`, `creado_en`, `actualizado_en` |
| Estados | `borrador`, `programada`, `en_curso`, `finalizada`, `anulada` |
| API REST | `/api/v1/elecciones` |
| Regla | Solo se puede editar o eliminar una elección en `borrador` |
| Puerto interno | `3000` |
| Integración | Llama al padrón por gRPC para consultar elegibilidad |

Endpoints principales:

```http
GET    /api/v1/elecciones
POST   /api/v1/elecciones
GET    /api/v1/elecciones/{idEleccion}
PUT    /api/v1/elecciones/{idEleccion}
DELETE /api/v1/elecciones/{idEleccion}
GET    /api/v1/elecciones/{idEleccion}/inscripciones/{idInscripcion}/elegibilidad
```

### `padron-electoral`

| Aspecto | Detalle |
| --- | --- |
| Tecnología | Node.js, TypeScript, Express, PostgreSQL y gRPC |
| Base lógica | `padron_electoral_db` |
| Tabla | `inscripciones` |
| Campos | `id_inscripcion`, `id_eleccion`, `elegible`, `creado_en`, `actualizado_en` |
| Datos personales | No guarda nombre, cédula, identidad ni datos del elector |
| API REST | `/api/v1/inscripciones` |
| Filtros | `idEleccion`, `elegible` |
| gRPC | `sigape.padron.v1.ServicioPadron/ConsultarElegibilidad` |
| Puerto gRPC interno | `50051` |
| Puerto HTTP interno | `3000` |

Endpoints principales:

```http
GET    /api/v1/inscripciones
POST   /api/v1/inscripciones
GET    /api/v1/inscripciones/{idInscripcion}
PUT    /api/v1/inscripciones/{idInscripcion}
DELETE /api/v1/inscripciones/{idInscripcion}
GET    /api/v1/inscripciones/{idInscripcion}/elegibilidad
```

## 3. Mapa de consumo

```text
                         ┌──────────────────────┐
                         │      frontend        │
                         │  React, sin base     │
                         └──────────┬───────────┘
                                    │ GraphQL
                                    ▼
                         ┌──────────────────────┐
                         │   gateway-graphql    │
                         │  BFF, sin base       │
                         └───┬────────┬─────────┘
                             │ REST   │ REST
              ┌──────────────┘        └──────────────┐
              ▼                                      ▼
   ┌──────────────────────┐              ┌──────────────────────┐
   │     elecciones       │              │  padron-electoral    │
   │  PostgreSQL propio   │              │  PostgreSQL propio   │
   └──────────┬───────────┘              └──────────▲───────────┘
              │                                     │
              │        gRPC: elegibilidad           │
              └─────────────────────────────────────┘
                             │ REST
                             ▼
                  ┌──────────────────────┐
                  │     candidaturas     │
                  │  MongoDB propio      │
                  │  guarda idEleccion   │
                  └──────────────────────┘
```

Lectura del diagrama:

- **GraphQL** solo aparece entre `frontend` y `gateway-graphql`.
- **REST** aparece entre el gateway y los servicios de dominio.
- **gRPC** aparece únicamente entre `elecciones` y `padron-electoral`.
- `candidaturas` no llama a `elecciones`; solo guarda `idEleccion` como referencia lógica.

## 4. La integración directa: consulta de elegibilidad

Ruta pública:

```http
GET /api/v1/elecciones/{idEleccion}/inscripciones/{idInscripcion}/elegibilidad
```

Secuencia:

```text
Cliente
  │
  │ GET .../elegibilidad
  ▼
NGINX
  │
  ▼
elecciones
  1. Valida que los identificadores sean UUID.
  2. Verifica en elecciones_db que la elección exista.
  3. Llama por gRPC a padron-electoral.
  │
  ▼
padron-electoral
  4. Busca idInscripcion en inscripciones.
  5. Comprueba que id_eleccion coincida con la elección recibida.
  6. Responde ELEGIBLE o NO_ELEGIBLE.
  │
  ▼
elecciones
  7. Traduce la respuesta gRPC a JSON y responde al cliente.
```

Respuesta esperada:

```json
{
  "idEleccion": "20000000-0000-4000-8000-000000000001",
  "idInscripcion": "30000000-0000-4000-8000-000000000001",
  "elegible": true,
  "idCorrelacion": "correlacion-de-la-solicitud"
}
```

### Errores que conviene explicar

| Situación | gRPC | HTTP |
| --- | --- | --- |
| UUID inválido | `INVALID_ARGUMENT` | `400` |
| La elección no existe en `elecciones_db` | No se llama al padrón | `404` |
| La inscripción no existe en el padrón | `NOT_FOUND` | `404` |
| La inscripción pertenece a otra elección | `FAILED_PRECONDITION` | `409` |
| El padrón no responde a tiempo | `DEADLINE_EXCEEDED` | `504` |
| El padrón no está disponible | `UNAVAILABLE` | `503` |
| El padrón no tiene capacidad | `RESOURCE_EXHAUSTED` | `503` |
| Error inesperado | `INTERNAL` | `502` |

Puntos clave:

- El plazo por defecto de la llamada gRPC es de **1200 ms**.
- `elecciones` comprueba que la elección exista **en su propia base**.
- El padrón **no consulta la base de elecciones**. Solo compara el `id_eleccion` que tiene guardado en su inscripción.
- No hay transacción entre servicios. Son dos bases distintas.

## 5. ¿Quién consume a `elecciones` y al padrón?

| Consumidor | ¿Usa elecciones? | ¿Usa padrón? | Cómo |
| --- | :---: | :---: | --- |
| `gateway-graphql` | Sí | Sí | REST a `/api/v1/elecciones` y `/api/v1/inscripciones`. Compone con GraphQL y DataLoader. |
| `frontend` | Indirectamente | Indirectamente | Solo llama a `/graphql`. No accede a microservicios ni a bases. |
| `candidaturas` | No directamente | No | Guarda `idEleccion` como referencia. El gateway es quien cruza candidatura con elección. |
| `votacion` | No directamente | No | Recibe `idEleccion` en `POST /api/v1/votos`. No valida elección ni elegibilidad. |
| `resultados` | No directamente | No | Agrupa eventos por `idEleccion`. No consulta la base de elecciones. |
| `identidad` | No | No | No participa en este flujo. La API P1 no implementa autenticación. |

## 6. Flujos explicados

### A. Ver elecciones con sus inscripciones

```text
frontend
  │ GraphQL
  ▼
gateway-graphql
  ├── REST GET /api/v1/elecciones
  ├── REST GET /api/v1/inscripciones?idEleccion=...
  └── REST GET /api/v1/candidaturas?idEleccion=...
  │
  ▼
Une los resultados por idEleccion y responde GraphQL
```

Consulta GraphQL de ejemplo:

```graphql
{
  elecciones(limite: 2) {
    elementos {
      idEleccion
      nombre
      inscripciones {
        total
        elementos {
          elegible
        }
      }
    }
  }
}
```

El gateway usa **DataLoader** para agrupar y deduplicar llamadas durante una misma operación. No es dueño de los datos ni de las reglas de negocio.

### B. Consultar si una inscripción es elegible

Es el flujo de la sección 4:

```text
cliente → NGINX → elecciones → gRPC → padrón → respuesta
```

### C. Registrar un voto y calcular resultados

```text
cliente
  │ POST /api/v1/votos
  │ Idempotency-Key: UUID
  │ { "idEleccion": "UUID" }
  ▼
votacion
  ├── Valida el UUID y la clave de idempotencia.
  ├── Guarda el registro en votacion_db.
  └── Publica el evento voto.registrado.v1 en RabbitMQ.
          │
          ├── resultados-conteo
          └── resultados-auditoria
                    │
                    ▼
              MongoDB resultados_db
```

Importante para no exagerar capacidades:

- `votacion` **no consulta** a `elecciones` ni al padrón.
- `votacion` **no valida elegibilidad** todavía.
- El evento actual solo lleva `idEleccion`; no lleva candidato, mesa ni identidad.
- `resultados` cuenta registros por elección. No hace escrutinio por candidato.

## 7. Límites que conviene mencionar

1. **Sin base compartida:** ningún servicio consulta ni modifica la base de otro.
2. **Sin llave foránea entre servicios:** `idEleccion` en padrón, candidaturas, votación y resultados es una referencia lógica.
3. **El padrón no valida la existencia de la elección:** eso lo hace `elecciones` antes de llamar por gRPC.
4. **Votación no valida elegibilidad:** es una integración pendiente para un flujo electoral completo.
5. **Sin autenticación en P1:** no hay login, JWT, roles ni OTP.
6. **Datos sintéticos:** no son datos electorales reales y no habilitan un proceso oficial.
7. **Contratos pendientes:** OpenAPI, gRPC, GraphQL y eventos siguen marcados como propuestas de revisión del equipo.

## 8. Guion corto para exponer

> “SIGAPE separa elecciones y padrón en dos servicios con bases distintas. `elecciones` guarda el proceso electoral y `padron-electoral` guarda inscripciones sintéticas con un indicador de elegibilidad, sin datos personales. La integración directa es por gRPC: cuando se consulta la elegibilidad, `elecciones` verifica primero que la elección exista en su base y luego llama al padrón. El padrón revisa su propia inscripción y confirma que pertenezca a esa elección. El gateway GraphQL consume a ambos por REST y el frontend consume al gateway; así la interfaz no conoce la topología interna. Candidaturas, votación y resultados solo usan `idEleccion` como referencia. La limitación principal es que votación todavía no valida elegibilidad antes de registrar un voto.”

## 9. Preguntas probables

**¿Elecciones consulta directamente la base del padrón?**
No. Usa gRPC. Cada servicio conserva su propia base.

**¿El padrón consulta la base de elecciones?**
No. Solo compara el `id_eleccion` guardado en su propia inscripción con el identificador recibido.

**¿Dónde se valida que la elección exista?**
En `elecciones`, antes de llamar al padrón.

**¿El gateway es dueño de los datos?**
No. Es un BFF sin persistencia: agrega respuestas REST y aplica DataLoader.

**¿Votación ya valida elegibilidad?**
No. Hoy solo registra un voto sintético con `idEleccion` y lo publica por RabbitMQ. Esa validación queda pendiente.

**¿Qué pasa si el padrón está caído o lento?**
`elecciones` traduce `UNAVAILABLE` a `503` y `DEADLINE_EXCEEDED` a `504`. El plazo por defecto es de 1200 ms.

## 10. Archivos clave

| Tema | Archivo |
| --- | --- |
| API y ruta de elegibilidad de elecciones | [`microservicios/elecciones/src/servidor.ts`](../microservicios/elecciones/src/servidor.ts) |
| Cliente gRPC de elecciones | [`microservicios/elecciones/src/cliente-padron.ts`](../microservicios/elecciones/src/cliente-padron.ts) |
| API REST del padrón | [`microservicios/padron-electoral/src/servidor.ts`](../microservicios/padron-electoral/src/servidor.ts) |
| Servidor gRPC del padrón | [`microservicios/padron-electoral/src/servidor-grpc.ts`](../microservicios/padron-electoral/src/servidor-grpc.ts) |
| Contrato gRPC | [`compartido/contratos/grpc/padron-v1.proto`](../compartido/contratos/grpc/padron-v1.proto) |
| Agregación GraphQL y DataLoader | [`gateway/graphql/src/agregacion.js`](../gateway/graphql/src/agregacion.js) |
| Contrato GraphQL | [`compartido/contratos/graphql/esquema.graphql`](../compartido/contratos/graphql/esquema.graphql) |
| Rutas públicas de NGINX | [`infraestructura/docker/nginx.conf`](../infraestructura/docker/nginx.conf) |
| Servicios y variables de Compose | [`docker-compose.yml`](../docker-compose.yml) |

## Nota sobre la documentación

`docs/arquitectura.md` es un documento histórico y contiene afirmaciones desactualizadas: dice que el gateway, el frontend, votación y resultados no están implementados, pero el código y `docker-compose.yml` ya los incluyen. Para la presentación conviene usar este documento, los README de cada servicio y el Compose actual.
