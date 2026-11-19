# Frontend TUVOTO

Portal público: elección actual, candidatos con fotografías, votos y avance por mesas, sin login. Panel privado: administración de organización/procesos/cuentas/asignaciones o registro de actas por operadores. Conserva cookies HttpOnly, CSRF, logout y revalidación de sesión.

El operador fotografía/sube JPEG/PNG y confirma manualmente números. No hay OCR simulado. Las actas observadas no incorporan votos nuevos. No se muestran cifras ficticias.

`npm run probar`, `npm run compilar`. Desarrollo: definir `URL_ENTRADA_DESARROLLO` con NGINX del proyecto TUVOTO en loopback y un puerto explícito; el proxy mantiene REST/GraphQL en un mismo origen. No apuntar al principal SIGAPE.

No se ha verificado todavía visualmente el nuevo recorrido completo en navegador. Las evidencias anteriores se archivaron y corresponden a SIGAPE, no a esta interfaz.
