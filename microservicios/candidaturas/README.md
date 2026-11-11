# Candidaturas — Integrante 2, Etapa 1

Servicio existente de Python/FastAPI con MongoDB, conservando el contrato compartido [candidaturas.yaml](../../compartido/contratos/openapi/candidaturas.yaml). La etapa deja ejecución aislada, conexión comprobada, dos registros sintéticos y pruebas reproducibles.

El reparto vigente asigna al integrante 2 **Candidaturas y Padrón electoral**. Votación pertenece al integrante 3. No se crea `ms-votos` ni una tabla que relacione elector y candidato. El modelo actual es académico y su contrato sigue marcado como propuesta pendiente de revisión.

## Ejecutar solo la parte del integrante 2

Desde la raíz del repositorio, con Docker Engine y Compose disponibles:

```sh
sh microservicios/padron-electoral/desarrollo/etapa1.sh iniciar
sh microservicios/padron-electoral/desarrollo/etapa1.sh cargar
sh microservicios/padron-electoral/desarrollo/etapa1.sh probar
```

El inicio genera los dos `.env` con claves distintas y permisos 600, conservando cualquier archivo existente. Construye secuencialmente los servicios, espera su salud y crea volúmenes propios. El constructor envía únicamente una lista explícita de fuentes y contratos mediante un contexto tar; los `.env` quedan fuera incluso con Docker clásico. Para construir este entorno usa el script `iniciar`. La primera descarga y la construcción necesitan memoria y disco adicionales a los límites de ejecución.

- Candidaturas: <http://127.0.0.1:8003/salud>.
- Padrón: <http://127.0.0.1:3004/salud>.
- Swagger de Candidaturas: <http://127.0.0.1:8003/docs>.
- API versionada: `/api/v1/candidaturas` y `/api/v1/salud`.

El proyecto `sigape-integrante2-candidaturas` contiene únicamente esta API y MongoDB. No comparte volúmenes ni credenciales con el Compose del equipo. MongoDB y gRPC no publican puertos; HTTP se limita a la interfaz local. Los cuatro contenedores de ambos proyectos tienen un límite conjunto de **896 MiB**: MongoDB 512, PostgreSQL 128 y cada API 128. No es una estimación de consumo ni incluye Docker, caché del sistema o construcción. MongoDB usa 256 MiB de caché WiredTiger; el cliente mantiene como máximo cinco conexiones por servidor.

Para liberar memoria conservando datos:

```sh
sh microservicios/padron-electoral/desarrollo/etapa1.sh detener
```

Si un puerto está ocupado, cambia `PUERTO_HTTP_CANDIDATURAS` o `PUERTO_HTTP_PADRON` en el `.env` del servicio. El script aplica estas variables. Cambiar una contraseña después de inicializar un volumen requiere actualizar el usuario correspondiente en la base; editar `.env` por sí solo no migra credenciales.

## Persistencia y datos de ejemplo

La colección propia `candidaturas_db.candidaturas` se crea al inicializar los índices del servidor. Sus campos son `_id` (expuesto como `idCandidatura`), `idEleccion`, `nombre`, `tipo`, `estado`, `creadoEn` y `actualizadoEn`. El usuario MongoDB tiene permisos de lectura/escritura únicamente en esta base.

`python -m app.cargar_demostracion` dentro del contenedor inserta, mediante `$setOnInsert`, una candidatura individual y una lista en borrador. Repetirlo conserva los mismos IDs, fechas y cualquier edición. Ambas usan `idEleccion=20000000-0000-4000-8000-000000000001`: es una referencia sintética; la carga no crea ni modifica elecciones en otro servicio.

```sh
curl --fail http://127.0.0.1:8003/salud
curl --fail 'http://127.0.0.1:8003/api/v1/candidaturas?limite=2'
```

## Pruebas y archivos

`pruebas/test_etapa1.py` comprueba salud, contrato servido, documentación, carga repetible, CRUD, persistencia real en MongoDB, filtros, validación y bloqueo de borrado fuera de borrador. Una prueba controlada comprueba el error 503 cuando MongoDB no responde. Las pruebas limpian exclusivamente los registros que crean; conservan los dos ejemplos.

`app/servidor.py` sirve la API; `app/cargar_demostracion.py` carga ejemplos; `compose.etapa1.yml` y `desarrollo/inicializar-mongo.js` crean el entorno propio. `.env.example` documenta las variables, y `.env` queda fuera de Git. No se añaden dependencias de ejecución.

## Integración con el equipo

El Dockerfile original y las variables del Compose compartido siguen funcionando. Las rutas REST y los campos mantienen el contrato existente. `GET /salud` comprueba MongoDB y devuelve 503 en su ausencia; la API usa un solo proceso Uvicorn, sin recarga automática. En el Compose compartido la salud se publica por NGINX como `/api/v1/salud/candidaturas`.

Quedan fuera de esta etapa autenticación, reglas electorales completas, aprobación definitiva de contratos y nuevas integraciones. No existe un contrato de eventos propio de Candidaturas que haya que implementar en esta entrega; `voto.registrado.v1` corresponde a Votación y Resultados.
