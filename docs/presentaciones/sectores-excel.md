# TUVOTO: sectores, vueltas e importación Excel

Ampliación del prototipo local, desarrollada en `funciones-sectores-excel`. No implementa voto individual, OCR ni proclamaciones oficiales. Mantiene los cuatro servicios y los roles ADMINISTRADOR, OPERADOR y AUDITOR.

## Configuración por elección

Cada elección sigue correspondiendo a un cargo y una vuelta independientes. El ámbito es un texto configurable: universidad completa, facultad, grupo de carreras, municipio u otro. No se introduce una jerarquía territorial ni se infieren integrantes de un grupo por su nombre. La unidad de cada mesa permite desglosar resultados por carrera, facultad o distrito.

Opciones nuevas al crear una elección:

- Ámbito o grupo participante.
- Primera o segunda vuelta. La segunda referencia una primera de la misma organización, cargo y ámbito; sus participantes se seleccionan de la primera, reciben nuevos IDs y conservan el vínculo. Se admiten dos participantes, sin borrar resultados anteriores.
- Separar mesas por sectores, desactivado por defecto. Cada sector tiene código y nombre.
- Ponderación, independiente de la separación: desactivada suma todos los votos con igual valor; activada aplica los pesos configurados, cuya suma debe ser exactamente 100 %. Los pesos se almacenan en centésimas de porcentaje, no como cantidades de votos.
- Indicador académico de segunda vuelta, desactivado por defecto. Puede evaluar un porcentaje total —ponderado solo si se activó ponderación— o exigir el umbral en cada sector. Se configura si debe superar o alcanzar el porcentaje.

Las opciones quedan bloqueadas al abrir la recepción. Mientras siga en borrador se pueden ajustar, incluso con mesas asignadas. Las mesas ya registradas no se pueden dejar referenciando sectores eliminados. La vuelta y su referencia se fijan al crear la elección. Los cambios históricos nunca se reclasifican silenciosamente: si ya existen actas, prepara otra elección para un esquema diferente.

El indicador no proclama ganadores: permanece provisional con mesas pendientes o actas por revisar. No redistribuye pesos si un sector carece de votos válidos. Empates en el puesto de clasificación requieren revisión. Una vista filtrada por unidad no determina el resultado global. La segunda vuelta la crea y configura el administrador; no se genera automáticamente una tercera.

## Flujo administrativo

1. Crear o seleccionar organización y elección.
2. Completar ámbito, vuelta y opciones antes de abrir la recepción.
3. Registrar/importar todos los candidatos; agregar fotografías después.
4. Registrar/importar mesas indicando su unidad y, si corresponde, sector.
5. Crear/importar operadores de la organización.
6. Registrar/importar asignaciones y revisar la lista persistida.
7. Publicar. Cada sector configurado debe tener mesas; la segunda vuelta requiere dos participantes.

El portal abre la elección destacada y permite seleccionar otras elecciones publicadas de la misma organización. Cada una mantiene sus propios candidatos, mesas, actas y conteo. La selección de la elección destacada no oculta las publicadas previamente. Las fotografías de candidatos publicados siguen disponibles.

## Excel: formatos y límites

Desde cada sección se descarga su plantilla, con una sola hoja y encabezados exactos. Archivo XLSX máximo 2 MB; no se admiten macros, enlaces externos, fórmulas, fechas, archivos cifrados ni contenido descomprimido superior a 20 MB. El servidor comprueba los tamaños antes de cargar el libro. Se utiliza [ExcelJS](https://github.com/exceljs/exceljs) con versión fijada 4.4.0.

| Plantilla | Columnas | Límite por archivo |
| --- | --- | --- |
| Candidatos | `nombre`, `orden` opcional | 100; máximo 100 candidatos en la elección |
| Mesas | `codigo`, `unidad`, `sector` opcional solo sin separación | 2.000 |
| Asignaciones | `usuario`, `codigoMesa` | 2.000 filas, hasta 100 operadores distintos |
| Operadores | `usuario`, `contrasena` | 100 |

Para sectores puede usarse un código configurado o un nombre que lo identifique inequívocamente. En segunda vuelta los nombres importados deben identificar inequívocamente candidatos de la primera; también se pueden escoger manualmente por su vínculo. Las fotografías se completan después; los participantes vinculados copian la foto que ya tenía su candidatura de origen.

La vista previa valida campos, duplicados y referencias y devuelve una huella del archivo ligada al contexto. Confirmar requiere el mismo archivo, huella y aceptación explícita; el servidor revalida con los datos vigentes. Un error cancela el lote completo. No se sobrescriben candidatos, mesas, asignaciones o usuarios existentes.

### Un archivo por módulo para toda la institución

Se conservan las plantillas individuales por cargo. Además, en **Candidatos**, **Mesas**
y **Asignar operadores** está **Importar … de todos los cargos desde Excel**. **Elección**
ya permite reunir los cargos en un archivo, y **Usuarios** reúne los operadores.
No se necesita un archivo distinto para cada decano o director.

Las secciones y descargas distinguen **todos los cargos** de **solo este cargo**:
`candidatos-todos-los-cargos.xlsx` utiliza `cargo`, `ambito`, `vuelta`, `nombre`, `orden`;
`candidatos-solo-este-cargo.xlsx` utiliza únicamente `nombre` y `orden` opcional.
No se deben mezclar los formatos. Si se presenta un archivo conjunto en la sección individual,
la API responde 422 indicando las columnas admitidas y React ofrece acceso a la sección
conjunta. No se redirige ni se importa el contenido automáticamente. El lector diferencia
un exceso de filas de unas columnas incorrectas; siguen vigentes los límites y rechazos
por fórmulas, contenido comprimido inseguro y campos inválidos.

Las importaciones muestran el campo controlado `detail` del formato de error compartido
(también admiten `detalle` para compatibilidad) en 400/409/422. No muestran HTML, errores
internos 5xx ni cuerpos de errores de autenticación. La confirmación conserva sus validaciones
de rol, organización, estado, referencias, duplicados y revisión del archivo.


| Archivo conjunto | Columnas de una única hoja |
| --- | --- |
| Cargos universitarios | `cargo`, `facultad`, `grupoCarreras`, `carreras` (separadas por `;`) |
| Candidatos | `cargo`, `ambito`, `vuelta`, `nombre`, `orden` opcional |
| Mesas | `cargo`, `ambito`, `vuelta`, `codigo`, `unidad`, `sector` |
| Operadores | `usuario`, `contrasena` (archivo privado, nunca versionar) |
| Asignaciones | `cargo`, `ambito`, `vuelta`, `usuario`, `codigoMesa` |

Los tres nuevos archivos conjuntos admiten 2.000 filas, 200 destinos y 2 MB; se mantiene
el máximo de 100 candidatos por cargo y de 100 operadores distintos por lote de asignación.
`vuelta` vacía equivale a 1. La institución se toma del contexto autorizado, nunca del Excel.
Se comprueban cargo, ámbito y vuelta; no se emparejan facultades mediante aproximaciones.
Si falta un destino único, se elige explícitamente su UUID en la revisión. Solo aparecen
cargos en borrador del mismo tipo y vuelta; el backend comprueba de nuevo todas las condiciones.
Si el cargo aún no existe, hay que crearlo antes. Una etiqueta distinta no crea otro cargo.

Cada cambio de destino obliga a revisar otra vez. La huella liga archivo, actor, institución,
módulo y destinos reales. Confirmar bloquea los cargos en orden estable y revalida dentro
de una única transacción: si falla cualquier fila, no se importa ninguna. Se conservan los
registros existentes y se rechazan duplicados incluso si varias etiquetas apuntan al mismo
cargo. Iniciar un cargo entre revisión y confirmación cancela el lote entero.

REST: `/api/v1/configuracion/importaciones-generales/{tipo}/plantilla`,
`/previsualizar` y `/confirmar`. Mantienen sesión, rol administrativo, alcance y CSRF.
El segundo POST acepta el mismo archivo y las `asociaciones` revisadas, más `huella` y
`confirmar: true`. Los endpoints individuales siguen disponibles sin cambios de contrato.

Orden práctico: cargos → candidatos y mesas → operadores → asignaciones → revisión e inicio.
Se pueden asignar operadores antes de terminar los candidatos; solo el inicio exige completar
la configuración. En carreras y sectores se mantienen las reglas de cada cargo.

Pruebas ejecutadas en el entorno sintético: carga de candidatos, mesas y asignaciones en dos
cargos; mismo código de mesa en cargos distintos; duplicados; lote inválido sin cambios;
selección explícita ante ambigüedad; UUID de otra institución rechazado; manipulación de
huella/destinos; confirmación concurrente; 401/403 y bloqueo tras iniciar. Ver los resultados
fechados en `pruebas/ampliacion/resultados.json`. Los nombres electorales enviados por el
usuario se mantienen en archivos privados fuera de Git y no se importan automáticamente.

### Contraseñas del prototipo

El Excel de operadores contiene contraseñas iniciales legibles: usar exclusivamente claves de demostración, distintas por persona, sin contraseñas personales reutilizadas. La columna debe ser texto; mínimo 12 caracteres y máximo 72 bytes UTF-8. La vista previa devuelve únicamente una máscara, nunca la clave. El archivo se procesa en memoria y no se conserva en el servidor; las claves se guardan con bcrypt coste 12. No se escriben en logs, auditoría o reportes. Reimportar un usuario existente produce conflicto y no cambia su contraseña.

Nunca subir archivos de operadores a Git. El mecanismo de activación individual, HTTPS productivo, auditoría avanzada de archivos y evaluación de dependencia/seguridad de producción siguen siendo trabajo posterior.

## Captura y documentos

Cada mesa tiene un sector inmutable después de asignarse. Actas recibe ese sector del contrato gRPC de Elecciones; el operador no puede enviarlo para cambiarlo. La foto sigue acompañando una transcripción manual y una confirmación humana.

Cuando una fotografía contiene varios cargos, el operador puede seleccionar un acta ya registrada para otro cargo del mismo sector. Debe estar autorizado a consultar también la mesa de origen. Se guarda la referencia y una copia del original; no se confunden los IDs ni los votos de ambos cargos. No se permite reutilizar por referencia una fotografía entre sectores ni saltar la prohibición de duplicarla en otra mesa de la misma elección. Las correcciones mantienen versiones y outbox en la misma transacción.

El evento `acta.actualizada.v1` añade `sector` como campo opcional para admitir eventos históricos; nunca incluye credenciales, fotografía ni identidad del operador. Los consumidores nuevos aceptan ambos formatos. Compose inicia Actas cuando ambos consumidores están saludables para evitar publicar el campo nuevo ante consumidores antiguos.

## Contratos

- REST/OpenAPI 0.2.0: contratos de Identidad, Elecciones, Actas y Resultados actualizados. Las plantillas e importaciones requieren sesión, rol administrativo, alcance de organización y CSRF en escritura.
- gRPC `mesa-v1.proto`: campos aditivos `sector` y `nombre_proceso`; deadline y códigos de estado conservados.
- GraphQL: `eleccionesPublicadas`, filtro `portal(idProceso, unidad)`, resultados por sector, porcentaje ponderado e indicador de regla; mutation con fotografía o referencia a acta de origen.
- SQL: migraciones aditivas; procesos agregan `configuracion` JSON y `publicado`; mesas agregan `sector=general`; candidatos agregan vínculo de origen; actas agregan sector y referencia. Las cuentas y contraseñas existentes no se transforman.

## Pruebas reproducibles y evidencia

- `python3 microservicios/elecciones/pruebas/ejecutar-modelo.py`: PostgreSQL efímero en tmpfs, migración del esquema anterior e idempotencia, XLSX real y reglas de configuración.
- `python -m unittest discover -s microservicios/resultados/pruebas-tuvoto -v`: votos iguales, pesos 30/70 y 50/50, sector sin válidos, mayoría por sector, empate, observación, filtro y segunda vuelta.
- `python microservicios/actas/pruebas/ejecutar-postgres.py`: siete pruebas SQL reales, incluyendo 10.000 registros sintéticos, concurrencia y rollback.
- `python3 pruebas/ampliacion/preparar-entorno.py`: crea un proyecto Docker de pruebas nuevo en 18891, con claves privadas, volúmenes/redes exclusivos y límites de memoria. No se conecta al proyecto `tuvoto` ni a SIGAPE.
- `python3 pruebas/ampliacion/probar-flujo.py`: flujo HTTP real por NGINX, autenticación, cuatro importaciones, GraphQL, gRPC, outbox, dos consumidores, pesos, fotos referenciadas, concurrencia, rondas y separación de organizaciones. Crea exclusivamente datos sintéticos del entorno de prueba.
- `node pruebas/ampliacion/probar-interfaz.mjs`: Firefox ya instalado, perfil temporal y cuenta sintética; prueba login, guía, formulario y tres tamaños de pantalla, sin crear elecciones ni actas.
- Evidencias sin secretos: `pruebas/ampliacion/resultados.json` e `interfaz.json`. Las credenciales sintéticas quedan únicamente en el directorio privado temporal del entorno, fuera de Git.

No equivalen a certificación electoral, OCR, carga de 5.000 usuarios ni cumplimiento completo de P2/P3. Los volúmenes de pruebas se conservan; no se usa `down -v`, prune ni restauraciones automáticas que borren datos.

## Actualización local verificada — 20 de noviembre de 2026

El proyecto `tuvoto` quedó actualizado con 13 contenedores saludables. Antes se crearon respaldos PostgreSQL privados bajo `.respaldo-local/`, excluidos de Git/Docker. La comparación de cantidades y huellas calculadas dentro de PostgreSQL confirmó la conservación de usuarios, hashes de contraseña, sesiones, roles, organizaciones y registros electorales existentes; los archivos de control no contienen filas ni secretos. Los contenedores de infraestructura y los estados de otros proyectos se conservaron.

Acceso verificado: http://127.0.0.1:8890 y panel http://127.0.0.1:8890/#panel. Se comprobaron los recursos React compilados, GraphQL público y respuestas 401 en sesión/importación anónimas. NGINX validó su configuración y recargó la ruta de importación. Los contratos OpenAPI 0.2.0 y las pantallas Swagger están disponibles. Ver `pruebas/ampliacion/despliegue.json`.

Las pruebas terminaron con 12 casos React, 4 del gateway, 2 de permisos de Identidad, 10 de Resultados, 3 de modelo/migración/Excel y 7 SQL de Actas aprobados, además de los ocho grupos HTTP y Firefox en 390, 768 y 1440 px. Las operaciones electorales de prueba se ejecutaron exclusivamente en recursos sintéticos aislados.

Pendiente de red local: la interfaz Wi-Fi cambió a `172.23.166.16`, mientras el archivo privado existente publica `192.168.100.36:8890`. No se declara probado acceso desde el celular; debe ajustarse el enlace y el origen permitido de la configuración privada cuando se confirme la red de demostración. No se cambian credenciales para resolverlo.

## Beta: estados básicos de la elección

- **Borrador:** editar configuración, candidatos, fotos, mesas y asignaciones; retirar el borrador mediante eliminación lógica, sin borrar filas. No puede recibir actas ni mostrarse como resultado público.
- **En recepción:** apertura manual confirmada por el administrador; configuración e importaciones de la elección bloqueadas. Los operadores asignados registran, corrigen o anulan actas conservando versiones.
- **Cerrada:** cierre manual confirmado; se conservan resultados públicos e historial, pero el backend rechaza registros, correcciones y anulaciones con 409. Destacar estos resultados no reabre la recepción.
- **Archivada:** únicamente desde cerrada, oculta del portal público; el administrador conserva el acceso al catálogo y al historial. Las actas y sus versiones permanecen almacenadas. No se permite reapertura ni eliminación de elecciones que ya salieron de borrador.

Se gestiona desde **Estado y publicación** en el panel. Cada transición registra actor, estado anterior/nuevo y fecha en la base propia de Elecciones. Para simplificar la presentación no se incluyen programación automática ni reapertura excepcional.

La migración asigna `recepcion` a elecciones ya publicadas, `archivada` a las archivadas y `borrador` al resto, únicamente cuando todavía no existe estado. No reinicia estados en posteriores arranques ni cambia usuarios/contraseñas.

### Cierre y escrituras simultáneas

Actas obtiene una reserva interna por gRPC, con deadline y autenticación de servicio, antes de persistir. La adquisición y el cierre bloquean la misma fila de Elecciones: si existe una reserva, cerrar devuelve 409. Actas libera después de confirmar o revertir su transacción; las correcciones y anulaciones siguen la misma regla. Si el cierre ganó primero, no se concede reserva.

Las reservas no vencen automáticamente: una caída abrupta puede dejar el cierre bloqueado y requiere revisión técnica del registro en curso, verificando previamente que no haya una escritura activa. Se prioriza impedir escrituras tardías; no se ofrece un botón para forzar el cierre o borrar reservas. No constituye certificación electoral.

Prueba reproducible: `python3 pruebas/ampliacion/probar-flujo.py` en el entorno sintético preparado. Incluye reserva gRPC real frente a cierre, 403 al operador, confirmación requerida, 409 en todos los tipos de escritura cerrada, archivo con historial y conteo conservados, y eliminación lógica del borrador. Las pruebas SQL de migración verifican que los estados no se reinician.

La beta de estados quedó desplegada y verificada por lectura en TUVOTO: 13 contenedores saludables, cuatro cuentas activas sin cambios, cero reservas pendientes y huellas previas conservadas. Las elecciones publicadas existentes permanecen en recepción; no se cerraron ni archivaron datos del usuario durante las pruebas.

## Cargos universitarios y grupos de carreras

En **Elección → Cargos → Importar cargos desde Excel**, descargar la plantilla XLSX,
llenar una hoja, revisar los errores y confirmar. Se crean hasta 100 cargos en borrador
por archivo. No se eliminan registros ni se publica la elección al importar. El nombre de la institución se completa automáticamente.
Los cargos manuales de universidad también ofrecen Rector, Vicerrector, Decano y Director;
los tipos Municipio y Otra conservan sus cargos libres.

Ejemplos sintéticos de filas (no son datos operativos):

| cargo | facultad | grupoCarreras | carreras |
| --- | --- | --- | --- |
| Rector | | | |
| Vicerrector | | | |
| Decano | Tecnología | | |
| Director | Tecnología | Grupo A | Sistemas; Civil; Eléctrica |
| Director | Tecnología | Grupo B | Química; Industrial |

Para cada Director se guardan facultad, grupo y lista de carreras en la configuración
propia de Elecciones. Las mesas se vinculan al cargo por ID y su unidad debe ser una de
esas carreras, tanto por REST como por Excel. Dos Directores de la misma facultad y vuelta
no pueden compartir carreras configuradas. Esto organiza actas y conteos; no añade padrón
ni habilita voto individual. Los sectores y sus pesos siguen configurándose antes de iniciar.
Los cargos anteriores sin lista de carreras conservan su comportamiento.

### Cargos existentes: mantener o reemplazar

La revisión del Excel muestra **Cargos que ya existen**, con una decisión por fila:
**Mantener existente, sin cambios** (opción inicial) o **Reemplazar configuración con el Excel**.
La coincidencia exige la institución autorizada, cargo, ámbito y primera vuelta. Se rechazan
coincidencias ambiguas y repeticiones dentro del propio archivo. Los campos obligatorios
siguen validándose: escoger mantener no convierte un archivo incompleto en válido.

Mantener permite conservar también cargos en recepción o cerrados y no ejecuta INSERT ni
UPDATE sobre ellos. Reemplazar solo se permite en borrador universitario, sin una vuelta
dependiente. Actualiza facultad, grupo y carreras; ajusta la agrupación a Carrera cuando
hay una lista de carreras. Conserva ID, nombre del proceso, cargo, ámbito, vuelta, estado,
sectores, ponderación, reglas, candidatos/fotos, mesas y asignaciones. Se rechaza retirar
una carrera que ya tenga mesas o asignarla simultáneamente a otro Director.

Cambiar una decisión deshabilita la confirmación hasta pulsar **Revisar archivo** otra vez.
REST admite `resoluciones`, un mapa del número de fila Excel a `mantener` o `reemplazar`.
La huella queda ligada también a la decisión y al registro vigente: cambios intermedios
obligan a revisar. Confirmar bloquea primero los IDs existentes en orden estable, luego
la institución, revalida y aplica todo el lote en una única transacción. No vacía listas
ni reinicia resultados. La respuesta distingue `creados`, `actualizados`, `mantenidos` e
`importados` (creados + actualizados).

Verificaciones ejecutadas en el entorno sintético: mantener sin diferencias observables,
reemplazo selectivo conservando IDs/candidatos/mesas/asignaciones/reglas, lote mixto con las
tres acciones, rechazo de decisión manipulada, vista antigua, carreras utilizadas y estados
recepción/cierre; 401/403 y separación por institución. Firefox confirmó ambas opciones,
la revisión obligatoria y la persistencia en 390, 768 y 1440 px. Evidencias:
`pruebas/ampliacion/resultados.json` e `interfaz.json`. La prueba de migración efímera se
omitió en esta ejecución; el esquema SQL no cambió.


En **Usuarios** y **Asignar operadores**, **Mesas de cada operador** muestra cuenta,
mesa, cargo, ámbito, unidad, sector y estado, con filtros. La consulta se limita a la
institución autorizada; los nombres de cuentas provienen de Identidad mediante su API.
