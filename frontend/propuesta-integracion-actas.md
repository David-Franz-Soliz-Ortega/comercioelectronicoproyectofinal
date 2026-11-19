# Propuesta: de las actas al observatorio electoral

Esta propuesta acompaña al rediseño del frontend. No modifica microservicios, infraestructura ni contratos. Consulta de fuentes: 19 de noviembre de 2026.

## Qué necesita resolver SIGAPE

El objetivo descrito es informar cómo avanza la elección de autoridades por universidad, facultad y carrera. Para ese objetivo, la fuente son las actas del escrutinio presencial. No hace falta convertir inicialmente SIGAPE en una plataforma de votación por internet.

Actualmente `elecciones` y `candidaturas` tienen modelos mínimos, sin facultad, carrera ni cargo. `votacion` registra participación sintética sin elección de candidatura, y `resultados` cuenta esos eventos por elección. El contrato GraphQL solo expone elecciones, candidaturas e inscripciones. Por ello no puede obtenerse un porcentaje electoral válido dividiendo el conteo actual de eventos entre candidaturas o inscripciones.

## Lo que publican las fuentes oficiales

El apartado 11 del [instructivo electoral, Resolución 018/2026 de la USFX](https://usfx.bo/Documentos/RESOLUCION_ELECTORAL_N_018-2026.pdf) establece que, terminado el escrutinio, el presidente de mesa reúne los originales de apertura, clausura y escrutinio en un sobre identificado por mesa y ánfora. El sobre se introduce con el material electoral en el ánfora, que se precinta y entrega a la Comisión Electoral para el escrutinio final. El documento también contempla firmas y constancia de observaciones o impugnaciones.

La [página oficial de resultados 2026](https://usfx.bo/resultados-finales-claustros-2026/) consultada muestra Rectorado y Vicerrectorado, con votos y porcentajes separados entre docentes y estudiantes, y ánforas escrutadas y pendientes. En las fuentes consultadas no se identificó una API pública documentada ni un repositorio completo de imágenes de actas por facultad y carrera. Esto no demuestra que no existan: habría que solicitar acceso a la Comisión Electoral.

La [publicación institucional sobre la primera vuelta](https://usfx.bo/2026/11/11/la-eleccion-de-autoridades-universitarias-fortalece-la-democracia-universitaria-resultados-de-la-primera-vuelta/) confirma que también se informaron resultados de decanos y directores, y explica que la metodología de ponderación cambia para la segunda vuelta. Conviene obtener el reglamento aplicable y validar su interpretación con la Comisión antes de automatizar proclamaciones.

## Cómo llevar esos datos a la página

1. **Acordar una fuente autorizada.** Solicitar actas digitalizadas y un archivo estructurado de resultados a la Comisión Electoral. Preferir una API o exportación CSV/JSON oficial cuando esté disponible. La captura manual de una copia autorizada sirve para un piloto; una noticia es una referencia, no reemplaza el acta de cada mesa.
2. **Recibir y conservar el documento.** Guardar PDF o imagen en almacenamiento de objetos, y en la base los metadatos, procedencia, huella SHA-256, versión y fecha de recepción. La copia pública debe excluir datos personales o firmas cuando corresponda; el original puede requerir acceso restringido. Las claves de almacenamiento nunca llegan al frontend.
3. **Transcribir y revisar.** Registrar votos por candidatura, blancos y nulos. Un OCR puede proponer valores, pero una persona debe contrastarlos con el documento. Usar estados recibida, en revisión, observada, validada y sustituida; ninguna propuesta de OCR se publica automáticamente.
4. **Validar antes de contar.** Comprobar números enteros no negativos, correspondencia de elección/candidatura, sumas, estamento, mesa y duplicados. Cada corrección conserva el original y una nueva versión. Definir una clave documental única según el formato oficial; no asumir que un documento siempre cubre un solo cargo.
5. **Publicar cambios validados.** Tras persistir una validación, emitir un evento versionado, por ejemplo `acta.validada.v1`, mediante una bandeja de salida. `resultados` mantiene su propia proyección; deduplica eventos, considera la versión vigente y recalcula al sustituir un acta. Reprocesar un evento no debe sumar sus votos otra vez.
6. **Consultar desde el portal.** GraphQL compone las consultas; la lógica de escrutinio queda en `resultados`. Empezar con actualización manual o consultas periódicas moderadas. SSE o suscripciones pueden incorporarse después si hace falta actualización inmediata, mostrando siempre la hora y el estado del cómputo.

Este recorrido es una propuesta de implementación; no describe un sistema digital interno confirmado de la USFX.

## Cambios por servicio

| Componente | Siguiente responsabilidad propuesta |
| --- | --- |
| Nuevo `actas` | Recepción de documentos autorizados, revisión, observaciones, versiones y trazabilidad. Base lógica propia; publicación de validaciones por RabbitMQ. |
| `elecciones` | Cargo, ámbito universitario/facultativo/de carrera, convocatoria, ronda, mesas o ánforas esperadas por estamento y versión de las reglas aplicables. |
| `candidaturas` | Relación con elección y cargo; denominación y estado de habilitación. Perfiles y fotografías solo cuando exista autorización y una necesidad concreta. |
| `resultados` | Agregación de actas vigentes y validadas por candidatura, elección y estamento; blancos, nulos, avance, corte temporal y estado preliminar/oficial. La declaración oficial necesita procedencia verificable. |
| `identidad` | Autenticación y roles separados para capturar, revisar y publicar. La consulta pública puede seguir siendo de lectura. |
| `gateway/graphql` | Consultas paginadas por ámbito y cargo, composición mediante DataLoader y autorización de operaciones; sin apropiarse del cálculo electoral. |
| `padron-electoral` | Mantenerlo sintético en esta etapa. No incorporar datos personales para mostrar un observatorio; los denominadores agregados deben tener una fuente autorizada. |
| `votacion` | Conservar su alcance académico actual. La ingesta de actas no debe presentarse como voto emitido por internet ni reutilizar el evento actual como si contuviera una selección. |

Un servicio `estructura-academica` podría gestionar facultades y carreras si varios dominios necesitan ese catálogo con una administración independiente. Para el primer piloto, puede ser un módulo de `elecciones`, expuesto mediante contrato; separar un microservicio adicional solo cuando su responsabilidad lo justifique.

## Qué debe devolver el contrato de resultados

Proponer, revisar y documentar en `compartido/contratos/` antes de implementar:

- Identificadores de elección, ronda, cargo, facultad y carrera, cuando correspondan.
- Estamento explícito: docente o estudiantil. Un resultado combinado requiere una fórmula y una versión de regla aprobadas.
- Votos por candidatura, total válido, blancos, nulos y total emitido, con denominador del porcentaje documentado.
- Actas esperadas, recibidas, observadas, validadas y computadas; evitar presentar estados superpuestos como sumas disjuntas.
- Fecha del corte, versión del cómputo, carácter preliminar/oficial y referencias a las actas que lo sustentan.
- Distinción entre ausencia de información y un resultado de cero votos.

En la demostración visual actual: porcentaje de candidatura = votos de esa candidatura / votos válidos del estamento × 100. El porcentaje de actas usa actas computadas / actas esperadas. Ninguno permite, por sí solo, declarar una autoridad ganadora. La participación necesita su propio denominador de habilitados.

## Orden sugerido de trabajo

Primero acordar fuente, formato de actas y reglas. Después pilotar una facultad con datos sintéticos: cargar un acta, revisarla, validarla y verla reflejada en el portal. Verificar duplicación, corrección, anulación, empate, ausencia de actas y separación de estamentos. Luego ampliar el contrato y la cobertura a otras facultades y carreras.

Mantener bases independientes, contratos versionados y productor, consumidor y pruebas coordinados. Docker Compose, NGINX y RabbitMQ existentes son suficientes para esta primera integración; la necesidad de Kubernetes u otros servicios se puede evaluar más adelante.
