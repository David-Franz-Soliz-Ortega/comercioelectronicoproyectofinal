# Elecciones y consulta gRPC al padrón

La API CRUD REST existente se conserva. La nueva consulta de solo lectura es:

`GET /api/v1/elecciones/{idEleccion}/inscripciones/{idInscripcion}/elegibilidad`

Elecciones comprueba la existencia de su elección en su propia base y llama a `sigape.padron.v1.ServicioPadron/ConsultarElegibilidad` en el padrón. No consulta tablas ajenas. La respuesta incluye `idEleccion`, `idInscripcion`, `elegible` e `idCorrelacion`. Solo se maneja elegibilidad sintética, sin identidad ni datos personales.

## Contrato y plazos

El cliente carga el contrato compartido `compartido/contratos/grpc/padron-v1.proto` mediante `@grpc/proto-loader`; no hay un protocolo alternativo ni copia mantenida manualmente. Docker copia ese contrato al construir cada servicio. Los campos y números del `.proto` existente se conservan; se documentaron sus estados.

`PADRON_GRPC_DIRECCION` vale `padron-electoral:50051` en Compose. `PADRON_GRPC_PLAZO_MS` vale 1200 y se valida entre 1 y 10000 milisegundos. Cada llamada establece un deadline absoluto, cancela al desconectarse el consumidor HTTP y no tiene reintentos automáticos. La correlación se propaga en la solicitud protobuf y se verifica en la respuesta. Una respuesta con enum desconocido o correlación diferente produce `DATA_LOSS`.

| Estado gRPC | HTTP de la nueva ruta |
| --- | ---: |
| OK | 200 |
| INVALID_ARGUMENT | 400 |
| NOT_FOUND | 404 |
| FAILED_PRECONDITION | 409 |
| DEADLINE_EXCEEDED | 504 |
| UNAVAILABLE / RESOURCE_EXHAUSTED | 503 |
| CANCELLED | 408 |
| UNAUTHENTICATED / PERMISSION_DENIED | 401 / 403 |
| INTERNAL / DATA_LOSS / otros | 502 |

Los errores usan `application/problem+json` y añaden `codigoGrpc` y `estadoGrpc` cuando provienen de gRPC. Los errores de validación o persistencia propios de elecciones conservan su manejo REST. El cliente no devuelve mensajes internos de transporte ni credenciales. Los códigos 401/403 están previstos por el traductor; no se implementa autenticación en esta entrega.

La extensión REST está documentada en `compartido/contratos/openapi/elecciones.yaml`. Los contratos siguen pendientes de revisión humana.

## Construcción y pruebas reproducibles

Desde la raíz:

```sh
docker compose up -d --build elecciones padron-electoral
docker compose exec -T entrada-nginx nginx -t
docker compose exec -T entrada-nginx nginx -s reload
python3 microservicios/elecciones/pruebas/grpc-principal.py
```

La recarga de NGINX actualiza las direcciones de los servicios recreados. No se requiere una nueva ruta NGINX: la ruta pública ya pertenece a `/api/v1/elecciones`.

Las imágenes ejecutan pruebas del cliente y servidor durante su construcción. Para ejecutarlas localmente:

```sh
npm ci --prefix microservicios/elecciones --ignore-scripts
npm run compilar --prefix microservicios/elecciones
npm run probar-grpc --prefix microservicios/elecciones
```

Las pruebas locales configuran el contrato desde su ubicación compartida. Una ejecución local manual del servicio compilado requiere `CONTRATO_GRPC` apuntando al `.proto` compartido, además de las variables de base ya existentes.

La prueba principal crea y conserva dos elecciones, dos inscripciones y un registro de votación sintéticos. Comprueba el flujo NGINX → elecciones → padrón por gRPC → PostgreSQL propio, elegibilidad positiva y negativa, códigos de error, correlación en ambos contenedores, REST, GraphQL y RabbitMQ con sus dos consumidores.

Para probar errores de red sin alterar servicios reales, el guion inicia exclusivamente el perfil de pruebas definido en `pruebas/compose.grpc.yml`: un doble gRPC sin bases ni puertos publicados. El cliente se ejecuta dentro del contenedor de elecciones; llama al padrón real y al doble entre contenedores. El doble demora 1500 ms frente a un plazo de 100 ms y permite verificar `DEADLINE_EXCEEDED → 504`; también devuelve `UNAVAILABLE → 503`. El guion detiene únicamente ese doble en `finally`, conservando su contenedor y todos los datos. No ejecuta `down`, no elimina volúmenes ni detiene el padrón real. Requiere acceso Docker, Python 3 y la imagen `sigape-elecciones` construida por el Compose principal.

Referencias: [deadlines de gRPC](https://grpc.io/docs/guides/deadlines/), [códigos de estado](https://grpc.io/docs/guides/status-codes/), [carga dinámica en Node](https://grpc.io/docs/languages/node/basics/).

Evidencia de la ejecución real: [resultados gRPC](pruebas/resultados-grpc.md).
