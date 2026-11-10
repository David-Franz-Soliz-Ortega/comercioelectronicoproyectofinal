# Ensayo de cierre P1 sin publicar

Ejecutar desde la raíz, con Git, Python 3.12, Docker Compose v2 compatible con `!override`, Node 24, las dependencias del frontend y Chromium de Playwright instalados:

```sh
python3 pruebas/cierre-p1/preparar-candidato.py
# Usar la carpeta temporal impresa, no una ruta del entorno principal:
python3 pruebas/cierre-p1/ejecutar-candidato.py /tmp/CARPETA_IMPRESA/ejecucion.json
```

Si el navegador está en una carpeta propia, exportar `PLAYWRIGHT_BROWSERS_PATH`. El ejecutor usa el navegador y la dependencia Playwright del repositorio original como herramientas externas de prueba. Las aplicaciones se construyen exclusivamente con el contenido del clon temporal: no se copian `.env`, node_modules, dist, cachés ni bases anteriores.

El preparador clona HEAD local con objetos independientes (`--no-hardlinks`) y superpone exactamente los archivos seguidos y no ignorados del árbol de trabajo. Rechaza enlaces simbólicos, archivos seguidos ausentes y posibles secretos detectados. Guarda SHA-256 de cada archivo, revisión de Git y alcance de la exportación. No crea commits, no añade archivos al índice original y no consulta ni publica en remoto.

La configuración sensible se genera con valores aleatorios distintos fuera del clon, en un archivo de permisos 0600. El proyecto, redes y volúmenes usan un nombre único; el único puerto publicado es loopback dinámico. No hay `external` ni nombres fijos de volúmenes. El override solo cambia el puerto público; las aplicaciones y healthchecks son los del Compose candidato.

Se ejecutan config, up/build y espera explícita de salud, comprobación de 15 contenedores healthy y tarea de configuración AMQP con salida 0. Las rutas prueban bases inicialmente vacías, salud, REST y persistencia inmediata, tres mutations GraphQL, agregación de tres servicios y gRPC entre elecciones/padrón con resultado positivo y NOT_FOUND. El script de resultados ejecuta publicación real, entrega a dos consumidores independientes con ACK manual, cinco reentregas e idempotencia MongoDB; comprueba DLQ configuradas, sin inducir mensajes inválidos. Chromium ejecuta GET en los cuatro Swagger.

Antes y después se comparan contenedores, inicios, reinicios y volúmenes del principal, más los hashes completos de sus cuatro CRUD por REST. El ensayo no detiene ni reconfigura el principal. Se conservan contenedores, datos y volúmenes del candidato, incluso si falla; no hay limpieza destructiva automática. Las evidencias temporales incluyen un resultado parcial ante fallos y el log de construcción. No publicar el archivo privado de entorno.

Este ensayo demuestra un candidato formado con cambios locales. No acredita que HEAD remoto ya contenga esos cambios, ni que exista tag, aprobación del equipo o cumplimiento del plazo docente. Tras la futura incorporación autorizada habrá que repetir desde el commit definitivo. No implica compilar sin caché de Docker ni reproducibilidad bit a bit de imágenes sin fijar digest.
