# Lectura de actas impresas

La lectura usa Tesseract en español dentro de Actas, sin servicios externos. Es una propuesta editable: no registra fotografías, actas, votos ni eventos. La publicación conserva el flujo de confirmación humana y sus permisos anteriores.

## Ejemplo solicitado

El operador enlaza al [formato editable para imprimir](../../../frontend/public/ejemplos/acta-escrutinio-prueba.html), acompañado de un [PDF de una página A4](../../../frontend/public/ejemplos/acta-escrutinio-prueba.pdf) y un [PNG](../../../frontend/public/ejemplos/acta-escrutinio-prueba.png). Está marcado **DOCUMENTO DE PRUEBA — SIN VALIDEZ**: conserva la estructura de la referencia, con institución, nombres y cifras ficticios y sin firmas reales. Una hoja corresponde a una mesa, un cargo y un sector. El formulario exige una fotografía propia para cada acta.

Los campos azules del HTML pueden editarse antes de imprimir; no se guardan ni envían. «Descargar ejemplo PDF» descarga el ejemplo fijo; para conservar cambios se usa «Imprimir esta acta» y la opción de guardar como PDF del navegador. Regenerar los archivos distribuidos desde la raíz, con las dependencias del frontend y Chromium instalados:

```sh
node microservicios/actas/pruebas/generar_acta_impresa.mjs
```

El ejemplo anterior `acta-prueba.png`, generado por `acta_sintetica.py`, se conserva como fixture de regresión. Ninguno se cargó como resultado en una elección.

El ejemplo contiene la mesa `PRUEBA-01`, candidaturas sintéticas `Candidatura Alfa` (120) y `Candidatura Beta` (80), blancos 3, nulos 2 y total 205. Para ensayarlo desde el formulario hace falta un entorno de prueba con esa mesa asignada, esos nombres de candidatura y recepción abierta. No enviarlo a una elección real.

Formato admitido: una fila por dato, con nombre completo de candidatura y cantidad al final; luego `Blancos`, `Nulos` y `Total` (también `Votos blancos`, `Votos nulos`, `Total votos`). Incluir `Mesa: código`. Se normalizan tildes y mayúsculas, pero no se adivinan nombres ni se transforman letras en cifras. Las filas repetidas, nombres ambiguos y cifras con baja confianza quedan sin completar. Si se lee un código de mesa diferente, se rechaza la propuesta. Si falta el código, se advierte que debe compararse manualmente.

Si la primera lectura queda incompleta, una segunda copia temporal con contraste acentuado atenúa la cuadrícula clara. Solo combina cifras sin contradicción; los desacuerdos y las filas repetidas permanecen vacíos. No cambia el archivo original. Las dos ejecuciones comparten un límite total de 15 segundos. El destino continúa seleccionándose manualmente: la lectura propone cifras de las candidaturas configuradas, sin reconocer ni asignar otro cargo automáticamente.

No se garantiza lectura de manuscritos, tablas de formatos ajenos, fotos borrosas ni documentos con varios cargos. La cobertura demostrada corresponde al ejemplo impreso y a sus variantes sintéticas PNG/JPEG, incluida orientación EXIF. Antes de usar un formato institucional hay que validarlo con fotografías de prueba tomadas en condiciones representativas.

## Pruebas aisladas

Desde la raíz, compilar Actas y después la imagen de pruebas:

```sh
docker compose --env-file .env.tuvoto -p tuvoto build actas
docker build -f microservicios/actas/pruebas/Dockerfile -t tuvoto-actas-lectura-pruebas .
docker run --rm --network none --read-only --tmpfs /tmp:rw,nosuid,noexec,size=160m --memory=768m --cpus=2 --pids-limit=96 --cap-drop ALL --security-opt no-new-privileges tuvoto-actas-lectura-pruebas
```

No se pasan variables de TUVOTO, volúmenes, redes ni puertos. Las imágenes se generan en memoria y el OCR usa `/tmp` temporal. Los límites de identidad/asignación del test HTTP usan dobles explícitos; el OCR sí ejecuta el binario real. La prueba impide cualquier acceso a persistencia. No es una validación integral de los cuatro servicios con una sesión real.

Para comprobar además la tabla imprimible, ejecutar la misma imagen con `python -m unittest discover -s pruebas -p test_formato_tabla.py -v` como comando, conservando los límites de aislamiento anteriores. La imagen de pruebas copia únicamente el PNG sintético necesario. Esta variante Docker quedó preparada, no ejecutada en la entrega del 2026-11-24; en esa entrega se ejecutaron localmente 12 pruebas de OCR real con Tesseract 5.5.4 y datos españoles, sin servicios ni persistencia.

La lectura de producción admite JPEG/PNG de hasta 10 MB y 24 megapíxeles y máximo dos solicitudes de lectura simultáneas. La copia temporal se elimina incluso al fallar; el original del acta se conserva por el flujo de registro existente. El PNG renderizado y su conversión a JPEG no sustituyen una prueba de cámara física con papel, perspectiva e iluminación variables.
