# Lectura de actas impresas

La lectura usa Tesseract en español dentro de Actas, sin servicios externos. Es una propuesta editable: no registra fotografías, actas, votos ni eventos. La publicación conserva el flujo de confirmación humana y sus permisos anteriores.

## Ejemplo solicitado

El archivo `frontend/public/ejemplos/acta-prueba.png` está marcado **ACTA DE PRUEBA — SIN VALIDEZ** y se ofrece desde el formulario del operador. Su generador es `acta_sintetica.py`. No se cargó como resultado en ninguna elección.

El ejemplo contiene la mesa `PRUEBA-01`, candidaturas sintéticas `Candidatura Alfa` (120) y `Candidatura Beta` (80), blancos 3, nulos 2 y total 205. Para ensayarlo desde el formulario hace falta un entorno de prueba con esa mesa asignada, esos nombres de candidatura y recepción abierta. No enviarlo a una elección real.

Formato inicial admitido: una fila por dato, con nombre completo de candidatura y cantidad al final; luego `Blancos`, `Nulos` y `Total`. Incluir `Mesa: código`. Se normalizan tildes y mayúsculas, pero no se adivinan nombres ni se transforman letras en cifras. Las filas repetidas, nombres ambiguos y cifras con baja confianza quedan sin completar. Si se lee un código de mesa diferente, se rechaza la propuesta. Si falta el código, se advierte que debe compararse manualmente.

No se garantiza lectura de manuscritos, tablas de formatos ajenos, fotos borrosas ni documentos con varios cargos. La cobertura demostrada corresponde al ejemplo impreso y a sus variantes sintéticas PNG/JPEG, incluida orientación EXIF. Antes de usar un formato institucional hay que validarlo con fotografías de prueba tomadas en condiciones representativas.

## Pruebas aisladas

Desde la raíz, compilar Actas y después la imagen de pruebas:

```sh
docker compose --env-file .env.tuvoto -p tuvoto build actas
docker build -f microservicios/actas/pruebas/Dockerfile -t tuvoto-actas-lectura-pruebas .
docker run --rm --network none --read-only --tmpfs /tmp:rw,nosuid,noexec,size=160m --memory=768m --cpus=2 --pids-limit=96 --cap-drop ALL --security-opt no-new-privileges tuvoto-actas-lectura-pruebas
```

No se pasan variables de TUVOTO, volúmenes, redes ni puertos. Las imágenes se generan en memoria y el OCR usa `/tmp` temporal. Los límites de identidad/asignación del test HTTP usan dobles explícitos; el OCR sí ejecuta el binario real. La prueba impide cualquier acceso a persistencia. No es una validación integral de los cuatro servicios con una sesión real.

La lectura de producción admite JPEG/PNG de hasta 10 MB y 24 megapíxeles, máximo dos procesos simultáneos y 15 segundos por ejecución. La copia temporal se elimina incluso al fallar; el original del acta se conserva por el flujo de registro existente.
