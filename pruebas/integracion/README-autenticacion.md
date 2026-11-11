# Autenticación aislada — M.3, M.4 y preparación estática M.5

La suite contiene operaciones que crean organizaciones, cuentas y recursos. **No debe ejecutarse contra P1 ni contra un destino cuyo aislamiento no esté demostrado.** No hay valores predeterminados de URL, usuario o contraseña. Tampoco se toman URL/usuario de variables de entorno implícitas. El wrapper anterior con argumentos posicionales o contraseña por argumento ya no es válido.

M.3/M.4 protegen la suite y sus verificaciones. M.5 añade un override independiente de pruebas y aclara la plantilla de entorno; no cambia lógica de servicios, NGINX ni el Compose base, y no ejecuta arranque, bootstrap, HTTP o acciones sobre datos/volúmenes.

## Estado M.5 y bloqueo explícito

Preparado `pruebas/integracion/compose.auth-test.yml` para proyecto **`sigape-auth-test`**, entrada **`http://127.0.0.1:8888`**, cookies HTTP locales **`COOKIE_SEGURA="false"`** y recursos propios. Este override no debe emplearse para desplegar la versión estable ni combinarse con el `.env` principal.

**La suite no está habilitada para ese identificador:** la guardia M.3 exige `sigape-auth-pruebas-` más un sufijo aleatorio. `sigape-auth-test` no cumple ese patrón. Se conserva ese rechazo; no se modifica el Python para eludirlo ni se falsean etiquetas en el manifiesto. Para habilitar las pruebas se requiere una decisión posterior explícita: adaptar de forma revisada la lista de identificadores admitidos o cambiar el nombre solicitado del proyecto. Renombrar solo el JSON no resuelve la incompatibilidad.

Además faltan inspecciones reales recientes del principal y candidato. La validación estática solo demuestra cómo está configurado el candidato; **no demuestra el estado de recursos que ya existan en Docker**. No se acredita que los nombres `sigape-auth-test_*` estén libres ni que 8888 esté disponible. Si alguno ya existe, no reutilizarlo ni borrarlo automáticamente: detener la preparación y revisar su procedencia en una fase autorizada. Sin esa evidencia, no ejecutar suite ni bootstrap.

### Inventario de configuración

| Elemento | Compose base observado | Override de pruebas |
| --- | --- | --- |
| Proyecto | `sigape` | `sigape-auth-test` |
| Datos persistentes | Cuatro volúmenes lógicos: PostgreSQL, MongoDB, Redis, RabbitMQ; sin `external` ni nombres físicos fijados | Nombres físicos explícitos `sigape-auth-test_datos_{postgres,mongodb,redis,rabbitmq}`, `external: false`, driver local, sin driver_opts. |
| Redes | `red_entrada` y `red_interna`; esta última interna | `sigape-auth-test_red_entrada` y `sigape-auth-test_red_interna`, `external: false`; se conserva `internal: true`. |
| Contenedores | Sin `container_name`; hostname RabbitMQ interno fijo | Sin `container_name` ni namespaces compartidos. El hostname RabbitMQ no comparte datos entre redes distintas. |
| Puerto | Entrada 8080 por defecto, no limitada a loopback | Única publicación: `127.0.0.1:8888` → `entrada-nginx:80`; `!override` evita acumular 8080. |
| Bind mounts | Inicializadores PostgreSQL/MongoDB, definiciones RabbitMQ y configuración NGINX desde el árbol principal | Cuatro archivos de una **copia temporal fuera del repositorio**, solo lectura y `create_host_path: false`; nunca montajes del árbol principal. |
| Construcción | Contexto `.` | Todos los servicios compilables usan la copia temporal. No se copian dependencias, bases ni configuración sensible del principal. |

Las imágenes pueden añadir volúmenes anónimos, por ejemplo MongoDB; no se garantiza su identidad mediante YAML. Las inspecciones posteriores deben comprobar también esos montajes y demostrar que no coinciden con el principal. El override usa nombres propios fijos por requisito de esta fase: distinguen este proyecto del principal, pero **no garantizan un entorno vacío ni hacen seguro compartir esos nombres con otra ejecución**.

### Preparar copia y credenciales sin Docker

El siguiente procedimiento, para revisión y ejecución local explícita, solo crea una carpeta temporal y archivos privados. No lee `.env`, no usa contraseñas predeterminadas y no imprime credenciales. No se ha ejecutado en la verificación estática M.5.

```sh
python3 - <<'PY_PREPARACION'
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import tempfile

raiz = Path.cwd().resolve()
if not (raiz / '.env.example').is_file():
    raise SystemExit('Ejecutar desde la raíz del repositorio.')
carpeta = Path(tempfile.mkdtemp(prefix='sigape-auth-test-'))
copia = carpeta / 'copia'
copia.mkdir(mode=0o700)
# Inventario publicable; no copia .git, dependencias ignoradas ni estado Docker.
nombres = subprocess.check_output([
    'git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'
]).split(b'\0')
for nombre in sorted(set(n for n in nombres if n)):
    relativo = Path(nombre.decode())
    origen = raiz / relativo
    if (relativo.is_absolute() or '..' in relativo.parts or origen.is_symlink()
        or not origen.is_file() or '.git' in relativo.parts
        or any(p in ('secrets', 'node_modules', 'dist', 'build', '__pycache__') for p in relativo.parts)
        or (origen.name.startswith('.env') and origen.name != '.env.example')
        or origen.suffix in ('.pem', '.key')):
        raise SystemExit('Inventario no publicable; revisar antes de continuar.')
    destino = copia / relativo
    destino.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(origen, destino)
lineas = []
for linea in (raiz / '.env.example').read_text().splitlines():
    if not linea or linea.startswith('#'):
        continue
    clave, valor = linea.split('=', 1)
    if 'CLAVE' in clave:
        valor = secrets.token_hex(32)
    if clave == 'PUERTO_HTTP_PUBLICO': valor = '8888'
    if clave == 'ORIGEN_PUBLICO': valor = 'http://127.0.0.1:8888'
    if clave == 'COOKIE_SEGURA': valor = 'false'
    if clave == 'SIGAPE_AUTH_COPIA': valor = str(copia)
    lineas.append(clave + '=' + valor)
# El archivo contiene solo credenciales NUEVAS del candidato y no entra en Git/build.
entorno = carpeta / 'entorno-privado.env'
fd = os.open(entorno, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as salida:
    salida.write('\n'.join(lineas) + '\n')
print('Carpeta privada preparada:', carpeta)  # Solo ruta, nunca contenido del entorno.
PY_PREPARACION
```

No almacenar el entorno privado dentro del repositorio, no versionarlo ni incluirlo en capturas/logs. No generar una contraseña compartida de SUPERADMIN; su preparación y bootstrap quedan fuera de M.5. El generador no lee ni compara los secretos del principal: genera cada clave con 32 bytes aleatorios independientes.

### Comprobación de composición sin arrancar servicios

Tras revisar la carpeta generada, sustituir la ruta de ejemplo por la real. Esta es una operación de configuración, sin conexión al daemon ni creación de contenedores/volúmenes:

```sh
docker compose \
  --env-file /RUTA_PRIVADA/entorno-privado.env \
  --project-name sigape-auth-test \
  -f /RUTA_PRIVADA/copia/docker-compose.yml \
  -f /RUTA_PRIVADA/copia/pruebas/integracion/compose.auth-test.yml \
  config --quiet
```

Requiere Compose que soporte `!override`. No utilizar el Compose base ni el `.env` del directorio principal por omisión, no sustituir `--env-file` por el original y no imprimir `config` completo: podría mostrar secretos resueltos. No hay instrucciones de arranque o limpieza en este procedimiento.

### Compatibilidad con evidencia M.3/M.4

- `urlBase` debe ser exactamente `http://127.0.0.1:8888`.
- `directorioAislado` debe ser la carpeta real `copia`, fuera del repositorio principal.
- La composición resuelta debe conservar nombres físicos de recursos, puertos y todos los montajes. Puede sanear secretos, pero **debe conservar `services.identidad.environment.COOKIE_SEGURA: "false"`**, requerido por M.4.
- Los volúmenes y redes del override tienen el prefijo `sigape-auth-test_` coherente con el proyecto. Los binds quedan bajo la copia; esa separación se debe contrastar con los montajes efectivos del principal.
- **Bloqueado por nombre:** `idEntorno=sigape-auth-test` y las etiquetas reales del candidato no pasan la expresión de M.3. No modificar las pruebas ni afirmar compatibilidad completa.
- **Bloqueado por evidencia pendiente:** no existen en esta fase inspecciones nuevas de `principal`/`candidato`, ni se pueden inventar IDs, montajes o estados `running`. Tampoco se sustituye el manifiesto por el resultado de un análisis YAML.

La verificación M.5 es estática: YAML, recursos/puertos/montajes, referencias de construcción, interpolación con marcadores no secretos y `git diff --check`. No acredita arranque, disponibilidad, autenticación ni aislamiento efectivo en el daemon. Si no se obtiene la evidencia o no se resuelve la discrepancia de nombre en una fase posterior, se mantiene el aborto preventivo.

Resultado observado en M.5: YAML válido; `docker compose config --format json` resolvió con marcadores sintéticos, capturando la salida en memoria sin imprimir credenciales. Se comprobaron publicación única, nombres físicos, ausencia de `external`, política de cookie, contextos de construcción y sustitución de los cuatro binds. `git diff --check` pasó. No se conectó al daemon ni se ejecutaron arranque, bootstrap o HTTP. La discrepancia del nombre se confirmó por lectura de la expresión de M.3, sin ejecutar la suite.

## Condiciones obligatorias antes de cualquier solicitud HTTP

1. `--url` explícita: solo `http://127.0.0.1:PUERTO` o `https://127.0.0.1:PUERTO`, con puerto entre 1024 y 65535 distinto de 8080. Se rechazan `localhost` (incluido `localhost:8080`), `127.0.0.1:8080`, alias DNS, otras direcciones, credenciales en URL, rutas base, parámetros y fragmentos.
2. `--usuario-superadmin` explícito: una cuenta de prueba creada previamente mediante un procedimiento independiente y revisado. Esta suite no ejecuta bootstrap.
3. `--entorno-aislado`: `sigape-auth-pruebas-` seguido de 8 a 32 letras minúsculas o dígitos. No se acepta `sigape` ni un nombre genérico compartido.
4. `--configuracion-aislamiento`: JSON privado del usuario ejecutor, sin permisos de grupo/otros (0600), con las evidencias descritas abajo.
5. `--confirmar-escrituras`: texto exacto `AUTORIZO-ESCRITURAS-EN:` seguido del identificador del entorno. Confirma todas las escrituras de esa ejecución, incluidas las pruebas que esperan rechazo; un backend defectuoso podría aceptarlas.
6. Contraseña suministrada explícitamente por stdin o por una variable de entorno limitada al proceso. No se acepta un parámetro de contraseña.

La validación completa precede incluso a las consultas de salud y de CSRF. Se vuelve a comprobar URL, vigencia, integridad del archivo y confirmación antes de cada solicitud. Una llamada importada a los clientes o a la suite, sin configuración previamente autorizada, también aborta. No se siguen redirecciones HTTP y se deshabilitan los proxies heredados del entorno: no pueden desviar cookies, credenciales ni operaciones a otro destino.

## Evidencia de aislamiento exigida

**Usar `-p` no garantiza aislamiento:** volúmenes `external`, nombres físicos fijos, `container_name`, redes compartidas, `volumes_from`, namespaces del anfitrión o montajes bind compartidos pueden reutilizar datos del principal aunque el proyecto tenga otro nombre.

Antes de autorizar la suite, un operador debe preparar y revisar las evidencias reales del entorno ya aislado mediante un procedimiento externo a estos guiones. La suite solo las lee; no invoca Docker. No inventar inspecciones ni completar campos con valores de ejemplo para superar la validación.

El JSON debe contener:

| Campo | Contenido obligatorio |
| --- | --- |
| `version` | Entero `1`. |
| `idEntorno` | Identificador exacto de proyecto aislado, igual al argumento. |
| `urlBase` | URL canónica exacta, sin barra final, igual al argumento normalizado. |
| `capturadoEn` | Fecha UTC ISO 8601 con zona horaria, de captura conjunta de las evidencias; máximo diez minutos. |
| `directorioAislado` | Directorio existente de la copia temporal, fuera del repositorio principal. Los bind mounts deben ser archivos/subdirectorios dentro de esa copia. |
| `composicion` | Composición **efectivamente resuelta**, con `name`, `services`, `volumes` y `networks`. Conservar los campos de aislamiento relevantes; no incluir secretos de `environment`, comandos o argumentos de construcción. |
| `principal` | Lista completa de inspecciones sanitizadas de contenedores del proyecto `sigape`, incluidos sus almacenes y entrada pública. |
| `candidato` | Lista completa de inspecciones sanitizadas de los contenedores de la composición aislada. |

Para cada elemento de las listas de inspección se requieren los campos reales:

```text
Id
Config.Labels[com.docker.compose.project]
Config.Labels[com.docker.compose.service]
State.Status
State.ExitCode                    (para la tarea finita)
Mounts[].Type
Mounts[].Name                     (volúmenes)
Mounts[].Source                   (bind)
Mounts[].Destination
NetworkSettings.Networks
NetworkSettings.Ports
```

No incluir `Config.Env` ni contraseñas, cookies, tokens o claves internas. Los identificadores de contenedores y volúmenes no son credenciales. El archivo privado no debe versionarse ni incorporarse a evidencias públicas.

La composición resuelta debe conservar `services.*.volumes` y `ports` en sintaxis larga, y los campos `container_name`, `volumes_from`, `network_mode`, `pid`, `ipc`, `extends` o `privileged` si existiesen: no se pueden suprimir para aparentar aislamiento. Las definiciones `volumes` y `networks` deben incluir nombres físicos resueltos y condición `external`.

El validador exige:

- Proyecto candidato coherente y distinto del principal; IDs de contenedor válidos, completos y sin intersección.
- Volúmenes declarados sin `external`, con nombres físicos que empiezan por el identificador aislado. Los volúmenes efectivos deben coincidir con esos nombres; los anónimos adicionales deben tener identificadores físicos completos. Ninguno puede coincidir con los del principal.
- Bind mounts efectivos y declarados coherentes, contenidos en la copia aislada y sin solapamiento con montajes del principal, incluidos directorios padre/hijo.
- Redes declaradas y efectivas propias, sin redes del principal. Se rechazan namespaces compartidos, contenedores con nombres fijos y modo privilegiado.
- Una única publicación efectiva, de `entrada-nginx`, ligada a `127.0.0.1` en el puerto autorizado. El puerto no puede pertenecer al principal según su inspección.
- Todos los servicios resueltos presentes y en ejecución; se admite `configurar-mensajeria` finalizada con salida 0.

El archivo se comprueba por SHA-256 durante la ejecución; editarlo invalida la autorización. Su vigencia también caduca durante la suite: si supera diez minutos, aborta sin efectuar la siguiente solicitud. No hay renovación automática ni limpieza de datos parcial.

**Límite de confianza:** son evidencias locales proporcionadas por el operador, no una certificación criptográfica ni una inspección en vivo. Deben proceder del entorno efectivo y mantenerse sin cambios durante toda la ejecución. Si son incompletas, antiguas, dudosas o el entorno cambia, no se puede demostrar aislamiento: no ejecutar la suite; obtener evidencias nuevas mediante el procedimiento revisado. Un simple booleano `aislado=true` o un nombre de proyecto no sustituye esas evidencias.

## Entrega explícita de credenciales

Las variables del siguiente ejemplo deben definirse previamente para el entorno revisado; no representan valores predeterminados. No copiar contraseñas a la línea de comandos, al historial ni a este documento.

Con un archivo de contraseña temporal privado, fuera del repositorio, permisos 0600, y contenido entregado por un canal seguro:

```sh
sh pruebas/integracion/probar-autenticacion.sh \
  --url "$URL_AISLADA" \
  --usuario-superadmin "$USUARIO_PRUEBA" \
  --entorno-aislado "$ENTORNO_AISLADO" \
  --configuracion-aislamiento "$CONFIGURACION_PRIVADA" \
  --confirmar-escrituras "AUTORIZO-ESCRITURAS-EN:$ENTORNO_AISLADO" \
  --clave-por-stdin < "$ARCHIVO_CLAVE_PRIVADO"
```

Alternativamente, `--clave-por-entorno` consume `SIGAPE_PRUEBA_CLAVE` y la retira del entorno Python inmediatamente después de leerla. Limitarla a esa invocación mediante una asignación temporal del shell; no exportarla globalmente, no usar una contraseña literal en el historial y no activar trazado. Las variables de entorno pueden ser observadas por procesos con privilegios suficientes; stdin privado es la alternativa preferida.

Python puede invocarse directamente con los mismos parámetros. Ambos caminos rechazan la antigua opción `--clave-superadmin`; los errores de argumentos no repiten valores que pudieran ser secretos. No se imprimen contraseñas ni cuerpos HTTP de error. Las cuentas auxiliares de prueba usan una contraseña aleatoria por ejecución, no una contraseña fija publicada.

## Verificación y alcance de esta fase

Verificación permitida para M.3: únicamente sintaxis Python, sintaxis Bash y `git diff --check`. No se ejecuta la suite, ni siquiera su modo estático. No se ejecutan Docker, bootstrap ni peticiones HTTP para validar estos cambios.

`--solo-estatico`, cuando se autorice su ejecución en otra fase, no acepta parámetros de ejecución/credenciales, no realiza HTTP y solo conserva la inspección textual de puertos existente. Esa inspección por sí sola **no demuestra aislamiento** ni habilita escrituras.

Los once grupos de pruebas de autenticación siguen siendo código pendiente de ejecución y revisión funcional; su presencia no demuestra que hayan pasado. M.3 no corrige otros defectos ya detectados en los casos de autenticación ni certifica cookies seguras, expiración, revocación o permisos del backend.

No se incluyen instrucciones de eliminación de volúmenes ni de archivos de entorno. Se conservan datos y evidencias, incluso si la suite aborta después de algunas operaciones; cualquier mantenimiento posterior requiere una revisión separada del destino y autorización específica.
