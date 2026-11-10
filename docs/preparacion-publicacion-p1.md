# Propuesta de publicación SIGAPE P1

Estado revisado el 10/11/2026. **Pendiente de aprobación explícita; no se ejecutó git add, commit, push ni tag. No se consultaron ni alteraron contenedores o datos en esta revisión.**

## Destino y mensaje propuestos

- Rama: `main`; remoto `origin`: `https://github.com/David-Franz-Soliz-Ortega/comercioelectronicoproyectofinal.git`.
- HEAD local y `refs/heads/main` consultado por `git ls-remote`: `49a49e0a52372785369861da79db0c496afa0f54`. No hay cambios remotos pendientes en main al momento de esa consulta; no se hizo fetch ni se cambiaron referencias locales.
- `v1.0-p1` no existe localmente ni fue anunciado por el remoto, incluyendo su referencia desreferenciada. Volver a comprobar antes de publicar por posibles cambios concurrentes.
- Mensaje: **`feat: completar SIGAPE P1 con integraciones, frontend y evidencias verificadas`**.
- Publicación propuesta, únicamente tras autorización: incorporar la lista exacta inferior, crear el commit, verificar el clon del SHA definitivo antes de publicar y después publicar main y el tag anotado `v1.0-p1`. Los resultados de esa verificación futura no están anticipados como aprobados.

## Controles previos

- El índice está vacío de cambios preparados. Se proponen **140 archivos: 20 modificados y 120 nuevos**, incluyendo este informe. Los archivos ya seguidos sin cambios permanecen en el commit por herencia, sin volver a agregarse; entre ellos `.gitignore`, `.env.example` y `AGENTS.md`.
- `.gitignore` excluye entorno sensible, claves, dependencias, compilados, cachés y logs. `.env` está ignorado y no seguido; `.env.example` es la excepción intencional. No se detectaron enlaces simbólicos en el inventario.
- Cero hallazgos en la revisión heurística previa de 180 archivos actuales y 193 blobs alcanzables, contrastando diez valores sensibles locales en memoria; dos alertas descartadas eran versiones de dependencia. Este informe se genera después de ese corte y contiene únicamente inventario y resultados. No certifica ausencia absoluta; no examina objetos inalcanzables, imágenes o servicios remotos.
- No hay archivos propuestos de más de 1 MiB. El mayor es `docs/arquitectura-p1.pdf`: 233439 bytes (aprox. 228 KiB). El contenido propuesto previo a este informe suma 1089340 bytes (aprox. 1,04 MiB). Los umbrales son controles de tamaño propios, no una certificación de límites remotos.
- El PDF final **está incluido** en el inventario: ocho páginas, SHA-256 coincide con `pruebas/cierre-p1/evidencias/pdf.json`, al igual que Markdown y diagramas. No requiere regeneración por este informe separado.
- Las evidencias contienen UUID, nombres y registros sintéticos, resultados fallidos identificados como tales, rutas temporales e identificadores de contenedores/volúmenes. No contienen credenciales confirmadas ni se incluyen bases de datos. Los archivos `.txt` de evidencia se incluyen intencionalmente; no son los logs de ejecución ignorados por `*.log`.
- Mejora preventiva pendiente ya documentada: `.dockerignore` no añade patrones generales `secrets/`, `*.pem`, `*.key`, aunque Git los excluye y no hay tales archivos propios en el inventario. No se cambió configuración para esta preparación.

## Lista exacta que se incorporaría

### Modificados (20)

```text
.dockerignore
README.md
compartido/contratos/README.md
compartido/contratos/grpc/padron-v1.proto
compartido/contratos/openapi/candidaturas.yaml
compartido/contratos/openapi/elecciones.yaml
compartido/contratos/openapi/identidad.yaml
compartido/contratos/openapi/padron-electoral.yaml
docker-compose.yml
infraestructura/docker/nginx.conf
microservicios/candidaturas/app/servidor.py
microservicios/elecciones/Dockerfile
microservicios/elecciones/package-lock.json
microservicios/elecciones/package.json
microservicios/elecciones/src/servidor.ts
microservicios/identidad/src/servidor.ts
microservicios/padron-electoral/Dockerfile
microservicios/padron-electoral/package-lock.json
microservicios/padron-electoral/package.json
microservicios/padron-electoral/src/servidor.ts
```

### Nuevos (120)

```text
compartido/contratos/graphql/esquema.graphql
compartido/contratos/openapi/resultados.yaml
compartido/contratos/openapi/votacion.yaml
docs/arquitectura-p1.md
docs/arquitectura-p1.pdf
docs/cierre-p1.md
docs/diagramas-p1/contenedores.mmd
docs/diagramas-p1/contenedores.py
docs/diagramas-p1/contenedores.svg
docs/diagramas-p1/contexto.mmd
docs/diagramas-p1/contexto.svg
docs/preparacion-publicacion-p1.md
frontend/Dockerfile
frontend/README.md
frontend/index.html
frontend/nginx.conf
frontend/package-lock.json
frontend/package.json
frontend/pruebas/ejecutar.sh
frontend/pruebas/navegador.mjs
frontend/pruebas/resultados-pruebas.md
frontend/public/simbolo.svg
frontend/src/Aplicacion.jsx
frontend/src/estilos.css
frontend/src/graphql.js
frontend/src/principal.jsx
frontend/vite.config.js
gateway/graphql/Dockerfile
gateway/graphql/README.md
gateway/graphql/package-lock.json
gateway/graphql/package.json
gateway/graphql/pruebas/agregacion.test.js
gateway/graphql/pruebas/principal.py
gateway/graphql/pruebas/resultados-pruebas.md
gateway/graphql/src/agregacion.js
gateway/graphql/src/servidor.js
microservicios/elecciones/README.md
microservicios/elecciones/pruebas/cliente-padron.test.mjs
microservicios/elecciones/pruebas/compose.grpc.yml
microservicios/elecciones/pruebas/doble-padron.mjs
microservicios/elecciones/pruebas/entre-contenedores.mjs
microservicios/elecciones/pruebas/grpc-principal.py
microservicios/elecciones/pruebas/resultados-grpc.md
microservicios/elecciones/src/cliente-padron.ts
microservicios/padron-electoral/README.md
microservicios/padron-electoral/pruebas/servidor-grpc.test.mjs
microservicios/padron-electoral/src/servidor-grpc.ts
microservicios/resultados/Dockerfile
microservicios/resultados/README.md
microservicios/resultados/app/configuracion.py
microservicios/resultados/app/consumidor.py
microservicios/resultados/app/salud.py
microservicios/resultados/app/servidor.py
microservicios/resultados/pruebas/integracion-principal.md
microservicios/resultados/pruebas/integracion.py
microservicios/resultados/pruebas/principal.py
microservicios/resultados/pruebas/resultados-pruebas.md
microservicios/resultados/requirements.txt
microservicios/votacion/Dockerfile
microservicios/votacion/README.md
microservicios/votacion/go.mod
microservicios/votacion/go.sum
microservicios/votacion/pruebas/compose.yml
microservicios/votacion/pruebas/ejecutar.sh
microservicios/votacion/servidor.go
microservicios/votacion/servidor_test.go
pruebas/cierre-p1/README.md
pruebas/cierre-p1/ejecutar-candidato.py
pruebas/cierre-p1/evidencias/arranque-fallo-wait.txt
pruebas/cierre-p1/evidencias/arranque.txt
pruebas/cierre-p1/evidencias/candidato.json
pruebas/cierre-p1/evidencias/contenedores.json
pruebas/cierre-p1/evidencias/datos-principal-antes.json
pruebas/cierre-p1/evidencias/fuentes-verificadas.json
pruebas/cierre-p1/evidencias/git.json
pruebas/cierre-p1/evidencias/grpc.txt
pruebas/cierre-p1/evidencias/pdf.json
pruebas/cierre-p1/evidencias/principal-antes.json
pruebas/cierre-p1/evidencias/principal-despues.json
pruebas/cierre-p1/evidencias/rabbitmq.txt
pruebas/cierre-p1/evidencias/resultado-fallo-verificador.json
pruebas/cierre-p1/evidencias/resultado-fallo-wait.json
pruebas/cierre-p1/evidencias/resultado.json
pruebas/cierre-p1/evidencias/rutas-fallo-verificador.json
pruebas/cierre-p1/evidencias/rutas.json
pruebas/cierre-p1/evidencias/salud-principal.json
pruebas/cierre-p1/evidencias/secretos-exportados.json
pruebas/cierre-p1/evidencias/secretos.json
pruebas/cierre-p1/evidencias/swagger.json
pruebas/cierre-p1/evidencias/volumenes-aislados.json
pruebas/cierre-p1/preparar-candidato.py
pruebas/cierre-p1/verificar-rutas.py
pruebas/integracion/README-crud-p1.md
pruebas/integracion/compose.crud-p1.yml
pruebas/integracion/conservacion-p1.py
pruebas/integracion/crud-p1.py
pruebas/integracion/ejecutar-crud-p1.py
pruebas/integracion/evidencias/crud-p1/carga-1.txt
pruebas/integracion/evidencias/crud-p1/carga-2.txt
pruebas/integracion/evidencias/crud-p1/carga-tras-reinicio.json
pruebas/integracion/evidencias/crud-p1/carga.json
pruebas/integracion/evidencias/crud-p1/conservacion-captura.json
pruebas/integracion/evidencias/crud-p1/conservacion.json
pruebas/integracion/evidencias/crud-p1/correcto.txt
pruebas/integracion/evidencias/crud-p1/crud.json
pruebas/integracion/evidencias/crud-p1/ejecucion.json
pruebas/integracion/evidencias/crud-p1/fallo-correlacion-previo.json
pruebas/integracion/evidencias/crud-p1/fallo-fechas-previo.json
pruebas/integracion/evidencias/crud-p1/fallo-modelos-previos.json
pruebas/integracion/evidencias/crud-p1/fallo-nombre-previo.json
pruebas/integracion/evidencias/crud-p1/incidencias-ejecucion.json
pruebas/integracion/evidencias/crud-p1/persistencia.json
pruebas/integracion/evidencias/crud-p1/regresion-principal.json
pruebas/integracion/evidencias/crud-p1/resultados.md
pruebas/integracion/evidencias/crud-p1/secretos-valores-locales.json
pruebas/integracion/evidencias/crud-p1/swagger-principal.json
pruebas/integracion/evidencias/crud-p1/swagger.json
pruebas/integracion/regresion-lectura-p1.py
pruebas/integracion/requirements.txt
pruebas/integracion/swagger-p1.mjs
```

## Exclusiones exactas observadas

Se excluyen los siguientes archivos/directorios ignorados; un directorio implica todo su contenido. No se usará una inclusión forzada ni un agregado indiscriminado de ignorados.

```text
.env
.venv/
frontend/dist/
frontend/node_modules/
gateway/graphql/node_modules/
microservicios/candidaturas/app/__pycache__/
microservicios/elecciones/dist/
microservicios/elecciones/node_modules/
microservicios/padron-electoral/dist/
microservicios/padron-electoral/node_modules/
pruebas/cierre-p1/__pycache__/
pruebas/integracion/__pycache__/
```

Además se excluyen `.git/`, las carpetas temporales de `/tmp`, sus entornos privados de prueba, redes, contenedores, volúmenes y archivos de base de datos; no son archivos publicables del repositorio. No hay eliminaciones propuestas.

## Pendientes de publicación

Aprobación del inventario y del mensaje; commit autorizado y clon del SHA definitivo; push/tag autorizados; revisión humana de contratos/ADR y confirmación del plazo docente. El candidato local ya fue probado según [cierre-p1.md](cierre-p1.md), pero todavía no existe el commit que se publicaría. La aprobación de publicación no demuestra por sí sola aceptación académica ni anticipación de 24 horas.
