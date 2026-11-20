# Frontend TUVOTO

Portal público en azul y blanco: evento destacado, navegación por cargos, candidaturas con fotografías y porcentajes grandes, votos por unidad y avance de actas, sin login. Panel privado: administración de organización/procesos/cuentas/asignaciones o registro de actas por operadores. Conserva cookies HttpOnly, CSRF, logout y revalidación de sesión.

El operador fotografía/sube JPEG/PNG y confirma manualmente números. No hay OCR simulado. Las actas observadas no incorporan votos nuevos. No se muestran cifras ficticias.

`npm run probar`, `npm run compilar`. Desarrollo: definir `URL_ENTRADA_DESARROLLO` con NGINX del proyecto TUVOTO en loopback y un puerto explícito; el proxy mantiene REST/GraphQL en un mismo origen. No apuntar al principal SIGAPE.

La portada incorpora una urna animada en SVG, un control para pausar el movimiento y adaptación a la preferencia de movimiento reducido. Los resultados provienen del contrato GraphQL vigente; las candidaturas se ordenan por votos recibidos y no se declaran ganadores.

Para comprobar la interfaz, iniciar Vite y ejecutar `npm run probar-interfaz`. `URL_BASE` permite cambiar la dirección de prueba (por defecto `http://127.0.0.1:5174`) y `CHROMIUM_EJECUTABLE` permite usar un Chromium instalado. Las capturas se guardan en `/tmp` o en `EVIDENCIA_FRONTEND`.

La prueba de navegador utiliza respuestas sintéticas interceptadas exclusivamente en el navegador: verifica filtros, estados vacíos y de error, movimiento reducido y anchos de 320 a 1440 px. No escribe datos ni acredita una integración completa con servicios desplegados.

El panel privado y sus estilos se descargan al entrar en `#panel`. La consulta de resultados ocurre cada 10 segundos y el catálogo cada minuto; ambas se suspenden cuando la pestaña está oculta y se reanudan al volver. Las solicitudes anteriores se cancelan al cambiar de selección. Los empates y los conteos en cero no proclaman ganadores. Una respuesta parcial o inconsistente genera un aviso; los errores de actualización conservan los últimos datos de la misma selección, identificados como anteriores.

Las fotos ausentes o fallidas muestran iniciales y un aviso. No se incluyen retratos ni resultados de demostración en el frontend. Las imágenes sintéticas del test pertenecen únicamente a sus respuestas interceptadas. Los porcentajes y el avance tienen denominadores distintos.

Configuración y contrato: [guía de eventos](../docs/portal-eventos.md). El frontend nuevo requiere desplegar también el contrato GraphQL y las versiones coordinadas de Elecciones, Actas y Resultados.

## Arranque y diagnóstico

Iniciar primero los servicios desde la raíz: `python3 infraestructura/tuvoto/iniciar-local.py`. El portal compilado queda en `http://127.0.0.1:8890`. Para editar con recarga automática:

```sh
URL_ENTRADA_DESARROLLO=http://127.0.0.1:8890 npm run desarrollar --prefix frontend -- --host 127.0.0.1 --port 5174
```

Vite sirve el frontend; requiere que TUVOTO siga iniciado en el puerto 8890. Si falla la primera consulta, la portada muestra un único aviso con «Reintentar conexión». Si el catálogo responde vacío, muestra «Todavía no hay un evento publicado». Un fallo de actualización mantiene la última respuesta de la misma selección con un aviso.

`npm run probar-conexion --prefix frontend` comprueba desde Chromium la página real, GraphQL y el acceso privado sin iniciar sesión ni crear datos. No intercepta respuestas. Acepta `URL_BASE` (por defecto `http://127.0.0.1:8890`), `CHROMIUM_EJECUTABLE` y `EVIDENCIA_FRONTEND`; guarda capturas y evidencia en `/tmp/tuvoto-conexion-real-*`. Un catálogo vacío no prueba la captura ni el conteo de una elección.

## Diseño del observatorio

La portada usa fondo claro, tarjetas blancas, texto azul oscuro y acentos azules para los controles y el liderazgo. La jerarquía prioriza retratos amplios y nombres grandes, con avance horizontal de actas, navegación por cargo, dos tarjetas de candidatos por fila en escritorio y tabla de facultades/unidades. Cada tarjeta muestra la fotografía, el porcentaje, los votos recibidos y su denominador. La diferencia entre candidaturas se expresa en puntos porcentuales sobre los votos válidos de la selección actual.

La tabla permite buscar unidades sin distinguir tildes; la búsqueda es local y no agrega consultas a los servicios. «Ver votos» aplica el filtro existente al conteo. En móvil, las tarjetas se apilan y la tabla tiene desplazamiento horizontal. La urna conserva pausa y movimiento reducido.

No se muestran ponderaciones 50/50, participación, partidos ni desgloses docentes/estudiantes porque esos campos aún no forman parte del contrato público. Los colores del liderazgo se derivan del conteo, no de una afiliación política. La interfaz conserva los estados vacíos hasta que se publiquen datos.

Para ver un catálogo completo sin registrar votos, [Elecciones incluye una herramienta de demostración local](../microservicios/elecciones/README.md#catálogo-universitario-para-desarrollo-local). Se ejecuta explícitamente y publica candidaturas y mesas de prueba mediante las API; el frontend las consulta del mismo modo que cualquier evento. Sin actas, los porcentajes y el avance permanecen en cero y no se señala un líder.

La tipografía pública es **Manrope**, variable de 200 a 800, servida desde los recursos locales con `font-display: swap`. Procede del [repositorio de Google Fonts](https://github.com/google/fonts/tree/main/ofl/manrope); su [licencia SIL OFL](public/fuentes/Manrope-OFL.txt) acompaña la distribución. No hay solicitudes a Google Fonts en tiempo de navegación. Vite genera el nombre con huella para la caché de recursos.

Las fotografías llegan a 280 px de alto en escritorio y a 300 px en tablet; los nombres alcanzan 42 px. El cuerpo usa 16 px, los controles habituales al menos 14 px y los metadatos 12–13 px. En pantallas pequeñas se reorganiza el perfil y los controles conservan superficies de al menos 44 px. La tarjeta de liderazgo combina texto, borde y color; el color por sí solo no indica un ganador.
