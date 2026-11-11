# Candidaturas — Integrante 2

Python + FastAPI + MongoDB. Guarda postulaciones sintéticas de tipo individual o lista, con el contrato existente del equipo.

## Archivos principales

- `app/servidor.py`: rutas REST, validaciones y respuestas JSON.
- `app/base_datos.py`: conexión a MongoDB, separada para usarla desde el servidor y la carga de ejemplos.
- `app/cargar_demostracion.py`: lista de dos ejemplos y un bucle que los guarda.
- `docker-compose.yml`: API y MongoDB, como en el laboratorio 5 de la práctica 2.
- `Dockerfile.local` y `.dockerignore`: construcción local y exclusión de `.env`.
- `pruebas/test_etapa1.py`: pruebas pequeñas con `unittest`, incluido en Python.

Se aplican las ideas de REST, persistencia y carga de datos de la práctica 3. Se conserva Python/FastAPI porque esa es la tecnología acordada para este servicio. Las pruebas siguen los pasos de preparar, ejecutar y comprobar de la práctica 7, adaptados a Python.

## Iniciar

Desde la raíz del repositorio:

```sh
cd microservicios/candidaturas
cp -n .env.example .env
```

En una instalación nueva, sustituye los dos valores `CAMBIAR_CLAVE` de `.env` por contraseñas distintas. Si ya tenías ese archivo, se conserva. No cambies las claves de una base inicializada sin actualizar también sus usuarios.

```sh
docker compose up -d --build --wait
docker compose exec -T candidaturas python -m app.cargar_demostracion
curl --fail http://localhost:8003/salud
curl --fail http://localhost:8003/api/v1/candidaturas
```

Swagger: <http://localhost:8003/docs>. También responde `GET /api/v1/salud`. El puerto local se configura con `PUERTO_HTTP_CANDIDATURAS` en `.env`.

## Probar

Desde esta misma carpeta:

```sh
docker compose exec -T candidaturas python -m unittest discover -s pruebas -v
```

Comprueba salud, creación, consulta, actualización, eliminación, persistencia real, filtros y entradas inválidas. Verifica que una candidatura aprobada no pueda eliminarse. Solo limpia la candidatura creada por la prueba.

## Datos y memoria

La colección `candidaturas_db.candidaturas` guarda `_id`, `idEleccion`, `nombre`, `tipo`, `estado`, `creadoEn` y `actualizadoEn`. La API muestra `_id` como `idCandidatura`.

La carga crea una candidatura individual y una lista en borrador. `$setOnInsert` inserta solo si el ID no existe: repetir el comando conserva los datos y sus fechas. Usan la misma elección sintética que los ejemplos de Padrón; no se escribe en el servicio de Elecciones.

El cliente mantiene hasta cinco conexiones. La API tiene un límite de 128 MiB y MongoDB de 512 MiB. El volumen conserva los datos. Para liberar memoria:

```sh
docker compose stop
```

## Integración existente

El contrato compartido se monta en modo lectura. El Compose del equipo sigue usando el `Dockerfile` original; este entorno usa `Dockerfile.local`. La ruta de Swagger se configura con `URL_CONTRATO_OPENAPI` para funcionar tanto aquí como detrás de NGINX.

`/salud` devuelve 503 si MongoDB no responde. Los nombres de proyecto y volumen se conservan; tus datos anteriores siguen disponibles. Los contratos siguen pendientes de revisión del equipo.

El otro servicio del integrante 2 es [Padrón electoral](../padron-electoral/README.md). Sus cuatro contenedores juntos tienen un límite de 896 MiB de ejecución; la construcción y las pruebas temporales necesitan memoria adicional.
