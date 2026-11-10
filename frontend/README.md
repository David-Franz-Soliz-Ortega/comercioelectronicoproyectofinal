# Interfaz React de SIGAPE

Aplicación sencilla de React y Vite disponible en `http://localhost:8080`, servida por el NGINX de entrada de SIGAPE. Solo consulta `/graphql` en el mismo origen, mediante queries y mutations del BFF existente; no recibe credenciales ni accede directamente a bases o puertos de microservicios.

## Funciones

- Listados de elecciones, candidaturas y padrón con paginación de diez registros, totales reales, estados de carga, errores y listas vacías.
- Búsqueda de elecciones por nombre y filtros de estado o elegibilidad, ejecutados en el servidor.
- Referencias de elección de candidaturas e inscripciones mediante los campos anidados del contrato GraphQL.
- Formulario «Nueva elección» con nombre y estado, mutation real `crearEleccion`, bloqueo de envíos repetidos y confirmación después de la respuesta del servicio. El listado y los totales se vuelven a consultar tras guardar.
- Navegación por fragmentos `#elecciones`, `#candidaturas` y `#padron`, diseño adaptable, controles etiquetados y formulario modal operable con teclado.

No hay registros, contadores o respuestas simulados en el código. Los datos mostrados son los persistidos por SIGAPE, incluidos sus registros académicos sintéticos existentes. La interfaz no crea datos al abrirse. Las inscripciones no muestran identidad ni datos personales.

Los códigos de estado y las opciones de formulario proceden del contrato `compartido/contratos/graphql/esquema.graphql`. La lógica y la validación de negocio permanecen en los microservicios. Las referencias no disponibles se indican sin inventar nombres. Si no hay conexión, el listado informa el error y permite reintentar; no sustituye respuestas por datos de ejemplo.

## Docker y ejecución

Desde la raíz:

```sh
docker compose up -d --build --no-deps --wait frontend
docker compose exec -T entrada-nginx nginx -t
docker compose exec -T entrada-nginx nginx -s reload
```

El frontend es el contenedor permanente número 15, conectado únicamente a `red_interna`, sin puerto público propio ni volúmenes de datos. Usa NGINX sin privilegios en el puerto interno 3000 para servir archivos estáticos. El NGINX de entrada mantiene el puerto público 8080 y sus rutas REST/GraphQL previas. En arranques completos, Compose espera que el BFF y el frontend estén saludables.

Salud local: `frontend:3000/salud`; salud pública: `/api/v1/salud/frontend`. Este healthcheck verifica el servidor estático; la disponibilidad de los servicios de datos se comprueba en el BFF y en la prueba funcional.

Para desarrollo local con Node.js 24 y el Compose principal activo:

```sh
npm ci --prefix frontend --ignore-scripts
npm run desarrollar --prefix frontend
```

Vite envía `/graphql` al NGINX de `localhost:8080` durante el desarrollo. La compilación de producción utiliza rutas relativas del mismo origen, sin variables sensibles:

```sh
npm run compilar --prefix frontend
```

No se incluyen `.env`, dependencias de prueba, fuentes ni secretos en la imagen final; solo la salida estática y la configuración de NGINX.

## Prueba real de navegador

Con SIGAPE principal activo, desde la raíz:

```sh
npm ci --prefix frontend --ignore-scripts
sh frontend/pruebas/ejecutar.sh
```

El guion usa Chromium real en la imagen oficial Playwright 1.56.1, coincidente con la dependencia fijada. Requiere Docker con red del anfitrión en Linux y acceso a `localhost:8080`. Monta las pruebas y sus dependencias en lectura; no monta el socket Docker ni los archivos de entorno. No es un servicio permanente.

La prueba navega las tres secciones, contrasta listados con las API REST reales, prueba paginación y filtros cuando hay datos, crea una elección con el formulario, verifica una sola mutation y confirma su persistencia mediante REST y recarga del navegador. También comprueba búsqueda, pérdida real de conectividad del navegador, recuperación y una vista móvil de 390 px. No intercepta respuestas ni usa mocks.

También se puede ejecutar Chromium headless localmente, sin instalar paquetes del sistema, cuando sus bibliotecas ya están disponibles:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/sigape-navegadores ./frontend/node_modules/.bin/playwright install chromium --only-shell
PLAYWRIGHT_BROWSERS_PATH=/tmp/sigape-navegadores npm run probar-navegador --prefix frontend
```

Este modo usa el mismo guion y el mismo endpoint NGINX. El navegador se descarga únicamente en `/tmp`; no usa perfiles personales.

Cada ejecución crea y conserva una elección académica con nombre único `Prueba navegador SIGAPE ...`. No elimina elecciones ni modifica las anteriores. Las capturas y la evidencia JSON se guardan en una carpeta nueva de `/tmp`, cuyo nombre imprime el guion. La eliminación automática del contenedor efímero de navegador no elimina datos ni volúmenes del sistema.

Pendientes: autenticación y autorización coordinadas con los servicios, aprobación humana de los contratos y pruebas adicionales en otros navegadores. La mutation de creación existente no ofrece idempotencia entre solicitudes diferentes; por eso se bloquean envíos simultáneos y, ante una respuesta incierta, se pide actualizar antes de volver a guardar.

Referencias: [React DOM](https://react.dev/reference/react-dom/client), [ejecución Playwright en Docker](https://playwright.dev/docs/docker).

Ejecución verificada y evidencia: [resultados de la prueba real](pruebas/resultados-pruebas.md).
