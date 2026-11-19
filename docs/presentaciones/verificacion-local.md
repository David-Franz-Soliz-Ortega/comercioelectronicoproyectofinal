# Verificación local TUVOTO — 18 de noviembre de 2026

Destino acordado: demostración local. No se inició el nuevo Compose, no se modificaron los proyectos SIGAPE existentes, no hubo commit/push/tag. El respaldo privado de la limpieza se encuentra en `.respaldo-local/` y se excluye de Git y Docker.

## Comprobaciones ejecutadas

| Comprobación | Resultado y alcance |
| --- | --- |
| TypeScript identidad y elecciones | Compilación sin errores |
| React | 4 pruebas del cliente aprobadas y compilación Vite aprobada; no prueba visual completa |
| Gateway | 4 pruebas de contrato/caché aprobadas; no equivalen a tres servicios desplegados |
| Identidad | 2 pruebas de permisos en memoria y 7 de recuperación administrativa en memoria aprobadas; no se ejecutó recuperación real |
| gRPC | Llamada real HTTP/2 en loopback: contrato, clave interna, permisos, UUID y deadline; productores de datos simulados explícitamente dentro de la prueba, sin bases existentes |
| Actas dominio/HTTP | 5 pruebas aprobadas; HTTP ASGI en memoria sin lifespan ni bases |
| Actas PostgreSQL 17 | 7 pruebas aprobadas sobre tmpfs y puerto aleatorio loopback: publicación, reintentos, concurrencia, corrección, anulación sin borrar original, rollback y 10.000 versiones sintéticas con filtro/paginación/separación de organización |
| Resultados | 3 pruebas de proyección y filtro aprobadas |
| RabbitMQ 4 + MongoDB 8.0 | Prueba efímera aprobada: dos consumidores, ACK manual, duplicados, versión antigua y ambas DLQ; contenedores propios retirados sin volúmenes persistentes |
| Compose | Configuración resuelta con marcadores, 13 servicios, proyecto tuvoto, sin volúmenes/redes externos ni bind mounts de escritura |
| NGINX | `nginx -t` aprobado en contenedor efímero sin red y con configuración montada de solo lectura |
| Arquitectura | PDF generado desde el documento TUVOTO, `pdfinfo`: 8 páginas, C4 y tres ADR |
| Higiene de cambios | `git diff --check` aprobado; esto no sustituye un escaneo de secretos/historial |

## Reproducción

Node 24 y dependencias de cada paquete instaladas mediante sus lockfiles. Las dependencias Python se instalaron en un entorno temporal, sin alterar las bases existentes. Para generar el PDF se utilizó reportlab==4.4.1.

```bash
npm --prefix frontend run probar
npm --prefix frontend run compilar
npm --prefix gateway/graphql run verificar
microservicios/identidad/node_modules/.bin/tsc -p microservicios/identidad/tsconfig.json --noEmit
microservicios/elecciones/node_modules/.bin/tsc -p microservicios/elecciones/tsconfig.json --noEmit
python -m unittest discover -s microservicios/actas/pruebas -v
python -m unittest discover -s microservicios/resultados/pruebas-tuvoto -v
python microservicios/actas/pruebas/ejecutar-postgres.py
python microservicios/resultados/pruebas-tuvoto/ejecutar-mensajeria.py
python docs/presentaciones/generar-arquitectura.py
pdfinfo docs/presentaciones/arquitectura-p1.pdf
git diff --check
```

Los ejecutores SQL y mensajería crean exclusivamente recursos efímeros propios y requieren imágenes ya disponibles. No apuntar las pruebas a las bases SIGAPE. Las pruebas de gRPC y permisos requieren compilar los módulos a una carpeta temporal con acceso a sus dependencias y proporcionar `TUVOTO_COMPILACION_ELECCIONES` o `TUVOTO_COMPILACION_IDENTIDAD`, respectivamente.

## Pendientes que impiden declarar P1 cerrado

Ensayo desde copia limpia, imágenes nuevas construidas, CRUD REST de los cuatro servicios con Swagger, recorrido React/NGINX/GraphQL/gRPC/outbox/RabbitMQ/proyección y comprobación visual escritorio/tablet/móvil. El ensayo SQL de 10.000 registros no acredita por sí mismo el contrato HTTP ni capacidad de 5.000 usuarios. P2/P3 continúan según requisitos.md; no se declara preparación para producción.

## Arranque local — 19 de noviembre de 2026

Se ejecutó `docker compose --env-file .env.tuvoto -p tuvoto up -d --build` con credenciales nuevas en archivo privado 0600 ignorado por Git/Docker. Los 13 servicios arrancaron saludables. Portal, GraphQL vacío y documentación responden 200; sesión sin autenticación devuelve 401. La llamada gRPC Actas → Elecciones con DNS Docker llega al control de autenticación y devuelve 401 sin sesión. No acredita todavía una captura autorizada completa.

Se corrigió el orden de `set` y `rewrite ... break` en las dos rutas Swagger de NGINX: el destino quedaba sin inicializar y producía 500. Se validó y recargó únicamente NGINX TUVOTO; después HTML y recursos Swagger respondieron 200. No se crearon cuentas ni datos electorales; el portal inicial está vacío. Los entornos SIGAPE anteriores permanecen apagados, sin cambios en sus datos.

## Actualización de roles — 19 de noviembre de 2026

ADMINISTRADOR sustituye los dos roles administrativos anteriores. Migración desplegada con respaldo privado y comprobación agregada de integridad; 13/13 servicios saludables. Portal, GraphQL, Swagger y bundle React actualizados verificados. No se alteraron contraseñas, organizaciones ni datos electorales; las cuentas administrativas convertidas deben volver a autenticarse. Véase roles.md.
