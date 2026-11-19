# Frontend TUVOTO

Portal público: elección actual, candidatos con fotografías, votos y avance por mesas, sin login. Panel privado: administración de organización/procesos/cuentas/asignaciones o registro de actas por operadores. Conserva cookies HttpOnly, CSRF, logout y revalidación de sesión.

El operador fotografía/sube JPEG/PNG y confirma manualmente números. No hay OCR simulado. Las actas observadas no incorporan votos nuevos. No se muestran cifras ficticias.

`npm run probar`, `npm run compilar`. Desarrollo: definir `URL_ENTRADA_DESARROLLO` con NGINX del proyecto TUVOTO en loopback y un puerto explícito; el proxy mantiene REST/GraphQL en un mismo origen. No apuntar al principal SIGAPE.

La portada incorpora una urna animada en SVG, un control para pausar el movimiento y adaptación a la preferencia de movimiento reducido. Los resultados provienen del contrato GraphQL vigente; las candidaturas se ordenan por votos recibidos y no se declaran ganadores.

Para comprobar la interfaz, iniciar Vite y ejecutar `npm run probar-interfaz`. `URL_BASE` permite cambiar la dirección de prueba (por defecto `http://127.0.0.1:5174`) y `CHROMIUM_EJECUTABLE` permite usar un Chromium instalado. Las capturas se guardan en `/tmp` o en `EVIDENCIA_FRONTEND`.

La prueba de navegador utiliza respuestas sintéticas interceptadas exclusivamente en el navegador: verifica filtros, estados vacíos y de error, movimiento reducido y anchos de 320 a 1440 px. No escribe datos ni acredita una integración completa con servicios desplegados.
