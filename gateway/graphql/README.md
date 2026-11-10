# BFF GraphQL de SIGAPE

Entrada GraphQL en `POST http://localhost:8080/graphql`, Node.js 24, GraphQL.js y DataLoader. Agrega exclusivamente mediante los contratos REST de elecciones, candidaturas y padrón electoral; no tiene base de datos ni credenciales de persistencia. La lógica y validación de negocio permanecen en cada servicio propietario. Todos los registros son académicos y sintéticos.

## Contrato y operaciones

La propuesta versionada está en `compartido/contratos/graphql/esquema.graphql` y se sirve en `GET /graphql/esquema.graphql`. Continúa pendiente de revisión humana, al igual que los contratos REST consumidos.

| Operación | Productor REST |
| --- | --- |
| `elecciones`, `eleccion`, `eleccionesPorIds` | elecciones |
| `candidaturas`, `Eleccion.candidaturas` | candidaturas |
| `inscripciones`, `Eleccion.inscripciones` | padrón electoral |
| `Candidatura.eleccion`, `Inscripcion.eleccion` | elecciones |
| `crearEleccion`, `crearCandidatura`, `crearInscripcion` | POST del servicio correspondiente |

Las listas devuelven `elementos`, `pagina`, `limite` y `total`. El límite de página es 100. Una elección inexistente devuelve `null`. Las mutations son seriales dentro de una operación, pero no constituyen una transacción entre servicios: si una falla, las escrituras anteriores permanecen guardadas. No se reintentan automáticamente POST, porque estos contratos no ofrecen claves idempotentes de creación.

Ejemplo de query agregada:

```sh
curl http://localhost:8080/graphql \
  -H 'Content-Type: application/json' \
  --data '{"query":"{ elecciones(limite:2) { total elementos { idEleccion nombre candidaturas { total elementos { nombre } } inscripciones { total elementos { elegible } } } } }"}'
```

Mutation de demostración que conserva la elección creada:

```sh
curl http://localhost:8080/graphql \
  -H 'Content-Type: application/json' \
  --data '{"query":"mutation { crearEleccion(entrada:{nombre:\"Elección sintética BFF\",estado:borrador}) { idEleccion nombre estado } }"}'
```

## DataLoader y límites de agregación

Cada operación crea sus propios DataLoader y cachés de lectura; nada se comparte entre solicitudes. Los listados de elecciones precargan su cargador para que las referencias anidadas no vuelvan a consultar cada elección. Los alias, UUID repetidos y relaciones con los mismos argumentos se deduplican. Las mutations invalidan las lecturas anteriores de su operación.

Los productores actuales no ofrecen consultas REST por varios UUID. Para un solo UUID se usa el detalle o filtro documentado. Para varios UUID/relaciones pendientes, el adaptador agrupa las claves y recorre páginas de 100 registros del listado REST existente, distribuyendo los resultados por elección y conservando el orden solicitado. La cantidad de llamadas depende de las páginas necesarias, no de una petición por cada padre GraphQL. En el escenario real probado se resolvió una consulta con tres llamadas REST totales.

`MAXIMO_PAGINAS_LOTE=20` limita cada recorrido a 2.000 registros. En la carga por UUID se detiene antes si encuentra todos los identificadores. En las relaciones se necesita completar el recorrido para calcular totales exactos. Si no puede completarlo, devuelve `LIMITE_DE_CARGA`, sin presentar resultados parciales como completos. Este mecanismo evita el patrón N+1 en las relaciones pero puede leer registros no solicitados; para conjuntos mayores queda pendiente acordar endpoints de lote con los productores. No se accede directamente a sus bases.

Cada petición REST tiene un timeout de 3 segundos; la operación completa dispone de 15 segundos. El servidor admite cuerpos JSON de hasta 64 KiB, 2.500 tokens, profundidad 10, 500 selecciones y lotes de hasta 100 UUID. Las rutas GraphQL solo admiten POST JSON, sin suscripciones ni lotes HTTP. No se ofrece interfaz GraphiQL.

Los errores de ejecución se informan con `errors[].extensions.code`, servicio y correlación cuando corresponde: `ENTRADA_INVALIDA`, `CONFLICTO`, `SERVICIO_NO_DISPONIBLE`, `RESPUESTA_INVALIDA` o `LIMITE_DE_CARGA`. Los campos de relación son anulables para conservar el resto de la respuesta cuando falla un productor. Un documento GraphQL inválido devuelve 400; los resultados ejecutados, incluidos errores parciales, devuelven 200.

## Docker, NGINX y salud

Desde la raíz:

```sh
docker compose up -d --build gateway-graphql
docker compose exec -T entrada-nginx nginx -t
docker compose exec -T entrada-nginx nginx -s reload
```

El contenedor ejecuta Node sin privilegios, escucha en 4000 y pertenece únicamente a `red_interna`; NGINX conserva el único puerto público. Su healthcheck comprueba los tres servicios REST. Salud pública: `GET /api/v1/salud/graphql`. NGINX espera también su salud en arranques posteriores.

Variables de entorno: `ELECCIONES_URL`, `CANDIDATURAS_URL`, `PADRON_URL` y `MAXIMO_PAGINAS_LOTE`. `CONTRATO_GRAPHQL` permite indicar dónde leer el SDL; la imagen lo fija en `/app/esquema.graphql`. No se reciben credenciales de bases ni se copia `.env` a la imagen.

## Pruebas y diagnóstico

```sh
npm ci --prefix gateway/graphql --ignore-scripts
npm run verificar --prefix gateway/graphql
python3 gateway/graphql/pruebas/principal.py
```

La construcción Docker también ejecuta las seis pruebas de agregación. Cubren agrupación, deduplicación y orden, caché por operación, paginación, rechazo de lotes incompletos, errores parciales e invalidación tras mutation.

La prueba principal se ejecuta desde el anfitrión contra `localhost:8080`. Usa Python estándar y Docker Compose; crea y conserva dos elecciones, dos candidaturas y dos inscripciones sintéticas. Comprueba las mutations por GraphQL y su persistencia por REST, relaciones de tres servicios, aliases, claves repetidas y errores. No borra registros ni detiene componentes. Guarda evidencia en un archivo nuevo de `/tmp`.

El BFF emite registros JSON correlacionados de llamadas REST y un resumen `operacion_graphql` por operación, con contadores por servicio. La prueba contrasta esos registros con la cantidad de páginas REST necesarias para verificar el efecto real de DataLoader. No se registran cuerpos, nombres ni credenciales. Consulte [evidencia real](pruebas/resultados-pruebas.md).

Referencias del diseño: [DataLoader y caché por solicitud](https://github.com/graphql/dataloader), [GraphQL.js](https://www.graphql-js.org/docs/).

Pendientes: revisión humana del SDL, autenticación y autorización, endpoints REST de lote para escalar la agregación y reglas electorales completas, que pertenecen a sus servicios.
