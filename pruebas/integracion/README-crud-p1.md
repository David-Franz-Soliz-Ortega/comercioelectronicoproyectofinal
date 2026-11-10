# Verificación CRUD y Swagger P1

Desde la raíz del repositorio, con Docker Compose v2 que soporte `!override`, Python 3.12 y las dependencias Playwright del frontend:

```sh
python3 -m venv /tmp/sigape-crud-entorno
/tmp/sigape-crud-entorno/bin/pip install -r pruebas/integracion/requirements.txt
# Instalar Chromium de Playwright si aún no está disponible:
cd frontend
npx playwright install chromium
cd ..
/tmp/sigape-crud-entorno/bin/python pruebas/integracion/ejecutar-crud-p1.py
```

Si Chromium usa una carpeta propia, exportar `PLAYWRIGHT_BROWSERS_PATH` con esa ruta. El orquestador crea un proyecto Compose con nombre único, credenciales aleatorias fuera del repositorio, bases y volúmenes nuevos, y NGINX en un puerto loopback disponible. No usa el puerto 8080 ni las bases del proyecto principal. Conserva contenedores, volúmenes y evidencias en la carpeta temporal que imprime. No copia `entorno.env` al repositorio.

`crud-p1.py` exige el manifiesto del proyecto aislado y permite DELETE únicamente de los identificadores creados por su ejecución. Prueba los cuatro productores: C/R/U/D, errores 400/404/409/422 según contrato, validación, correlación, filtros y paginación. Valida los cuatro OpenAPI y las respuestas con JSON Schema. La carga de elecciones inserta 10.000 registros sintéticos, repite la carga para comprobar idempotencia y recorre 100 páginas antes y después de reiniciar PostgreSQL/MongoDB aislados. No demuestra concurrencia ni carga masiva de los otros tres dominios.

`swagger-p1.mjs` abre Chromium, verifica operaciones y errores JavaScript, ejecuta un GET desde cada Swagger y comprueba MIME de los recursos Node. Puede repetirse sin escrituras contra el principal:

```sh
node pruebas/integracion/swagger-p1.mjs --base http://localhost:8080 --evidencia /tmp/swagger-principal.json
```

`conservacion-p1.py capturar /tmp/conservacion.json` y luego `comparar` comprueban por REST el contenido completo original de los cuatro dominios y los identificadores de almacenes/volúmenes principales. Normalizan fechas al mismo instante UTC con precisión de milisegundos; no ocultan modificaciones de otros campos. Requiere acceso Docker. Las evidencias conservadas documentan el alcance exacto y los resultados, sin equivaler a una prueba desde un clon limpio ni a aceptación docente.

La regresión principal de solo lectura se ejecuta con `python3 pruebas/integracion/regresion-lectura-p1.py --evidencia /tmp/regresion-principal.json`; requiere los registros sintéticos previamente documentados de gRPC. No prepara ni modifica fixtures del principal.
