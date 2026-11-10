# Resultados verificables CRUD/Swagger P1

Corte: 10/11/2026. Fuentes: AGENTS.md, guía COM-600 §8 y docs/arquitectura-p1.md. Entorno académico con datos sintéticos. No se hizo commit, push ni tag.

| Prueba real | Resultado | Evidencia |
| --- | --- | --- |
| Identidad: C/R/U/D, validación, filtros, paginación, errores | 28/28 | crud.json |
| Elecciones: mismo alcance y conflictos 409 | 32/32 | crud.json |
| Candidaturas: mismo alcance y conflictos 409 | 32/32 | crud.json |
| Padrón: mismo alcance y booleanos/asociación | 26/26 | crud.json |
| OpenAPI | Cuatro especificaciones válidas y servidas iguales a la fuente; respuestas comprobadas con esquemas | crud.json y suite |
| Carga elecciones | 10.000 insertadas; segunda carga 0; 100 páginas de 100 IDs distintos, página 101 vacía | carga-1.txt, carga-2.txt, carga.json |
| Persistencia tras reinicio de ambas bases aisladas | Cuatro registros iguales y las 10.000 elecciones todavía consultables | persistencia.json, carga-tras-reinicio.json |
| Swagger navegador aislado y principal | Cuatro interfaces cada vez; operaciones visibles, cero errores JS y un GET ejecutado por interfaz | swagger.json, swagger-principal.json |
| Conservación principal | Hash completo de 1 identidad + 10006 elecciones + 2 candidaturas + 4 inscripciones igual; mismos almacenes/volúmenes | conservacion-captura.json, conservacion.json |
| Regresión principal | 15 healthy; React servido, GraphQL de tres productores, gRPC elegible, dos consumidores independientes ACK manual/prefetch 1 y cuatro colas quorum durables | regresion-principal.json |

La suite registra 324 solicitudes REST verificadas: 118 CRUD + 101 carga + 4 persistencia + 101 carga tras reinicio, además de validaciones de contratos y Swagger. Todas pasan en los archivos finales. Conserva snapshots sintéticos de prueba y datos/volúmenes aislados; DELETE solo sobre IDs propios, nunca contra el principal. La comparación de conservación normaliza fechas al mismo instante UTC/milisegundos, porque candidaturas corrigió su representación sin alterar los documentos.

## Defectos y resultados anteriores

Los esquemas de salida heredaban entradas con additionalProperties=false y rechazaban IDs/fechas reales (fallo-modelos-previos.json). Chromium había demostrado tres Swagger rotos en la auditoría inicial. La suite nueva descubrió fechas Mongo sin zona (fallo-fechas-previo.json), nombres de solo espacios aceptados (fallo-nombre-previo.json) y correlación ausente en errores JSON Node (fallo-correlacion-previo.json). Se corrigieron productor, contratos y NGINX; los archivos de fallos conservan correcto=false y no cuentan como éxitos.

La ejecución final se reanudó después de corregir problemas; ejecucion.json identifica proyecto, puerto y carpeta originales. incidencias-ejecucion.json registra arranque, recarga NGINX y un 504 gRPC transitorio tras recrear servicios, seguido de respuesta 200. No se afirma disponibilidad ininterrumpida. Las credenciales aleatorias permanecen en un archivo privado temporal que no se incluye aquí.

## Reproducir y límites

Seguir ../../README-crud-p1.md desde la raíz del repositorio. El orquestador genera proyecto/volúmenes nuevos y guarda evidencia; admite --reanudar RUTA/ejecucion.json y --desde-swagger cuando CRUD y carga ya pasaron. Para reutilizar proyectos con datos previos no repetir la fase que exige exactamente 10000 inserciones.

Carga de 10.000 únicamente en elecciones, mediante el cargador SQL del productor y lectura REST completa; no son 10.000 POST HTTP ni pruebas de concurrencia, rendimiento o capacidad de los otros dominios. Las lecturas agregadas no prueban nuevas mutations/eventos ni todas las fallas gRPC/AMQP; se conservan las pruebas previas de esas integraciones. Swagger de candidaturas todavía usa CDN. No se certifica clon limpio, publicación/tag, rúbrica oficial ni reglas electorales completas.
