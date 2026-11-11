# ms-votos — Etapa 1

Microservicio sencillo en Node.js + Express + PostgreSQL. Guarda votos sintéticos en su propia tabla `votos`. No usa datos reales y no implementa todavía RabbitMQ ni el servicio de resultados.

## Archivos principales

- `src/servidor.js`: inicia Express y crea la tabla.
- `src/app.js`: rutas `GET /salud` y `GET /votos`.
- `src/base_datos.js`: conexión a PostgreSQL con `pg`.
- `src/cargar_datos_prueba.js`: inserta tres votos de ejemplo sin duplicarlos.
- `tests/api.test.js`: comprueba `/salud` y `/votos` contra la base real.
- `docker-compose.yml`: API y PostgreSQL en una red interna, como en la práctica 2.

## Iniciar con Docker Compose

Desde la raíz del repositorio:

```sh
cd microservicios/ms-votos
cp -n .env.example .env
```

En una instalación nueva, cambia `CAMBIAR_CLAVE` por una clave local. No subas `.env` a GitHub.

```sh
docker compose up -d --build --wait
docker compose exec -T ms-votos npm run cargar-datos
curl --fail http://localhost:3005/salud
curl --fail http://localhost:3005/votos
```

La API queda en <http://localhost:3005>. PostgreSQL se publica solo en `127.0.0.1:5435` para poder ejecutar el proyecto también sin Docker.

## Comprobar la tabla y los datos

```sh
docker compose exec -T base-postgres psql -U votos -d votos_db -c '\d votos'
docker compose exec -T base-postgres psql -U votos -d votos_db -c 'SELECT * FROM votos ORDER BY id;'
```

La tabla tiene estas columnas:

| Columna | Tipo | Descripción |
| --- | --- | --- |
| `id` | `SERIAL` | Identificador interno |
| `electorId` | `UUID` | Elector sintético |
| `candidatoId` | `UUID` | Candidato sintético |
| `eleccionId` | `UUID` | Elección sintética |
| `fecha` | `TIMESTAMPTZ` | Fecha del voto |

La restricción `votos_elector_eleccion_unico` evita dos votos del mismo elector en la misma elección. El script de carga usa `ON CONFLICT DO NOTHING`, por lo que se puede repetir sin duplicar los ejemplos.

## Ejecutar sin Docker para la API

Con PostgreSQL ya levantado en `localhost:5435`:

```sh
npm install
npm run cargar-datos
npm start
```

## Pruebas

Con PostgreSQL levantado y `.env` configurado:

```sh
npm test
```

Las pruebas usan el módulo `node:test` incluido en Node.js, por lo que no agregan dependencias.

## Resultado esperado de `/salud`

```json
{
  "estado": "arriba",
  "servicio": "ms-votos",
  "baseDatos": "conectada"
}
```

Si PostgreSQL no responde, la ruta devuelve `503` con `baseDatos: "desconectada"`.

## Alcance de esta etapa

Esta etapa solo deja funcionando el servicio, la conexión a PostgreSQL, la tabla `votos`, los datos de prueba y la ruta `/salud`. La publicación del evento `voto.registrado` en RabbitMQ y el consumidor de resultados corresponden a las siguientes etapas.

Para detener los contenedores conservando los datos:

```sh
docker compose stop
```

No uses `docker compose down -v` si quieres conservar la tabla y los votos de prueba.
