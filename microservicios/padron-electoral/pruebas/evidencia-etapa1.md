# Evidencia — versión sencilla basada en las prácticas

Comprobaciones del **11 de noviembre de 2026**, después de simplificar la entrega del integrante 2. Los cambios siguen limitados a Candidaturas y Padrón electoral.

## Material revisado

- Práctica 2, laboratorio 5: `docker-compose.yml`, variables de entorno, redes, volúmenes y healthchecks.
- Práctica 3, laboratorios 4 y 5: conexión a la base y script para cargar ejemplos.
- Práctica 7, laboratorio 4: pruebas HTTP pequeñas con Jest y Supertest.
- Práctica 5: se conserva la integración gRPC existente y sus dos pruebas.

Las guías del docente están en la carpeta local `MICRO SERVICIOS/temas`. Sus ejemplos de JavaScript y MongoDB se adaptan a las tecnologías ya acordadas del proyecto.

## Cambios para facilitar la explicación

Se retiraron los scripts personalizados que construían archivos comprimidos, generaban configuración y controlaban ambos proyectos. Cada servicio tiene su propio Compose y se trabaja con los comandos normales de clase. La conexión de Candidaturas está en `app/base_datos.py`; los scripts de carga usan listas, bucles y consultas con comentarios.

Los contratos y el Compose compartido no cambian. `Dockerfile.local` usa como contexto solo la carpeta del servicio, con un `.dockerignore` normal que excluye `.env`. Los contratos se montan en modo lectura. Se mantienen nombres de proyecto y volúmenes para conservar los datos anteriores.

## Resultados comprobados

| Verificación | Resultado |
| --- | --- |
| Construcción TypeScript | Correcta |
| Arranque con `docker compose up -d --build --wait` | Ambas APIs y bases saludables |
| Jest + Supertest contra la API y PostgreSQL reales | 4 pruebas aprobadas |
| Pruebas gRPC existentes | 2 pruebas aprobadas |
| unittest contra la API y MongoDB reales | 3 pruebas aprobadas |
| Recarga de los ejemplos | Los cuatro registros y sus fechas permanecen idénticos |
| Swagger | Disponible en ambos servicios; Candidaturas referencia un contrato accesible |
| Imagen de ejecución de Padrón | Jest no está instalado |
| Alcance del cambio | Solo carpetas de Candidaturas y Padrón |

Las pruebas crean y eliminan sus propios registros. El resto de los datos se conserva. La carga de ejemplos no crea elecciones en otro servicio.

Los límites de ejecución siguen siendo 128 MiB para cada API, 128 MiB para PostgreSQL y 512 MiB para MongoDB: **896 MiB en total**. El contenedor temporal de pruebas de Padrón admite 256 MiB adicionales y se elimina con `--rm`. La construcción también consume memoria adicional. No se realizó una prueba de carga.

## Reproducir

En `microservicios/padron-electoral`, después de configurar `.env`:

```sh
docker compose up -d --build --wait
docker compose exec -T padron-electoral npm run cargar-datos
docker compose run --build --rm pruebas
```

En `microservicios/candidaturas`, después de configurar `.env`:

```sh
docker compose up -d --build --wait
docker compose exec -T candidaturas python -m app.cargar_demostracion
docker compose exec -T candidaturas python -m unittest discover -s pruebas -v
```

En cada carpeta, `docker compose stop` libera memoria y conserva el volumen. Esta revisión no prueba el frontend, GraphQL ni RabbitMQ.
