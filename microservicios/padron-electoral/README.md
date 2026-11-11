# Padrón electoral — Integrante 2

Node.js + TypeScript + Express + PostgreSQL. Guarda inscripciones sintéticas y consulta si son elegibles. Este servicio conserva el contrato del equipo; no guarda votos ni datos personales.

## Cómo se relaciona con las clases

| Archivo | Qué hace | Práctica |
| --- | --- | --- |
| `src/servidor.ts` | Recibe solicitudes y responde con JSON | 3: REST |
| `src/persistencia.ts` | Conecta a PostgreSQL y crea la tabla | 3: persistencia |
| `src/cargar-demostracion.ts` | Inserta dos ejemplos sin duplicarlos | 3: carga de datos |
| `docker-compose.yml` | Inicia la API y su base de datos | 2: Docker, laboratorio 5 |
| `Dockerfile.local` y `.dockerignore` | Construyen la imagen y excluyen archivos locales | 2: imágenes |
| `pruebas/api.test.cjs` | Prueba la API con Jest y Supertest | 7: pruebas |
| `src/servidor-grpc.ts` | Responde la consulta interna de elegibilidad existente | 5: gRPC |

Los ejemplos del docente usan JavaScript y MongoDB. Aquí se conservan TypeScript y PostgreSQL porque son las tecnologías acordadas para Padrón. Las pruebas usan `test`, `expect` y `request`, como en la práctica 7, y consultan la base real.

## Iniciar

Desde la raíz del repositorio:

```sh
cd microservicios/padron-electoral
cp -n .env.example .env
```

Si es la primera instalación, edita `.env`: reemplaza los dos valores `CAMBIAR_CLAVE` por contraseñas distintas. Si ya tenías `.env`, se conserva. No cambies las claves de una base ya inicializada sin actualizar también sus usuarios.

```sh
docker compose up -d --build --wait
docker compose exec -T padron-electoral npm run cargar-datos
curl --fail http://localhost:3004/salud
curl --fail http://localhost:3004/api/v1/inscripciones
```

Swagger: <http://localhost:3004/docs/>. También responde `GET /api/v1/salud`. El puerto local se configura con `PUERTO_HTTP_PADRON` en `.env`.

## Probar

Desde esta misma carpeta:

```sh
docker compose run --build --rm pruebas
```

Ejecuta `npm test` (Jest con `--runInBand`, una prueba a la vez) y las dos pruebas gRPC existentes. Comprueba salud, CRUD, persistencia, filtros, validaciones y documentación. Solo elimina la inscripción que crea la propia prueba.

El contenedor de pruebas se inicia bajo demanda y se elimina al terminar. Jest y Supertest son dependencias de desarrollo; la API no las carga en ejecución.

## Datos y memoria

La tabla `inscripciones` contiene `id_inscripcion`, `id_eleccion`, `elegible`, `creado_en` y `actualizado_en`. El script carga una inscripción elegible y otra no elegible. Ambas usan la elección sintética `20000000-0000-4000-8000-000000000001`; no crea elecciones en otro servicio.

`ON CONFLICT DO NOTHING` conserva las filas existentes al repetir la carga. El volumen de PostgreSQL conserva los datos al detener o reiniciar. Su usuario de aplicación no es administrador.

La API mantiene hasta cinco conexiones. API y PostgreSQL tienen límites de 128 MiB cada uno. El contenedor temporal de pruebas admite 256 MiB adicionales. Para liberar memoria conservando los datos:

```sh
docker compose stop
```

## Integración existente

El contrato REST está en `compartido/contratos/openapi/padron-electoral.yaml`. gRPC usa `padron-v1.proto` y el método `ConsultarElegibilidad` en el puerto interno 50051. Distingue inscripción inexistente, elección incorrecta, datos inválidos y base no disponible. Mantiene deadlines y cierre ordenado.

El Compose local monta estos contratos en modo lectura. El `Dockerfile` original sigue siendo el utilizado por el Compose general del equipo; `Dockerfile.local` se usa al trabajar únicamente en este servicio. Se mantienen los nombres de proyecto y volumen de la primera versión, por lo que tus datos anteriores siguen disponibles.

Los contratos siguen pendientes de revisión del equipo. Instrucciones del otro servicio: [Candidaturas](../candidaturas/README.md). Comprobaciones realizadas: [evidencia](pruebas/evidencia-etapa1.md).
