# Feria: guía completa de TUVOTO con mapa vivo y ngrok

Objetivo: que el público fotografíe actas de práctica con su celular y vea en el monitor cómo cada acta recorre los microservicios, cómo el sistema rechaza intentos indebidos y cómo se recupera si se derriba un servicio.

Todo se hace en una **elección de prueba** (institución, cargos y candidaturas ficticios). Nada de esta guía usa datos electorales reales. Detalles técnicos del observador en [infraestructura/mapa-vivo](../../infraestructura/mapa-vivo/README.md).

## 0. Qué vas a montar

```text
 Celular del visitante ──(sus datos móviles)──> https://TU-DOMINIO.ngrok-free.app
                                                         │  túnel ngrok
 Tu celular: punto de acceso ──internet──> LAPTOP ───────┘
                                            ├─ TUVOTO en Docker (127.0.0.1:8890)
                                            ├─ Mapa vivo (127.0.0.1:8891, solo en el monitor)
                                            └─ ngrok http 8890
```

El visitante no se conecta a tu Wi-Fi: escanea el QR y entra con sus propios datos. Tu celular solo le da internet a la laptop, así que no importa el límite de dispositivos del punto de acceso. El mapa vivo nunca se publica en internet.

## 1. ZIP o la misma laptop

- **Si llevas esta misma laptop**, no necesitas restaurar nada. La elección, las cuentas y las actas viven en volúmenes de Docker y siguen ahí. El ZIP es solo una copia de seguridad del código.
- **Para crear el ZIP:**

  ```bash
  scripts/empaquetar-feria.sh
  ```

  Crea `~/TUVOTO-feria-AAAA-MM-DD.zip`. Excluye `node_modules`, `dist` y los secretos; comprueba que no se haya colado ninguno.
- **`.env.tuvoto` y `.env.tuvoto-administrador.json` no van en el ZIP.** Si los necesitas en otra máquina, cópialos aparte en un medio tuyo.
- **Restaurar en otra laptop** (con Docker instalado). Se empieza con la base vacía:
  1. Descomprime y entra a la carpeta.
  2. Copia allí tu `.env.tuvoto`.
  3. Levanta todo:

     ```bash
     docker compose --env-file .env.tuvoto -p tuvoto up -d --build --wait
     ```

  4. Crea el administrador (lee usuario y contraseña del archivo, sin escribirlos en la terminal):

     ```bash
     docker exec -i tuvoto-identidad-1 node dist/administrar.js < .env.tuvoto-administrador.json
     ```

  5. Sigue desde la sección 2.4.

## 2. La noche anterior (con internet en casa)

### 2.1 Instalar ngrok y obtener tu dominio fijo

1. Crea una cuenta gratis en <https://ngrok.com> e inicia sesión en <https://dashboard.ngrok.com>.
2. Instala el agente. En CachyOS/Arch, con el binario oficial:

   ```bash
   curl -fsSL https://bin.ngrok.com/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz | tar -xz
   ```

   ```bash
   sudo mv ngrok /usr/local/bin/
   ```

   También puedes usar el paquete `ngrok` del AUR.
3. Copia tu authtoken desde el panel (*Your Authtoken*) y guárdalo en el agente:

   ```bash
   ngrok config add-authtoken TU_AUTHTOKEN
   ```

4. En el panel, sección *Domains*, aparece tu **dominio gratuito**, por ejemplo `algo.ngrok-free.app`. Es fijo: el QR no cambia entre días.

### 2.2 Variables en `.env.tuvoto`

Abre `.env.tuvoto`, que es privado y está fuera de Git, y deja estas líneas. Cambia `TU-DOMINIO` por el tuyo:

```sh
TUVOTO_ORIGEN=http://127.0.0.1:8890,https://TU-DOMINIO.ngrok-free.app
TUVOTO_COOKIE_SEGURA=false
TUVOTO_FERIA_URL=https://TU-DOMINIO.ngrok-free.app/?feria
```

- `TUVOTO_ORIGEN` debe tener la URL de ngrok **exacta**, con `https://` y sin barra final. Si no, el inicio de sesión desde el celular responde «Origen o CSRF inválido».
- `TUVOTO_FERIA_URL` es lo que codifica el QR. `?feria` muestra en el portal la bienvenida «Entrar como operador».

### 2.3 Desplegar el código nuevo

Desde la carpeta del proyecto, reconstruye Actas (detección automática) y el frontend (operador nuevo), y recrea Identidad para que lea `TUVOTO_ORIGEN`:

```bash
docker compose --env-file .env.tuvoto -p tuvoto up -d --build --wait actas frontend identidad
```

Comprueba que los 13 contenedores estén sanos (*healthy*):

```bash
docker compose --env-file .env.tuvoto -p tuvoto ps
```

### 2.4 Preparar la elección de prueba

Entra como administrador en `http://127.0.0.1:8890/#panel`.

1. **Institución:** crea una nueva con «+ Nueva institución», por ejemplo «Universidad de Demostración», y selecciónala.
2. **Elección → Cargos:** «Nuevo cargo». Crea 2 o 3, por ejemplo Decano, Rector y Director.
3. **Elección → Candidatos:** «+ Agregar candidato», con 2 o 3 nombres ficticios por cargo. Esos nombres saldrán impresos en las actas.
4. **Elección → Mesas de la elección:** «Crear mesa» o «Importar Excel». Con 5 a 10 mesas por cargo alcanza para varias rondas de visitantes; cada mesa admite una primera acta y luego correcciones.
5. **Equipo → Operadores:** «+ Crear operador». Crea unas 10 cuentas, por ejemplo `operador01` a `operador10`, con claves de 12 o más caracteres. Asigna a cada uno varias mesas de distintos cargos con «Asignar mesas».
6. **Conteo y publicación → Estado y publicación:** «Iniciar conteo» en cada cargo. Sin esto, la lectura responde «La recepción está cerrada».

### 2.5 Generar e imprimir las actas

1. Con el conteo ya iniciado, abre `http://127.0.0.1:8890/ejemplos/actas-practica.html`.
2. Aparecen marcados los cargos publicados. Deja marcadas las opciones:
   - **Agregar una hoja con la suma errónea**, para mostrar un acta observada.
   - **Agregar la versión 2 de una mesa**, para mostrar una corrección que reemplaza sin sumar.
3. Pulsa **Generar actas**. Sale una hoja A4 por mesa y por cargo, con el código de mesa, el cargo, el sector y las candidaturas tal como están en el sistema, y cifras ficticias que cuadran.
4. Pulsa **Imprimir o guardar PDF**. Imprime en papel blanco y al 100 %, sin «ajustar a la página».
5. Para un segundo juego con otras cifras, cambia **Variante** (2, 3…) y vuelve a generar.

Las hojas están diseñadas para el lector: sin líneas verticales junto a las cifras, y con cifras del mismo tamaño que los nombres. En 40 hojas de prueba, el sistema identificó la mesa, el cargo y todas las cifras. No está validado con escritura a mano: si una hoja no se lee, el operador elige la mesa y escribe las cifras.

### 2.6 Tarjetas de operador y cartel

- **Tarjetas:** papeles con usuario y clave de cada operador. Entrégalas en el puesto y recógelas después. Nunca las subas al repositorio.
- **Cartel con el QR:** se imprime en la sección 3.1, después de arrancar el mapa vivo, porque toma el QR de `TUVOTO_FERIA_URL`.

### 2.7 Ensayo general en casa

Haz la sección 3.1 completa y escanea 2 o 3 actas con tu celular **usando datos móviles, no el Wi-Fi de casa**. Así pruebas el túnel de verdad. Cada ensayo consume solicitudes del plan gratuito (sección 4), así que no lo alargues.

### 2.8 ZIP de respaldo

```bash
scripts/empaquetar-feria.sh
```

## 3. En la feria

### 3.1 Encender (unos 5 minutos)

1. Conecta la laptop al punto de acceso de tu celular.
2. Si reiniciaste la laptop, enciende Docker. Los contenedores de TUVOTO vuelven solos, salvo que los hayas detenido con `stop`:

   ```bash
   sudo systemctl start docker
   ```

   Si los habías detenido, levántalos de nuevo:

   ```bash
   docker compose --env-file .env.tuvoto -p tuvoto up -d --wait
   ```

3. Abre el túnel en una terminal y déjala abierta:

   ```bash
   ngrok http 8890 --url=https://TU-DOMINIO.ngrok-free.app
   ```

4. En otra terminal, desde la carpeta del proyecto, arranca el mapa vivo:

   ```bash
   scripts/feria-mapa-vivo.sh --caos
   ```

5. En el monitor abre `http://127.0.0.1:8891` en pantalla completa (F11). Debe decir «Registro de entrada: activo» y las colas «Conectado».
6. Abre e imprime el cartel: `http://127.0.0.1:8891/cartel`.
7. Prueba final con tu celular **en datos móviles**: escanea el QR, toca *Visit Site* en el aviso de ngrok y verifica que veas la bienvenida y una luz en el mapa.

### 3.2 Qué hace el visitante

1. Escanea el QR. El plan gratuito de ngrok muestra primero un aviso: toca **Visit Site**. Solo aparece una vez por celular.
2. En la bienvenida toca **Entrar como operador** y entra con su tarjeta.
3. Toca **Escanear acta** y fotografía la hoja completa, recta y con buena luz. No elige la mesa: el sistema la detecta por el código, las candidaturas, el cargo y el sector impresos.
4. Revisa las cifras (verde = leído, ámbar = completar, azul = editado). La suma se comprueba sola.
5. Marca «He comparado los datos con el acta» y toca **Confirmar y enviar**. En el monitor, su acta viaja a RabbitMQ, a Conteo y Auditoría, y las barras se actualizan.
6. **Escanear siguiente acta.** Si dos mesas empatan, elige una. Si aparece «Otras actas se están leyendo», el sistema reintenta solo, porque lee dos fotos a la vez.

### 3.3 Momentos del presentador (tecla P en el mapa)

| Botón | Qué se ve |
|---|---|
| Apagar conteo → que alguien envíe un acta → Encender conteo | Conteo en rojo, una ficha esperando en la cola y luego «1 acta en espera procesada · ninguna se perdió». |
| Derribar actas, resultados o conteo | El nodo se pone rojo unos segundos y vuelve con «Docker lo reinició automáticamente» e insignia ↻1. |
| Sesión falsificada / Ruta interna desde fuera | Rebote rojo con 401 en Identidad y 403 en Entrada. |
| Ráfaga de 300 consultas | Luces azules y un anuncio con el p95. Consume 300 solicitudes locales; **no pasa por ngrok**. |
| Escanear la versión 2 o la hoja con suma errónea | «Corrección v2: reemplaza, no suma» o «Acta observada». |

### 3.4 Guion de 90 segundos

1. «Esto es TUVOTO: cuatro microservicios, cada uno con su base de datos». Señala el mapa.
2. «Escanea el QR, entra con esta tarjeta y fotografía un acta. Mira: el sistema reconoce sola la mesa y el cargo, Identidad revisa tus permisos y Elecciones confirma por gRPC que la mesa es tuya».
3. «Ahora va como evento a RabbitMQ, que lo reparte a Conteo y a Auditoría, y el resultado público se actualiza».
4. «¿Y si alguien hace trampa?»: «Sesión falsificada» y rebote rojo.
5. «¿Y si se cae un servicio?»: apaga Conteo, deja que envíen un acta y enciéndelo. «Ninguna se perdió».

### 3.5 Apagar

1. `Ctrl+C` en la terminal de ngrok.
2. Retira el mapa (NGINX vuelve a su configuración normal, sin borrar datos):

   ```bash
   scripts/feria-mapa-vivo.sh --detener
   ```

3. Si quieres detener todo TUVOTO:

   ```bash
   docker compose --env-file .env.tuvoto -p tuvoto stop
   ```

## 4. Límites de ngrok gratis y plan B

El plan gratuito permite **20.000 solicitudes HTTP y 1 GB al mes**, y muestra el aviso *Visit Site*. Cada portal abierto en un celular consulta resultados cada 10 s (unas 6 solicitudes por minuto), y cada acta escaneada suma unas 15–20. Cien visitantes de 5 minutos rondan las 10.000 solicitudes.

- Pide que cierren la pestaña al terminar. Revisa el consumo en el panel de ngrok (*Usage*).
- Si llegas al límite, ngrok muestra un error en lugar del portal. Pasa al plan B, o contrata el plan pagado, que además quita el aviso.

**Plan B, red local sin internet.** Los visitantes se conectan al punto de acceso de tu celular (unos 10 en Android, 5 en iPhone).

1. Con la laptop conectada al punto de acceso, mira su IP, por ejemplo `10.42.0.15`:

   ```bash
   ip -4 addr
   ```

2. En `.env.tuvoto` cambia:

   ```sh
   TUVOTO_FERIA_IP=10.42.0.15
   TUVOTO_FERIA_PUERTO=8892
   TUVOTO_FERIA_URL=http://10.42.0.15:8892/?feria
   TUVOTO_ORIGEN=http://127.0.0.1:8890,https://TU-DOMINIO.ngrok-free.app,http://10.42.0.15:8892
   ```

3. Recrea Identidad:

   ```bash
   docker compose --env-file .env.tuvoto -p tuvoto up -d --wait identidad
   ```

4. Vuelve a ejecutar el mapa, que recrea el QR y abre el puerto 8892:

   ```bash
   scripts/feria-mapa-vivo.sh --caos
   ```

5. Android muestra en su punto de acceso un QR para unirse al Wi-Fi: los visitantes lo escanean primero y luego el del cartel.

Sin red de ningún tipo, el operador usa el navegador de la laptop en `http://127.0.0.1:8890` y el mapa funciona igual.

## 5. Problemas frecuentes

| Síntoma | Solución |
|---|---|
| «Origen o CSRF inválido» al entrar por el celular | La URL de `TUVOTO_ORIGEN` no coincide exactamente con la de ngrok, o Identidad no se recreó (paso 2.3). |
| El QR abre otra dirección | Corrige `TUVOTO_FERIA_URL` y vuelve a ejecutar `scripts/feria-mapa-vivo.sh --caos`. |
| ngrok dice que el dominio no es tuyo o no arranca | Revisa el authtoken (2.1) y copia el dominio tal cual aparece en *Domains*. |
| «La recepción está cerrada» al escanear | Falta «Iniciar conteo» en ese cargo (2.4). |
| «No tienes mesas con la recepción abierta» | El operador no tiene mesas asignadas, o sus cargos no iniciaron el conteo. |
| No detecta la mesa o deja cifras vacías | Más luz, hoja recta y completa en la foto. Si no, el operador elige la mesa y escribe las cifras. |
| Mapa con «Registro de entrada: sin señal» | Vuelve a ejecutar `scripts/feria-mapa-vivo.sh --caos`, que recrea NGINX con el registro. |
| Un nodo del mapa en gris («Sin datos») | Ese contenedor no responde. Revisa `docker compose --env-file .env.tuvoto -p tuvoto ps`. |

## 6. Qué está probado

Los pasos de las secciones 2.4 a 3.3 se ejecutaron automáticamente en un proyecto Docker aislado con `pruebas/ampliacion/probar-feria.mjs`, con OCR real sobre las actas generadas (ver la [entrega](../colaboracion/entregas/mapa-vivo-feria.md)). Faltan por probar el túnel ngrok, la cámara física con papel impreso y varios celulares reales a la vez: eso es el ensayo de la sección 2.7.
