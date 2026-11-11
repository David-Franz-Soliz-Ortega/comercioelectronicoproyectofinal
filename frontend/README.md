# Interfaz React de SIGAPE — desarrollo posterior a P1

La versión estable `v1.0-p1` y `main` se conservan. Esta fase se desarrolla en `develop`, sin publicar cambios. Se mantiene SIGAPE como nombre provisional, sin referencias institucionales exclusivas.

## Funciones disponibles y navegación

| Ruta por hash | Estado |
| --- | --- |
| `#inicio` | Resumen con totales reales de elecciones, candidaturas y padrón; acceso a la creación existente. |
| `#usuarios` | Página informativa; gestión de cuentas e inicio de sesión pendientes. |
| `#elecciones` | Listado, búsqueda por nombre, filtro de estado, paginación y creación persistente. |
| `#candidaturas` | Listado, referencia a elección, filtro de estado y paginación. |
| `#padron` | Listado, referencia a elección, filtro de elegibilidad y paginación. |
| `#votacion` | Página informativa; no permite registrar participación todavía. |
| `#resultados` | Página informativa; integración de conteos pendiente. |

Las tres páginas pendientes no presentan formularios, cifras inventadas ni acciones operativas. No se ha añadido una sesión ficticia ni un selector de roles. El frontend sigue consumiendo `/graphql` del mismo origen, sin contraseñas de infraestructura ni acceso directo a bases. Los registros sintéticos existentes permanecen identificables por sus nombres; la interfaz no crea datos al abrirse.

## Organización del código

- `src/Aplicacion.jsx`: composición, navegación, resumen y ciclo del modal.
- `src/navegacion/secciones.js`: catálogo de las siete rutas y roles futuros por sección.
- `src/navegacion/planPermisos.js`: propuesta declarativa de acciones por rol; **no aplica seguridad**.
- `src/paginas/`: Inicio, los tres listados y páginas pendientes.
- `src/componentes/`: navegación, resumen, tabla, formulario, iconos y formato.
- `src/api/clienteGraphql.js`: transporte, timeout y manejo de errores.
- `src/api/operaciones.js`: queries y mutation existentes, sin cambios de contrato.
- `src/graphql.js`: reexportaciones compatibles con las importaciones anteriores.
- `src/estilos.css`: diseño adaptable y tokens `#123B70`, `#2563EB`, `#FFFFFF`, `#DBEAFE`, `#8B1E3F`.

La paginación sigue siendo de diez registros en el servidor. Actualizar conserva los filtros; cambiar de listado los reinicia. Crear una elección reinicia el listado de elecciones y consulta de nuevo los totales. Se mantienen abortos de solicitudes obsoletas, respuestas parciales, estado vacío, error sin datos sustitutos y protección contra envíos simultáneos. La creación no tiene idempotencia entre solicitudes distintas: ante respuesta incierta se pide consultar antes de repetir.

## Roles y permisos propuestos

| Rol | Alcance inicial propuesto |
| --- | --- |
| SUPERADMIN | Gestión de cuentas y dominios administrativos; consulta de resultados y auditoría. |
| ADMIN_ELECTORAL | Gestión de elecciones, candidaturas y padrón; consulta de resultados. |
| OPERADOR | Consulta de elecciones, registro de candidaturas/padrón y consulta de resultados. |
| ELECTOR | Consulta de elecciones/resultados y participación cuando exista autorización real. |
| AUDITOR | Consulta de elecciones, candidaturas, padrón, resultados y auditoría, sin escrituras. |

La matriz debe ratificarse y tener alcance por elección. No se usa para ocultar rutas o autorizar operaciones actuales. Siguiente fase: cuentas y credenciales protegidas en identidad, sesiones reales, consulta del usuario autenticado, cierre/expiración de sesión, protección CSRF si se usan cookies, validación de permisos en cada operación REST/GraphQL y pruebas 401/403, incluidos accesos directos que eviten el BFF. Los permisos del navegador serán solo presentación; el backend decide. No se certifica aptitud para elecciones oficiales ni anonimato electoral.

## Compilar y probar sin modificar el principal

Requisitos: Node 24, Python 3.12, Git, Docker Compose v2 con `!override`, dependencias del frontend y Chromium de Playwright.

```sh
npm ci --prefix frontend --ignore-scripts
npm run probar --prefix frontend
npm run compilar --prefix frontend
# Instalar Chromium si hace falta:
./frontend/node_modules/.bin/playwright install chromium --only-shell
# Ejecutar el flujo real en bases, redes y volúmenes nuevos:
sh frontend/pruebas/ejecutar.sh
```

Si Chromium está en una carpeta propia, exportar `PLAYWRIGHT_BROWSERS_PATH`. `desarrollo.py` crea una copia temporal de los archivos publicables, credenciales aleatorias fuera del repositorio con permisos 0600 y un proyecto Compose nuevo de nueve contenedores. Solo publica NGINX en loopback con puerto dinámico. Inicia cuatro CRUD, PostgreSQL, MongoDB, BFF, frontend y NGINX; los servicios restantes del principal no se tocan.

El guion prepara doce elecciones, una candidatura y dos inscripciones mediante REST real, con nombres `Prueba explícita ...`. Playwright verifica los siete accesos, los listados reales, filtros, página siguiente, creación con una sola mutation, recarga, búsqueda, modo sin conexión/recuperación y móvil 390 px. No intercepta respuestas ni usa mocks en el recorrido integrado. Las pruebas unitarias sí sustituyen el transporte para verificar fallos.

La elección creada se verifica de nuevo tras reiniciar solo PostgreSQL aislado. Se comparan hashes de los 10013 registros originales, almacenes, volúmenes, contenedores e inicios del principal. Se comprueba que `main` y el tag siguen iguales. Al terminar se detienen por defecto solo los contenedores de prueba para liberar recursos; sus datos/volúmenes se conservan. No se ejecuta limpieza destructiva. Para una vista de desarrollo activa, usar `python3 frontend/pruebas/desarrollo.py --reanudar RUTA/ejecucion.json --mantener-activo` cuando haya recursos disponibles. Las credenciales privadas no se copian como evidencia.

Para Vite local, usar la URL aislada que imprime el guion:

```sh
URL_ENTRADA_DESARROLLO=http://127.0.0.1:PUERTO_AISLADO npm run desarrollar --prefix frontend
```

El proxy de desarrollo exige un puerto aislado distinto de 8080. La compilación de producción mantiene `/graphql` relativo y no necesita esa variable. El guion de navegador exige además un manifiesto cuyo proyecto y URL coincidan; no permite ejecutar mutations de prueba contra el principal.

[Pruebas de P1, conservadas como evidencia histórica](pruebas/resultados-pruebas.md). Los resultados nuevos se documentan por separado en `pruebas/resultados-desarrollo.md`.
