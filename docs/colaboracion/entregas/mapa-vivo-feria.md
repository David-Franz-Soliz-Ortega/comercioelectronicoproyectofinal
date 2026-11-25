# Mapa vivo y operador para la feria

Fecha: 2026-11-25. Responsable: Claude. Siguiente responsable: el usuario o QA de cámara.
Estado: **listo_para_qa**. Flujo completo verificado en un proyecto Docker aislado con OCR real. Falta la cámara física, la red del puesto y el despliegue sobre `tuvoto`, que requiere la autorización del usuario.

## Alcance

Se partió de `main` (`e27fc58`) con el árbol limpio. El usuario pidió:

- **Fase 1:** una pantalla de feria con el flujo real de los microservicios y cuatro momentos (derribar un servicio, intento indebido, corrección que no suma y ráfaga de carga).
- **Fase 2:** actas imprimibles, un operador más cómodo para escanear con autollenado, un QR para que el público entre y sea operador, y una recomendación de despliegue.

Se usó Docker Compose: k3d, kubectl y helm no están instalados y el chart de Helm no tiene los consumidores de resultados.

## Cambios

### Mapa vivo

- [`infraestructura/mapa-vivo`](../../../infraestructura/mapa-vivo/README.md): observador Node sin dueño de datos. Usa el syslog de NGINX, una cola exclusiva sobre `tuvoto.actas`, `checkQueue` pasivo, salud HTTP/TCP, endpoints públicos y, opcionalmente, Docker.
- Pantalla SVG con controles del presentador (tecla P) y cartel A4 con QR en `/cartel`.
- Capas Compose `docker-compose.mapa-vivo.yml` y `-caos.yml` (con `TUVOTO_MAPA_PROYECTO`) y el script `scripts/feria-mapa-vivo.sh`. `.dockerignore` y `.env.example` ajustados.

### Actas

- `app/lectura.py` incorpora `lineas_ocr` y `elegir_destino`, que usan el código de mesa, el nombre completo de las candidaturas, el cargo y el sector. Con empate devuelve opciones.
- `leer_foto(contenido, mesa=None, mesas=None)` detecta el destino y propone las cifras en la misma lectura.
- `POST /api/v1/actas/lectura` acepta `idMesa` o `candidatas`. Elecciones confirma cada candidata por gRPC; las ajenas o cerradas se omiten.
- Contrato actualizado en `compartido/contratos/openapi/actas.openapi.json` (campos `candidatas`, `idMesa`, `detectada` y `opciones`).
- El Dockerfile de pruebas acepta `ARG BASE`. Nueva suite `pruebas/test_destino.py`. Documentado en `LECTURA.md`.

### Frontend

- Nuevo [`OperadorActas.jsx`](../../../frontend/src/componentes/OperadorActas.jsx) con `operador.css` y reglas puras en `api/operadorActas.js`. El flujo es: escanear primero, detección, revisión con campos leído/completar/editado, reintento ante 429, elección ante empate, corrección y pantalla de enviado.
- Se retiró `PanelOperador` de `PanelPrivado.jsx`, junto con unas 540 líneas de CSS que solo usaba (privado, administracion y panel-sencillo). Se conservaron las clases del auditor y de la confirmación global.
- `?feria` en el portal muestra la bienvenida «Entrar como operador».
- [`ejemplos/actas-practica.html`](../../../frontend/public/ejemplos/actas-practica.html) genera actas imprimibles desde la configuración pública, con variantes de suma errónea y versión 2.

### Pruebas y documentación

- `pruebas/ampliacion/probar-feria.mjs` ejecuta la prueba integral.
- Guía [feria-mapa-vivo.md](../../presentaciones/feria-mapa-vivo.md) con las opciones de despliegue.

### Fase 3: ngrok y ZIP

- La guía de feria se reescribió paso a paso para un túnel ngrok: dominio fijo gratuito, `TUVOTO_ORIGEN` con la URL https, `TUVOTO_FERIA_URL` con `?feria`, límites del plan gratuito (20 000 solicitudes y 1 GB al mes, aviso *Visit Site*), plan B en red local, actas, tarjetas, encendido, apagado y problemas frecuentes.
- `nginx-registro.conf` usa `X-Forwarded-For` cuando existe: detrás del túnel todas las conexiones llegan desde 127.0.0.1. Se comprobó con `nginx -t`.
- `scripts/empaquetar-feria.sh` crea un ZIP sin dependencias ni secretos, y lo descarta si encuentra alguno.

## Pruebas ejecutadas

| Prueba | Resultado |
|---|---|
| `npm --prefix infraestructura/mapa-vivo run verificar` | 16/16 |
| `npm --prefix frontend run probar` | 82/82, incluidas 6 nuevas de `operador-actas.test.mjs` |
| `npm --prefix frontend run compilar` | Correcta |
| `frontend/pruebas/operador-escaneo-interfaz.mjs`, con `CHROMIUM_EJECUTABLE` apuntando al headless shell 1248 porque Playwright 1.56 busca el 1194 | Pasó: detección, 429, empate, corrección, error, respuesta antigua y 320–1440 px. APIs sintéticas. |
| Actas en contenedor `--network none` (`tuvoto-actas-lectura-qa:local`) | 39 OK, 7 SQL omitidas como antes, incluidas las 12 de `test_destino.py` con Tesseract real |
| OCR de las actas de práctica: 40 hojas renderizadas × PNG/JPEG 80 % | 80/80 con destino y cifras correctos tras el rediseño. Antes: 26/30. |
| `probar-feria.mjs` en `tuvoto-prueba-sectores-7771b34b` (puerto 18891, volúmenes, redes y claves propios) | Pasó todo; detalle abajo. |

Detalle de `probar-feria.mjs`:

- Bienvenida `?feria` e inicio de sesión real del operador.
- Cinco fotos de hojas impresas: la mesa y el cargo se detectaron sin elegirlos, incluido el mismo código en Decano y Rector, y se propusieron todas las cifras.
- La v2 reemplazó a la v1. La observada conservó su aporte y quedó en `requierenRevision`.
- El mapa recibió 5 eventos de RabbitMQ y las lecturas desde NGINX.
- Con el conteo apagado, el acta quedó en cola y se procesó al encenderlo, con 0 en la DLQ.
- Docker reinició auditoría tras derribarla. Ataques 401/403. Ráfaga 300/300.

## Lecciones verificadas

- **DNS en la red interna:** `getaddrinfo` se cuelga 5–10 s; se usa c-ares. Registrada en [lecciones](../lecciones.md).
- **OCR de tablas impresas:** los bordes verticales negros junto a las cifras y las cifras de 24–28 pt provocaron lecturas como «70→7», «5→NO» y «188→13838». Sin bordes verticales y con cifras del tamaño de los nombres, 80/80. Registrada en lecciones.

## Pendiente

- Desplegar en `tuvoto` (`actas`, `frontend`, `identidad` y el mapa) con autorización del usuario.
- Probar con la cámara física y papel impreso en la red del puesto.
- Probar 10–20 celulares reales. Actas atiende dos lecturas simultáneas y el resto reintenta.
- Kubernetes sin adaptador.
- El proyecto aislado `tuvoto-prueba-sectores-7771b34b`, sus volúmenes, sus imágenes y sus credenciales temporales ya se retiraron; `tuvoto` no se tocó (13 contenedores sanos).

## Siguiente acción

Con autorización, seguir la sección 2 de la guía de feria y recorrer su tabla de verificación con el celular real.
