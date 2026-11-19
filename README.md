# TUVOTO

Seguimiento académico de resultados preliminares a partir de fotografías de actas. La página pública abre una única elección actual, sin login ni catálogo de elecciones.

## Implementación activa

Cuatro microservicios de negocio, cada uno propietario de su persistencia:

| Servicio | Responsabilidad | Persistencia |
| --- | --- | --- |
| identidad | Cuentas, sesiones HttpOnly, CSRF y permisos | PostgreSQL `identidad_db` |
| elecciones | Procesos, candidatos/fotografías, unidades, mesas y asignaciones | PostgreSQL `elecciones_db` |
| actas | Originales, versiones, validación de sumas y bandeja transaccional | PostgreSQL `actas_db` |
| resultados | Proyección vigente por mesa, avance y auditoría técnica de eventos | MongoDB `resultados_db`; caché pública Redis 3 s |

React, NGINX, gateway GraphQL/DataLoader, RabbitMQ y dos consumidores completan la infraestructura. Son cuatro servicios de negocio y trece contenedores en este Compose, no cuatro contenedores.

### Perfiles

Roles unificados y migración: [guía de roles](docs/presentaciones/roles.md).

- Administrador: configura organizaciones, cuentas y procesos. El único rol es ADMINISTRADOR, con el alcance de organización conservado. No pueden registrar actas.
- Operador: rol OPERADOR y asignación explícita a cada mesa de su organización. Compara cada cifra con el original y confirma la publicación. La asignación de mesa no concede roles.
- Público: sin cuenta; consulta exclusivamente la elección actual y sus resultados agregados.

AUDITOR consulta actas e informes de su organización sin modificar. ELECTOR es un valor histórico que no se asigna a nuevas cuentas TUVOTO. Se conservan los valores de esquema para no destruir usuarios existentes. No existe emisión de votos individuales ni padrón en el producto nuevo.

## Flujo de actas

1. Administrador crea organización y operadores; configura proceso, candidatos y fotografías antes de asignar mesas. El catálogo se congela al asignar la primera mesa.
2. Registra las mesas esperadas, asigna operadores y selecciona la elección visible.
3. Operador selecciona su mesa, fotografía/sube JPEG o PNG y transcribe los votos por candidatura, blancos, nulos y total. **OCR todavía no implementado**: la interfaz no inventa extracciones.
4. La API valida asignación, candidatos, cantidades y confirmación. Una suma incorrecta produce una versión observada, sin aporte nuevo al conteo.
5. Versiones inmutables y evento se insertan en una transacción PostgreSQL. Un bloqueo por mesa y versión esperada serializa capturas concurrentes. UUID de solicitud y huella permiten reintentos; una fotografía idéntica no se admite para otra mesa del mismo proceso.
6. RabbitMQ recibe el evento solo desde la bandeja persistida. Conteo y auditoría consumen independientemente con ACK manual, idempotencia y DLQ.
7. MongoDB reemplaza el estado de cada mesa por una versión mayor, sin incrementar contadores a ciegas. Mensajes antiguos no sobrescriben correcciones.

Una observación posterior conserva el último aporte publicado de la mesa hasta que exista una corrección válida. El indicador de observadas cuenta únicamente mesas pendientes, no las ya contabilizadas. Los porcentajes por candidato usan votos válidos; el progreso usa mesas esperadas. La actualización del portal es periódica (10 s tras cada consulta), no streaming instantáneo.

Los originales nunca se sobrescriben mediante la API; SHA-256 detecta igualdad/cambios binarios, **no acredita autenticidad ni evita una fotografía manipulada**. No se ofrece anonimato criptográfico ni certificación para elecciones oficiales.

## Configuración y despliegue pendiente

**TUVOTO arrancó localmente el 19 de noviembre de 2026 en http://127.0.0.1:8890, con recursos independientes. No se desplegó sobre SIGAPE ni sobre sigape-auth-test.** El Compose activo se llama `tuvoto`, usa recursos nuevos y exige variables `TUVOTO_*`; no utiliza las credenciales de `.env` antiguo. No ejecutar `down`, `down -v`, `prune` ni limpiezas sobre los proyectos anteriores.

1. Copiar `.env.example` a `.env.tuvoto` privado (0600) y sustituir TODOS los marcadores por valores aleatorios distintos. Para claves internas, mínimo 32 caracteres. No versionar ese archivo.
2. Elegir puerto libre (plantilla: 8890) y origen exacto `http://127.0.0.1:8890`. Para HTTP local, `TUVOTO_COOKIE_SEGURA=false`; HTTPS requiere true.
3. Validación sin revelar valores: `docker compose --env-file .env.tuvoto -p tuvoto config --quiet`.
4. Solo al autorizar el despliegue: `docker compose --env-file .env.tuvoto -p tuvoto up -d --build`.
5. Primera cuenta global: CLI existente `microservicios/identidad/src/administrar.ts` compilada como `dist/administrar.js`, entrada JSON por stdin privado, nunca contraseña en argumentos, archivos o chat. Bootstrap se niega si ya existe un ADMINISTRADOR con alcance global. No ejecutarlo automáticamente.

El nuevo proyecto arranca sin datos demostrativos ni migración automática desde SIGAPE. Candidaturas antiguas no se copian silenciosamente: requieren un mapeo explícito de proceso, cargo, unidad y organización. La nueva funcionalidad de candidatos ya pertenece a Elecciones.

## Contratos y consultas

- REST: `compartido/contratos/openapi/*.openapi.json`; copias accesibles por `/api/v1/documentacion/{identidad,elecciones,actas,resultados}`.
- GraphQL: `compartido/contratos/graphql/tuvoto.graphql`, `POST /graphql`. Query `portal` pública y mutation `registrarActa` autorizada en el productor.
- Evento: `compartido/contratos/eventos/acta.actualizada.v1.schema.json`. No contiene imágenes, sesiones ni identificador del operador.
- Fotografía de acta: privada y condicionada a asignación; las fotografías de candidatos de la elección actual son públicas.

## Pruebas

- `npm --prefix frontend run probar` y `npm --prefix frontend run compilar`.
- `npm --prefix gateway/graphql run verificar`.
- TypeScript: `tsc -p microservicios/identidad/tsconfig.json --noEmit` y el equivalente de elecciones.
- `python3 -m unittest discover -s microservicios/actas/pruebas` (persistencia se omite sin ejecutor aislado).
- `python3 -m unittest discover -s microservicios/resultados/pruebas-tuvoto`.
- Con dependencias Python instaladas, `python microservicios/actas/pruebas/ejecutar-postgres.py`: PostgreSQL efímero, tmpfs, puerto loopback, sin volúmenes existentes.
- `python microservicios/resultados/pruebas-tuvoto/ejecutar-mensajeria.py`: MongoDB/RabbitMQ efímeros para entregas repetidas, correcciones, ACK y DLQ. Retira exclusivamente sus contenedores de prueba.

## Código retirado y pendientes

El respaldo privado `.respaldo-local/` conserva el material SIGAPE retirado, incluyendo los cambios locales previos; no se versiona ni entra en imágenes Docker. No participa en las imágenes nuevas. Los documentos SIGAPE retirados describían aquella entrega y no prueban TUVOTO. Se mantienen datos y volúmenes anteriores.

Pendientes explícitos: OCR por formato, revisión visual en navegador, prueba completa HTTP entre los cuatro servicios nuevos, prueba de carga y migración revisada de datos históricos. Los tests aislados no sustituyen esa validación ni demuestran capacidad para un número concreto de visitantes. La conformidad de gRPC y de los cuatro CRUD requiere las pruebas indicadas en la matriz oficial.

## Requisitos oficiales y ejecución por etapas

Destino actual: **demostración local**, sin despliegue público. Ver [matriz de P1/P2/P3](docs/presentaciones/requisitos.md) y [arquitectura y ADR](docs/presentaciones/arquitectura-p1.md). El nuevo alcance debe conservar gRPC, cuatro CRUD y tres roles autenticados; no se considera cumplida la rúbrica por existir código sin prueba. El público sin login no cuenta como tercer rol. Las evidencias SIGAPE no prueban TUVOTO.
