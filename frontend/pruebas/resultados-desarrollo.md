# Frontend azul en develop — resultados verificados

Fecha: 10/11/2026. Esta fase conserva la entrega `v1.0-p1`: `main`, `origin/main` consultado y el commit del tag publicado coinciden en `34880d44d0fb5e9497f2d1add927a49e1206198b`. La rama local `develop` se creó desde main. No se hizo commit, push, staging ni tag; los cambios permanecen sin commit en develop.

## Cambios de esta fase

- `src/Aplicacion.jsx`: composición general y navegación; los listados, tabla, formulario, iconos y formatos pasan a componentes/páginas propios.
- Nuevos `src/componentes/{Navegacion,ResumenRegistros,FormularioEleccion,TablaRegistros,DatosRegistro,Icono}.jsx` y `formato.js`.
- Nuevos `src/paginas/{PaginaInicio,PaginaRegistros,PaginaPendiente}.jsx`.
- Nuevos `src/api/clienteGraphql.js` y `operaciones.js`; `src/graphql.js` mantiene exportaciones compatibles. Queries, mutation, filtros, paginación y tratamiento de errores conservados, sin cambiar contratos.
- Nuevos `src/navegacion/secciones.js` y `planPermisos.js`: siete rutas y propuesta para SUPERADMIN, ADMIN_ELECTORAL, OPERADOR, ELECTOR y AUDITOR. No simulan autenticación ni aplican permisos.
- `src/estilos.css`, `index.html` y `public/simbolo.svg`: paleta exacta solicitada, navegación completa, diseño de escritorio/móvil y marca SIGAPE sin referencias visuales USFX.
- `package.json`, `vite.config.js`, `README.md` y guiones de pruebas actualizados. Vite exige una entrada aislada explícita y rechaza el puerto principal 8080; la producción conserva `/graphql` relativo.
- Nuevos `pruebas/{cliente.test.mjs,desarrollo.py,preparar-datos.mjs,verificar-persistencia.mjs}`. `ejecutar.sh` ahora orquesta contenedores aislados; `navegador.mjs` exige URL/manifiesto aislados antes de escribir.
- Evidencias nuevas en `pruebas/evidencias-desarrollo/`; las evidencias P1 se conservan sin cambios. No se modificaron microservicios, BFF, contratos, Compose principal ni NGINX principal.

Usuarios, Votación y Resultados son páginas informativas sin acciones operativas. Los tres listados y la creación de elecciones continúan funcionando. Inicio presenta únicamente totales reales; no hay sesiones, usuarios activos, permisos o cifras inventados.

## Entorno y reproducibilidad

Ejecutar desde la raíz:

```sh
npm run probar --prefix frontend
npm run compilar --prefix frontend
PLAYWRIGHT_BROWSERS_PATH=/tmp/sigape-navegadores sh frontend/pruebas/ejecutar.sh
```

Requiere Chromium instalado; consultar el README para instalación o ruta alternativa. El guion crea credenciales nuevas fuera del repositorio, una copia de los archivos publicables y nueve contenedores en redes/volúmenes nuevos. Conserva todos los volúmenes y datos. No ejecuta mutations contra el principal.

Ejecución observada: proyecto `sigape-cierre-p1-d496c9eb`, carpeta `/tmp/sigape-cierre-p1-n71jrq3q`, **vista de desarrollo `http://127.0.0.1:32772`**. El entorno se conserva detenido, con sus datos y volúmenes, para liberar recursos; el principal no se reconstruyó ni recargó. En otra ejecución el puerto será diferente. Para reactivar la vista y repetir pruebas, añadir `--mantener-activo` al comando de reanudación cuando haya recursos disponibles.

Para reanudar el mismo entorno aislado, el guion admite `python3 frontend/pruebas/desarrollo.py --reanudar /tmp/sigape-cierre-p1-n71jrq3q/ejecucion.json`: actualiza únicamente la copia temporal del frontend, conserva los datos de prueba y repite navegador/persistencia. Nunca debe usarse un manifiesto ajeno al proyecto aislado. El guion ahora detiene por defecto solo los contenedores propios al terminar; se conserva la opción explícita `--mantener-activo`.

## Pruebas y resultados

| Verificación | Resultado / evidencia |
| --- | --- |
| Compilación local y Docker | Correctas; 43 módulos transformados. [Extracto de construcción](evidencias-desarrollo/compilacion.txt). Las fuentes actuales coinciden con las compiladas en el candidato: [SHA-256](evidencias-desarrollo/fuentes-verificadas.json). |
| Cliente y navegación | Cinco pruebas unitarias aprobadas: transporte/variables, datos parciales, HTTP/JSON inválidos, red/timeout, errores GraphQL y rutas desconocidas. [Registro](evidencias-desarrollo/unitarias.txt). Se sustituyó transporte solo en pruebas unitarias. |
| Proxy de Vite | Rechaza destino no definido y `127.0.0.1:8080`, antes de levantar el servidor. [Prueba](evidencias-desarrollo/proxy-desarrollo.json). |
| Arranque aislado | Nueve contenedores saludables: PostgreSQL, MongoDB, cuatro CRUD, BFF, frontend y entrada NGINX. [Estados](evidencias-desarrollo/contenedores.json). |
| Navegador real | Trece verificaciones aprobadas, cero errores JS, siete secciones, paleta exacta y páginas pendientes sin acciones/sesiones ficticias. [Evidencia](evidencias-desarrollo/evidencia.json) y [registro](evidencias-desarrollo/navegador.txt). |
| Regresión operativa | Totales/listados contrastados con REST; página 2; filtros de estado y elegibilidad; actualización conserva filtro; búsqueda por nombre; pérdida real de red y recuperación. Sin interceptar respuestas ni sustituir APIs. |
| Formulario | Nombre de solo espacios rechazado sin mutation; Escape cierra modal; un único envío válido genera exactamente una mutation. REST y recarga confirman el registro. |
| Navegación y diseño | Historial atrás/adelante correcto, siete rutas accesibles a 390 px sin desbordamiento. Capturas revisadas visualmente: [escritorio](evidencias-desarrollo/inicio-azul.png) y [móvil](evidencias-desarrollo/inicio-movil.png). |
| Persistencia | Elección `97d8f905-c56c-4ac9-82df-c1b7d76948fd` recuperada por REST después de reiniciar PostgreSQL aislado. [Resultado](evidencias-desarrollo/persistencia.json). |
| P1 conservada | Hashes de 1 identidad + 10006 elecciones + 2 candidaturas + 4 inscripciones iguales, mismos almacenes/volúmenes, contenedores e inicios; main/tag intactos. [Resultado final](evidencias-desarrollo/resultado.json), fotografía de datos y principal antes/después en esa carpeta. |
| Credenciales | Compilación y evidencias comparadas en memoria con valores sensibles del principal y del ensayo: cero coincidencias. [Alcance](evidencias-desarrollo/secretos.json). No certifica ausencia absoluta. |

Datos sintéticos creados exclusivamente en el aislado: doce elecciones con nombre `Prueba explícita frontend azul ...`, una candidatura explícita y dos inscripciones (elegible/no elegible). Dos ejecuciones de navegador crearon una elección cada una, con nombre `Prueba navegador SIGAPE ...`; ambas se conservan. No se borraron datos para repetir las pruebas.

### Incidencia conservada

La primera ejecución pasó el navegador, pero la lectura REST posterior al reinicio devolvió 404 desde NGINX aislado. La misma elección respondía 200 al consultar directamente su productor; recargar NGINX devolvió 200 con el mismo UUID. No hubo pérdida del registro. El verificador ahora recarga exclusivamente el NGINX aislado tras recreación/reinicio para renovar destinos. La repetición completa con el frontend final pasó, incluida persistencia. Se conservan [resultado negativo](evidencias-desarrollo/resultado-fallo-resolucion.json) y [traza](evidencias-desarrollo/incidencia-resolucion.txt). No se alteró la configuración estable para ocultar la incidencia; su resolución dinámica queda como mejora posterior de infraestructura.

### Salud observada del principal después de las pruebas

Una lectura posterior a las pruebas encontró 14 contenedores saludables y RabbitMQ `unhealthy`; sus últimos healthchecks excedían el timeout de 5 s. No se ejecutaron publicaciones AMQP ni cambios de RabbitMQ en esta fase. No se reinició ni reconfiguró el principal. Se detuvieron únicamente los nueve contenedores de esta prueba para reducir carga, conservando todos sus datos y volúmenes. El estado observado y una lectura posterior se guardan junto con las evidencias; no se afirma que el principal estuvo siempre saludable ni se atribuye una causa definitiva sin análisis adicional. Tras detener solo el entorno aislado, la lectura posterior confirmó los **15 contenedores principales saludables**: [evidencia](evidencias-desarrollo/salud-principal-posterior.json). No se reinició ningún servicio principal. La conservación de registros y de identificadores/inicios de contenedores sí fue verificada.

## Pendientes para autenticación real

1. Ratificar la matriz propuesta y el alcance por elección. Las constantes de navegación no son una fuente de autorización.
2. Ampliar identidad con cuentas y credenciales protegidas, sesiones reales, cierre/expiración y una forma segura de crear la primera cuenta administrativa. Mantener separados los registros sintéticos existentes; migraciones aditivas y pruebas en volúmenes nuevos.
3. Acordar contratos de autenticación y comprobación de permisos. Validar cada operación REST y GraphQL en backend, incluidos accesos directos a los productores; proteger sesiones y, si se usan cookies, implementar CSRF y atributos adecuados. No incluir secretos de infraestructura ni claves de firma en React.
4. Conectar el estado autenticado de React a respuestas verificadas del servidor. Añadir login y rutas protegidas en esa fase; la visibilidad de menús será presentación, no la barrera de seguridad.
5. Probar 401/403, roles, alcance por elección, revocación/expiración, accesos directos y conservación de datos. Después integrar operaciones de usuarios, votación y resultados de forma incremental, con reglas electorales explícitas.

Las reglas de apertura/cierre, autorización de participación, resultados por candidatura, límite de lotes de DataLoader y seguridad de producción siguen fuera de esta refactorización. No se certifica uso en elecciones oficiales.
