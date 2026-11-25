# Mapa vivo de TUVOTO

Pantalla de demostración que dibuja en tiempo real el recorrido de cada solicitud y de cada acta por los microservicios. Es un **observador**: no es dueño de datos ni de reglas, no consulta bases de otros servicios y no publica fotografías ni identificadores de operadores.

La guía para la feria (red local, cuentas de prueba, actas impresas y guion) está en [feria-mapa-vivo.md](../../docs/presentaciones/feria-mapa-vivo.md).

## Señales que usa

| Señal | Origen | Qué dibuja |
|---|---|---|
| Registro de acceso | NGINX → syslog UDP 5140 ([nginx-registro.conf](nginx-registro.conf)) | Cada solicitud: ruta, estado y duración. Sin consulta, cabeceras ni cookies. |
| `acta.actualizada.v1` | Cola propia, exclusiva y temporal enlazada a `tuvoto.actas` | Acta nueva, corrección (diferencias contra la versión anterior vista), observada o anulada. |
| Profundidad de colas | `checkQueue` pasivo sobre `resultados.*.v1` y sus DLQ | Actas en espera y consumidores conectados. |
| Salud | `/api/v1/salud` de cada servicio y TCP a bases/broker | Estado de cada nodo; sin respuesta = caído. |
| Resultados | `GET /api/v1/publico/...` de Elecciones y Resultados | Barras del cargo con actividad más reciente. |
| Contenedores (opcional) | API de Docker, solo con la capa de caos | Reinicios y acciones del presentador. |

Las llamadas internas que se ven al llegar a un servicio (Actas → Identidad, Actas → Elecciones por gRPC, etc.) corresponden al camino fijo del código para esa ruta. La animación está ralentizada; cada luz representa una operación real. Sin señales, la pantalla muestra «Sin datos».

## Uso

```sh
scripts/feria-mapa-vivo.sh            # observador + registro de NGINX + puerto de feria
scripts/feria-mapa-vivo.sh --caos     # además permite derribar servicios desde la pantalla
scripts/feria-mapa-vivo.sh --detener  # retira el observador y devuelve NGINX a su configuración base
```

Abrir `http://127.0.0.1:8891` en el monitor. La tecla **P** abre los controles del presentador (se ocultan si la página se incrusta en un `iframe`). `http://127.0.0.1:8891/cartel` es un cartel A4 con el QR grande para la mesa del puesto.

| Variable (`.env.tuvoto`) | Uso |
|---|---|
| `TUVOTO_FERIA_IP`, `TUVOTO_FERIA_PUERTO` | Dirección de la laptop en la red local y puerto para los celulares (8892 por defecto). |
| `TUVOTO_FERIA_URL` | URL que codifica el QR de la pantalla y del cartel, p. ej. `http://192.168.0.10:8892/?feria` (`?feria` muestra la bienvenida «Entrar como operador»). |
| `TUVOTO_ORIGEN` | Debe incluir también la URL de feria, separada por coma, para que Identidad acepte el origen. |
| `TUVOTO_MAPA_PUERTO` | Puerto local del mapa (8891 por defecto). |
| `TUVOTO_MAPA_PROYECTO` | Proyecto Compose que controla la capa de caos (`tuvoto` por defecto). |

## Seguridad

- El mapa se publica solo en `127.0.0.1` y responde únicamente a hosts locales (evita DNS rebinding). Los controles exigen `X-Mapa-Vivo: presentador`, JSON y mismo origen.
- La capa de caos monta `/var/run/docker.sock`, equivalente a privilegios de administrador del host. Úsala solo en la laptop de la demostración y retírala al terminar. El observador limita las acciones a `derribar`, `apagar` y `encender` sobre `actas`, `resultados`, `resultados-conteo` y `resultados-auditoria`; «derribar» envía SIGINT al proceso y la política `restart: unless-stopped` lo vuelve a iniciar.
- «Sesión falsificada» registra un acta con una cookie inventada y «Ruta interna» llama a `/api/v1/interno` desde fuera: son solicitudes reales que el sistema debe rechazar. La ráfaga hace 300 consultas públicas.

## Pruebas

```sh
npm --prefix infraestructura/mapa-vivo run verificar
node infraestructura/mapa-vivo/pruebas/escenario-visual.mjs 8899   # fixture visual SINTÉTICO, no incluido en la imagen
```

La prueba integral (elección sintética, actas impresas, OCR real, resultados y caos) corre en el proyecto aislado de `pruebas/ampliacion/preparar-entorno.py` con `node pruebas/ampliacion/probar-feria.mjs`.

## Kubernetes

Este observador no se ha probado sobre Kubernetes. Para llevarlo al chart hacen falta los consumidores `resultados-conteo`/`resultados-auditoria` (ausentes en `infraestructura/helm`), imágenes locales importadas en k3d y un adaptador que liste y borre pods con una `Role` limitada al espacio de nombres.
