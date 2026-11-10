# Evidencia del frontend React

Fecha: 10 de noviembre de 2026. Entorno: Docker Compose principal `sigape`. URL probada: `http://localhost:8080`.

## Integración

Se leyeron AGENTS.md, el SDL compartido y el gateway GraphQL existente. El frontend consume sus queries de elecciones, candidaturas y padrón y la mutation `crearEleccion`. No se modificaron los contratos, el BFF ni el código de los microservicios en esta integración.

La interfaz React se compiló con Vite y se sirvió desde un contenedor NGINX sin privilegios en el puerto interno 3000. El NGINX de entrada mantiene sus rutas anteriores y sirve el frontend por `/`, con salud pública en `/api/v1/salud/frontend`.

Comandos de despliegue verificados:

```sh
npm run compilar --prefix frontend
docker compose config --quiet
docker compose up -d --build --no-deps --wait frontend
docker compose exec -T entrada-nginx nginx -t
docker compose exec -T entrada-nginx nginx -s reload
```

## Navegador real

La prueba completa se ejecutó con Chromium 141 mediante Playwright 1.56.1 en su imagen oficial Docker:

```sh
sh frontend/pruebas/ejecutar.sh
```

| Comprobación | Resultado |
| --- | --- |
| Carga React desde NGINX y consultas GraphQL reales | Correcto |
| Totales y elecciones contrastados con REST real | Correcto |
| Página siguiente consultada al servidor | Correcto |
| Candidaturas y elecciones asociadas | Correcto |
| Padrón y filtro de no elegibilidad | Correcto |
| Formulario con mutation real | Exactamente una mutation |
| Lectura independiente del registro creado por REST | Correcto |
| Recarga del navegador y búsqueda por nombre | Registro conservado y encontrado |
| Pérdida real de conexión del navegador | Error visible, sin respuestas sustitutas |
| Recuperación de conexión | Nueva consulta correcta |
| Vista móvil de 390 px y navegación | Sin desbordamiento horizontal de la página |
| Errores JavaScript no controlados en la ejecución final | Ninguno |

Se revisaron visualmente las capturas de escritorio y móvil. Durante la validación se corrigió una transición que intentaba dibujar datos de candidaturas con las columnas del padrón. El flujo completo posterior pasó sin errores. Las primeras ejecuciones no llegaron a crear registros.

## Persistencia y traza

Elección académica creada y conservada:

- UUID: `cee091dd-5b0c-4828-9500-43146f650eb9`.
- Nombre: `Prueba navegador SIGAPE c0286293-9dca-48ee-a539-7a18f17f272d`.
- Estado: `borrador`.
- Correlación de la mutation: `27c48a9667f5449bb8bb0d52b1f580d7`.

La respuesta de la mutation fue 200; el BFF registró una sola llamada REST POST a elecciones con respuesta 201. La consulta SQL independiente en PostgreSQL confirmó el mismo UUID, nombre y estado. El navegador conservó el registro tras recargar y lo encontró mediante búsqueda GraphQL.

El recorrido verificado es navegador → NGINX → BFF GraphQL → API REST de elecciones → PostgreSQL. Los otros dos listados se contrastaron con los datos persistidos de candidaturas y padrón. La aplicación no contiene datos simulados ni usa mocks; los registros académicos existentes se consultan en los servicios.

## Evidencia conservada

Carpeta: `/tmp/sigape-frontend.063PY0`.

- `inicio.png`: listado inicial de escritorio con datos reales.
- `escritorio.png`: elección guardada y búsqueda.
- `movil.png`: interfaz en 390 px.
- `evidencia.json`: operaciones GraphQL observadas, comprobaciones, UUID y correlación.

Antes de la prueba había 10005 elecciones, dos candidaturas y cuatro inscripciones. Después, 10006 elecciones; los otros dos totales permanecieron iguales. Solo se creó la elección sintética de esta prueba; no se borraron registros.

## Conservación y pendientes

Se compararon los identificadores y la salud de los 14 contenedores originales antes y después: coinciden y todos siguen saludables. El frontend es el único contenedor permanente nuevo; los 15 están `healthy`. PostgreSQL, MongoDB, Redis, RabbitMQ, el BFF y NGINX conservaron sus contenedores y montajes. No se borraron volúmenes, no se hizo commit ni push.

Pendientes: autenticación/autorización coordinadas con los servicios, revisión humana de los contratos y pruebas adicionales en Firefox y WebKit. El formulario no ofrece idempotencia entre solicitudes separadas porque la mutation actual no tiene ese contrato; bloquea envíos simultáneos y advierte ante una confirmación incierta.
