# Cierre técnico SIGAPE P1 — 10/11/2026

**Dictamen: candidato técnico verificado, publicación todavía pendiente.** El clon temporal más los archivos locales publicables compila, inicia con bases nuevas y supera las rutas críticas. El HEAD remoto no contiene aún toda esa implementación. No se autoriza ni se hizo commit, push, tag, staging o limpieza de datos. La aprobación de contratos/ADR y la aceptación docente siguen pendientes.

## Git, archivos y configuración

- Rama `main`; HEAD `49a49e0a52372785369861da79db0c496afa0f54`. `git ls-remote --heads origin main` confirmó el mismo SHA en `https://github.com/David-Franz-Soliz-Ortega/comercioelectronicoproyectofinal.git`. No se hizo fetch ni se alteraron refs originales. Índice sin cambios; ningún tag local.
- El candidato exportó 156 archivos: 61 seguidos, 95 no seguidos; 20 archivos seguidos modificados al revisar. Las adiciones posteriores son documentación/evidencias y correcciones del verificador, identificadas en el manifiesto. Estos números corresponden al corte, no a un árbol final inmutable.
- Deben incorporarse, tras revisión y autorización futura: Compose/NGINX, contratos, productores corregidos, frontend, gateway, votación/resultados, gRPC, pruebas y evidencias, diagramas, Markdown/PDF y este informe. Las implementaciones nuevas todavía no seguidas son necesarias: publicar únicamente los archivos que ya están en Git deja P1 incompleta.
- `.gitignore` excluye `.env*` salvo `.env.example`, secretos, claves privadas, dependencias, compilados, cachés y logs. `.env` está ignorado y no seguido. El contexto Docker excluye `.git`, entorno local y dependencias/compilados; quedan recomendados patrones preventivos `secrets/`, `*.pem`, `*.key`, ya cubiertos por Git pero no por `.dockerignore`. No se encontró ningún archivo propio de esas clases que se hubiera exportado.
- Todos los Dockerfiles, fuentes, contratos y scripts de inicialización necesarios estuvieron presentes: el build y arranque con almacenes vacíos lo corroboraron. Se conservaron permisos de archivos. Las imágenes base no están fijadas por digest; el ensayo no acredita construcción bit a bit ni funcionamiento sin caché/red.

## Ensayo aislado y evidencia

[Procedimiento reproducible](../pruebas/cierre-p1/README.md). Carpeta `/tmp/sigape-cierre-p1-kj1pnii0`, proyecto `sigape-cierre-p1-16b6533d`, URL `http://127.0.0.1:32771`. Se clonó HEAD local con objetos independientes y se superpusieron los archivos seguidos/no ignorados, con inventario SHA-256. **No equivale a clonar el futuro commit remoto.** Se rechazaron enlaces simbólicos y posibles secretos; no se copiaron `.env`, node_modules, dist ni datos anteriores.

Credenciales aleatorias distintas en archivo privado 0600 fuera del clon; redes/volúmenes con nombre único y puerto loopback dinámico. El override cambió solo el puerto público. La herramienta de navegador es externa al build: Playwright/Chromium del anfitrión. Todas las aplicaciones se construyeron desde el candidato temporal.

| Comprobación | Resultado y evidencia |
| --- | --- |
| Configuración y construcción | `docker compose config --quiet` y `up -d --build` correctos; [arranque](../pruebas/cierre-p1/evidencias/arranque.txt). BFF ejecutó seis pruebas durante build. |
| Salud | 15 contenedores permanentes `healthy`; tarea `configurar-mensajeria` terminada con salida 0. [Estados](../pruebas/cierre-p1/evidencias/contenedores.json). |
| REST y GraphQL | 24 solicitudes verificadas: cuatro listados inicialmente vacíos, ocho healthchecks, identidad REST, tres mutations GraphQL, agregación de elecciones/candidaturas/padrón y lecturas posteriores. [Rutas](../pruebas/cierre-p1/evidencias/rutas.json). |
| gRPC real | Elecciones → padrón entre contenedores: elegible HTTP 200 y `NOT_FOUND` 404/código 5; correlación en cliente y servidor. [Trazas](../pruebas/cierre-p1/evidencias/grpc.txt). No se repitieron todos los estados/deadlines en este ensayo. |
| RabbitMQ | Publicación real, entrega a dos conexiones/consumidores independientes con ACK manual y prefetch 1, persistencia MongoDB en ambas proyecciones, cinco reentregas sin duplicados; DLQ durables configuradas. [Resultados](../pruebas/cierre-p1/evidencias/rabbitmq.txt). No se indujo un mensaje inválido hacia DLQ aquí. |
| Swagger | Cuatro interfaces en Chromium, operaciones visibles, cero errores JS y GET real desde cada una. [Navegador](../pruebas/cierre-p1/evidencias/swagger.json). Candidaturas conserva dependencia CDN. |
| Principal intacto | Contenedores, IDs, inicios, reinicios y volúmenes iguales antes/después; hashes de sus 10013 registros CRUD iguales. Volúmenes del candidato totalmente separados. [Resultado final](../pruebas/cierre-p1/evidencias/resultado.json), fotografías y comprobación de volúmenes en esa carpeta. |

No se detuvo, reconfiguró ni reconstruyó el principal. Tampoco se borraron datos o volúmenes; el candidato y sus datos sintéticos permanecen disponibles. El ensayo complementa las 118 pruebas CRUD y la carga/persistencia de 10000 elecciones previamente documentadas; no vuelve a presentarlas como ejecuciones nuevas.

## Incidencias, causa y corrección

1. **`up --wait` devolvió error por una tarea terminada con éxito.** El mensaje fue `configurar-mensajeria ... exited (0)`; los servicios terminaron saludables. Se conservan [log inicial](../pruebas/cierre-p1/evidencias/arranque-fallo-wait.txt) y resultado negativo. Corrección aplicada solo al verificador: `up -d --build` seguido de espera explícita de 15 healthy y de salida 0 de la tarea. No se cambió el Compose de las aplicaciones para ocultarlo.
2. **Error del nuevo verificador HTTP.** Usó `Request.method` sin establecerlo; falló antes de efectuar escrituras. Corrección aplicada: `get_method()`. [Resultado negativo conservado](../pruebas/cierre-p1/evidencias/rutas-fallo-verificador.json). El manifiesto registra los cambios de SHA de los dos scripts de prueba; las aplicaciones probadas permanecieron iguales.
3. **Consulta remota restringida por sandbox.** La primera consulta no resolvió GitHub; repetida con acceso autorizado devolvió el SHA indicado. No fue un conflicto de rama ni un push/fetch fallido.

## Secretos y coherencia documental

La revisión heurística examinó 156 archivos, 168 blobs alcanzables de cuatro commits y los diez valores sensibles locales, comparados en memoria; **cero hallazgos confirmados**. Dos coincidencias descartadas eran versiones de `js-tokens`. [Alcance y evidencia](../pruebas/cierre-p1/evidencias/secretos.json). No se imprimieron credenciales ni se exportó el archivo privado. No equivale a ausencia absoluta: no inspecciona imágenes, dependencias ignoradas, objetos Git inalcanzables ni configuración remota. Las evidencias exportadas se contrastaron también con los valores aleatorios del ensayo.

[Arquitectura Markdown](arquitectura-p1.md) actualizada para distinguir candidato demostrado de commit definitivo pendiente; [PDF](arquitectura-p1.pdf) regenerado y comprobado en ocho páginas. La evidencia de coherencia registra SHA-256 del Markdown, PDF y diagramas, además de comprobaciones de texto; una edición posterior requiere regenerar y verificar nuevamente.

## Qué falta antes de publicar

1. Revisión humana del inventario completo y de los contratos/ADR; aprobación de la entrega y confirmación de rúbrica/hora docente.
2. Incorporar los archivos necesarios y crear un commit únicamente cuando se autorice. Repetir el ensayo desde ese SHA definitivo, sin superposición, para acreditar un clon del artefacto que se publicará.
3. Push y tag `v1.0-p1` únicamente tras autorización; comprobar publicación remota y plazo de 24 horas. Actualmente no se demuestra ninguno de ellos.

No hay un fallo funcional pendiente en las rutas ejecutadas. Autenticación, reglas electorales completas, seguridad de producción, carga concurrente y tolerancia integral a fallos continúan fuera de lo demostrado en este cierre.
