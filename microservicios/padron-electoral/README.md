# Padrón electoral: REST y gRPC

Conserva su CRUD REST académico y añade `sigape.padron.v1.ServicioPadron/ConsultarElegibilidad` en el puerto interno 50051. Usa exactamente el contrato compartido `compartido/contratos/grpc/padron-v1.proto`, copiado por Docker en `/app/padron-v1.proto`. No cambia los campos ni los números protobuf.

El servidor valida correlación y UUID, consulta exclusivamente su tabla propia `inscripciones`, verifica que `id_proceso_electoral` corresponde a `id_eleccion` y devuelve el enum de elegibilidad sintética. No recibe identidad ni selección. La base no se reinicializa ni se modifica con la consulta gRPC.

Estados: `INVALID_ARGUMENT` para datos mal formados, `NOT_FOUND` para inscripción ausente, `FAILED_PRECONDITION` para elección distinta, `DEADLINE_EXCEEDED` para plazo agotado, `UNAVAILABLE` para fallos de conexión de persistencia, `RESOURCE_EXHAUSTED` para capacidad de PostgreSQL agotada e `INTERNAL` para errores inesperados. El cliente recibe un mensaje de dominio breve; los errores SQL internos no se exponen.

El deadline recibido acota el timeout de lectura del driver PostgreSQL a un máximo de 1000 ms. Si la llamada se cancela, su resultado ya no se envía. El timeout del driver no constituye una garantía de cancelación inmediata de una consulta ya en ejecución en PostgreSQL. La consulta es una lectura indexada por la clave primaria de inscripción.

`GRPC_DIRECCION=0.0.0.0:50051` se configura en Compose, en `red_interna`, sin publicar el puerto en el anfitrión. `CONTRATO_GRPC` permite indicar otro archivo de contrato en desarrollo; en Docker la ubicación predeterminada ya existe. El servidor HTTP arranca después de inicializar persistencia y enlazar gRPC; por tanto, un fallo de enlace evita reportar salud REST antes de arrancar el protocolo nuevo. Los endpoints y las respuestas REST anteriores se conservan.

Ambos transportes tienen cierre ordenado al recibir SIGTERM/SIGINT. El cliente de elecciones tiene deadline obligatorio. El transporte de desarrollo usa HTTP/2 sin TLS dentro de la red interna de Compose; autenticación/mTLS y revisión humana del contrato quedan pendientes.

Pruebas del servidor:

```sh
npm ci --prefix microservicios/padron-electoral --ignore-scripts
npm run compilar --prefix microservicios/padron-electoral
npm run probar-grpc --prefix microservicios/padron-electoral
```

Para la prueba real entre contenedores y las verificaciones de REST, GraphQL y RabbitMQ, consulte `../elecciones/README.md` y ejecute desde la raíz `python3 microservicios/elecciones/pruebas/grpc-principal.py`.
