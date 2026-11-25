// Prueba real de la feria SOLO en el proyecto sintético de preparar-entorno.py:
// actas de práctica impresas → foto → detección OCR real → registro → resultados
// públicos → mapa vivo (eventos, caída y recuperación del conteo, ataque).
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync, existsSync, openSync, closeSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const raiz = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(join(raiz, 'frontend/package.json'));
const {chromium} = require('playwright');
const entorno = JSON.parse(readFileSync('/tmp/tuvoto-ampliacion-entorno.json', 'utf8'));
const {proyecto, carpeta, url: base} = entorno;
assert.ok(proyecto.startsWith('tuvoto-prueba-sectores-') && base === 'http://127.0.0.1:18891', 'Solo el proyecto sintético');
const MAPA = 'http://127.0.0.1:18892';
const sufijo = randomBytes(3).toString('hex');
const ok = texto => console.log('OK:', texto);
const esperar = ms => new Promise(r => setTimeout(r, ms));
async function hasta(condicion, mensaje, intentos = 60, pausa = 500) {
  for (let i = 0; i < intentos; i += 1) { const r = await condicion(); if (r) return r; await esperar(pausa); }
  throw new Error('No ocurrió: ' + mensaje);
}
function privado(nombre, datos) {
  const ruta = join(carpeta, nombre);
  const fd = openSync(ruta, 'w', 0o600); writeFileSync(fd, JSON.stringify(datos)); closeSync(fd);
}

class Cliente {
  constructor() { this.cookies = new Map(); this.org = null; }
  async pedir(ruta, {datos, metodo, esperado = 200} = {}) {
    const cabeceras = {Origin: base, Accept: 'application/json'};
    if (this.org) cabeceras['X-Organizacion'] = this.org;
    if (this.cookies.has('tuvoto-csrf')) cabeceras['X-CSRF-Token'] = this.cookies.get('tuvoto-csrf');
    if (this.cookies.size) cabeceras.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (datos !== undefined) cabeceras['Content-Type'] = 'application/json';
    const r = await fetch(base + ruta, {method: metodo ?? (datos !== undefined ? 'POST' : 'GET'), headers: cabeceras, body: datos !== undefined ? JSON.stringify(datos) : undefined});
    for (const c of r.headers.getSetCookie()) { const [par] = c.split(';'); const i = par.indexOf('='); this.cookies.set(par.slice(0, i), par.slice(i + 1)); }
    const texto = await r.text();
    assert.equal(r.status, esperado, `${metodo ?? ''} ${ruta}: HTTP ${r.status} ${texto.slice(0, 200)}`);
    return texto ? JSON.parse(texto) : null;
  }
  async login(usuario, contrasena) { await this.pedir('/api/v1/autenticacion/csrf'); await this.pedir('/api/v1/autenticacion/login', {datos: {usuario, contrasena}}); }
}

// 1. Datos sintéticos: institución, dos cargos que comparten el código de mesa y un operador.
const credenciales = join(carpeta, 'cuenta-prueba.json');
let cuenta;
if (existsSync(credenciales)) cuenta = JSON.parse(readFileSync(credenciales, 'utf8'));
else {
  cuenta = {usuario: 'admin.pruebas', contrasena: randomBytes(18).toString('base64url')};
  const r = spawnSync('docker', ['exec', '-i', proyecto + '-identidad-1', 'node', 'dist/administrar.js'], {input: JSON.stringify(cuenta), encoding: 'utf8'});
  assert.equal(r.status, 0, 'Bootstrap aislado no confirmado');
  privado('cuenta-prueba.json', cuenta);
}
const admin = new Cliente();
await admin.login(cuenta.usuario, cuenta.contrasena);
admin.org = (await admin.pedir('/api/v1/organizaciones', {datos: {nombre: 'Universidad de Demostración ' + sufijo}, esperado: 201})).idOrganizacion;
const procesos = [];
for (const [cargo, unidad, candidatos] of [['Decano', 'Facultad', ['Ana Quiroga Prueba', 'Bruno Salinas Prueba']], ['Rector', 'Universidad', ['Carla Méndez Prueba', 'Diego Rojas Prueba', 'Elena Vargas Prueba']]]) {
  const p = await admin.pedir('/api/v1/configuracion/procesos', {datos: {nombre: `${cargo} de demostración ${sufijo}`, cargo, tipo: 'universidad', unidad, ambito: `${unidad} de demostración`}, esperado: 201});
  for (const nombre of candidatos) await admin.pedir(`/api/v1/configuracion/procesos/${p.id}/candidatos`, {datos: {nombre}, esperado: 201});
  for (const codigo of cargo === 'Decano' ? ['FERIA-01', 'FERIA-02'] : ['FERIA-01']) await admin.pedir(`/api/v1/configuracion/procesos/${p.id}/mesas`, {datos: {codigo, unidad: 'Facultad de demostración', sector: 'general'}, esperado: 201});
  procesos.push(await admin.pedir(`/api/v1/configuracion/procesos/${p.id}`));
}
const operador = {usuario: 'operador.feria.' + sufijo, contrasena: randomBytes(18).toString('base64url')};
await admin.pedir('/api/v1/usuarios', {datos: {...operador, idOrganizacion: admin.org, rol: 'OPERADOR'}, esperado: 201});
privado('operador-feria.json', operador);
const idOperador = (await admin.pedir('/api/v1/usuarios?usuario=' + operador.usuario)).elementos[0].idUsuario;
for (const p of procesos) {
  for (const m of p.mesas) await admin.pedir(`/api/v1/configuracion/mesas/${m.id}/asignar`, {datos: {idUsuario: idOperador}, esperado: 204});
  await admin.pedir(`/api/v1/configuracion/procesos/${p.id}/actual`, {datos: {confirmar: true}});
}
const [decano, rector] = procesos;
ok('Elección sintética: Decano (FERIA-01, FERIA-02) y Rector (FERIA-01) con el mismo código de mesa, operador asignado y recepción abierta');

// 2. Mapa vivo con la capa de caos sobre el proyecto sintético.
const gid = execFileSync('getent', ['group', 'docker'], {encoding: 'utf8'}).split(':')[2];
const compose = [...entorno.comando.slice(1), '-f', join(raiz, 'infraestructura/mapa-vivo/docker-compose.mapa-vivo.yml'), '-f', join(raiz, 'infraestructura/mapa-vivo/docker-compose.mapa-vivo-caos.yml')];
const variables = {...process.env, TUVOTO_DOCKER_GID: gid, TUVOTO_MAPA_PROYECTO: proyecto, TUVOTO_MAPA_PUERTO: '18892', TUVOTO_FERIA_PUERTO: '18893', TUVOTO_FERIA_URL: 'http://127.0.0.1:18893/?feria'};
execFileSync('docker', [...compose, 'up', '-d', '--build', '--wait', 'mapa-vivo'], {env: variables, stdio: 'inherit'});
execFileSync('docker', [...compose, 'up', '-d', '--no-deps', '--wait', 'entrada-nginx'], {env: variables, stdio: 'inherit'});
const eventos = [];
const flujo = new AbortController();
(async () => {
  const r = await fetch(MAPA + '/api/flujo', {signal: flujo.signal});
  let resto = '';
  for await (const parte of r.body) {
    resto += Buffer.from(parte).toString('utf8');
    let corte;
    while ((corte = resto.indexOf('\n\n')) >= 0) {
      const bloque = resto.slice(0, corte); resto = resto.slice(corte + 2);
      const tipo = /^event: (.+)$/m.exec(bloque)?.[1]; const datos = /^data: (.+)$/m.exec(bloque)?.[1];
      if (tipo && datos && tipo !== 'estado') eventos.push({tipo, datos: JSON.parse(datos), t: Date.now()});
      if (tipo === 'estado') eventos.ultimoEstado = JSON.parse(datos);
    }
  }
})().catch(() => {});
await hasta(() => eventos.ultimoEstado?.registroEntrada && eventos.ultimoEstado?.mensajeria && eventos.ultimoEstado?.nodos?.conteo?.estado === 'ok', 'mapa vivo conectado a NGINX y RabbitMQ', 90);
assert.equal(eventos.ultimoEstado.controles.docker, true);
ok('Mapa vivo: registro de NGINX activo, RabbitMQ conectado, consumidores y contenedores visibles');

const presentador = async datos => {
  const r = await fetch(MAPA + '/api/presentador', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Mapa-Vivo': 'presentador'}, body: JSON.stringify(datos)});
  assert.equal(r.status, 202, 'presentador ' + datos.accion); return r.json();
};
const resultados = id => fetch(`${base}/api/v1/publico/resultados/${id}`).then(r => r.json());

const navegador = await chromium.launch({headless: true, ...(process.env.CHROMIUM_EJECUTABLE ? {executablePath: process.env.CHROMIUM_EJECUTABLE} : {}), args: ['--no-sandbox']});
const errores = [];
try {
  // 3. Actas de práctica impresas desde la configuración pública: cada hoja se convierte en "foto".
  const impresion = await navegador.newPage({viewport: {width: 1000, height: 1400}, deviceScaleFactor: 2});
  await impresion.goto(base + '/ejemplos/actas-practica.html');
  await impresion.locator('.hoja').nth(4).waitFor();
  const hojas = await impresion.locator('.hoja').evaluateAll(nodos => nodos.map(n => ({
    datos: Object.fromEntries([...n.querySelectorAll('.datos div')].map(d => d.textContent.split(': '))),
    filas: [...n.querySelectorAll('tr')].map(tr => [tr.cells[0].textContent, Number(tr.cells[1].textContent)]),
    practica: n.querySelector('.etiqueta-practica')?.textContent ?? null,
  })));
  assert.equal(hojas.length, 5);
  const fotos = [];
  for (let i = 0; i < hojas.length; i += 1) {
    const ruta = join(carpeta, `acta-${i}.${i === 2 ? 'jpg' : 'png'}`);
    await impresion.locator('.hoja').nth(i).screenshot({path: ruta, ...(i === 2 ? {type: 'jpeg', quality: 82} : {})});
    fotos.push(ruta);
  }
  assert.deepEqual(hojas.map(h => [h.datos.Mesa, h.datos.Cargo]), [['FERIA-01', decano.nombre], ['FERIA-02', decano.nombre], ['FERIA-01', rector.nombre], ['FERIA-01', decano.nombre], ['FERIA-02', decano.nombre]]);
  ok('Actas de práctica: 5 hojas A4 con los códigos y candidaturas publicados, una con suma errónea y una versión 2');

  // 4. El visitante entra por el QR (?feria) y llega al inicio de sesión del operador.
  const pagina = await navegador.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, hasTouch: true, isMobile: true});
  pagina.setDefaultTimeout(30000);
  pagina.on('pageerror', e => errores.push(e.message));
  await pagina.goto(base + '/?feria');
  await pagina.getByRole('heading', {name: 'Mira el conteo en vivo… o regístralo tú.'}).waitFor();
  await pagina.getByRole('link', {name: 'Entrar como operador'}).click();
  await pagina.locator('#usuario').fill(operador.usuario);
  await pagina.locator('#contrasena').fill(operador.contrasena);
  await pagina.locator('#contrasena').press('Enter');
  await pagina.getByRole('heading', {name: 'Hola, ' + operador.usuario}).waitFor();
  await pagina.getByText('Registraste 0 de 3 actas.').waitFor();
  await pagina.screenshot({path: '/tmp/tuvoto-feria-inicio.png', fullPage: true});
  ok('Bienvenida de feria, inicio de sesión real del operador y progreso 0 de 3');

  const valor = nombre => pagina.getByLabel(nombre, {exact: true}).inputValue();
  async function escanear(i, {detectar, cargo, codigo}) {
    const [selector] = await Promise.all([pagina.waitForEvent('filechooser'), pagina.getByRole('button', {name: /Escanear (acta|siguiente acta)/}).first().click()]);
    await selector.setFiles(fotos[i]);
    await pagina.locator('.destino-operador').waitFor({timeout: 45000});
    const destino = await pagina.locator('.destino-operador').innerText();
    if (detectar) assert.match(destino, /Detectada en la foto/, 'La foto identifica el destino');
    assert.match(destino, new RegExp(`Mesa ${codigo}[\\s\\S]*${cargo}`));
    for (const [nombre, cantidad] of hojas[i].filas) {
      const etiqueta = nombre === 'Votos blancos' ? 'Blancos' : nombre === 'Votos nulos' ? 'Nulos' : nombre === 'Total votos' ? 'Total del acta' : 'Votos de ' + nombre;
      assert.equal(await valor(etiqueta), String(cantidad), `OCR real de ${etiqueta} en la hoja ${i}`);
    }
  }
  async function confirmar(texto) {
    await pagina.getByLabel('He comparado los datos con el acta.').check();
    await pagina.getByRole('button', {name: /^(Confirmar y enviar|Confirmar corrección)$/}).click();
    await pagina.getByRole('heading', {name: texto}).waitFor();
  }

  // 5. Detección automática con OCR real, incluida la mesa física compartida por dos cargos.
  await escanear(0, {detectar: true, cargo: 'Decano', codigo: 'FERIA-01'});
  await pagina.screenshot({path: '/tmp/tuvoto-feria-revision.png', fullPage: true});
  await confirmar('¡Acta enviada!');
  await pagina.screenshot({path: '/tmp/tuvoto-feria-enviada.png', fullPage: true});
  await escanear(2, {detectar: true, cargo: 'Rector', codigo: 'FERIA-01'});
  await confirmar('¡Acta enviada!');
  await escanear(1, {detectar: true, cargo: 'Decano', codigo: 'FERIA-02'});
  await confirmar('¡Acta enviada!');
  ok('OCR real: tres fotos (PNG y JPEG) identifican mesa y cargo sin elegirlos y proponen todas las cifras');

  // 6. Corrección v2 y acta observada: reemplazan, no suman.
  await escanear(4, {detectar: true, cargo: 'Decano', codigo: 'FERIA-02'});
  await pagina.getByText('Esta mesa ya tiene la versión 1. Se guardará la versión 2: reemplaza a la anterior, no se suma.').waitFor();
  await confirmar('¡Acta enviada!');
  await escanear(3, {detectar: true, cargo: 'Decano', codigo: 'FERIA-01'});
  await pagina.getByText(/no coincide|Suma calculada/).first().waitFor();
  await confirmar('Acta enviada como observada');
  const suma = (i, nombre) => hojas[i].filas.find(f => f[0] === nombre)[1];
  const esperado = Object.fromEntries(decano.candidatos.map(c => [c.nombre, suma(0, c.nombre) + suma(4, c.nombre)]));
  const rDecano = await hasta(async () => { const r = await resultados(decano.id); return r.contabilizadas === 2 && r.candidatos.every(c => c.votos === esperado[c.nombre]) && r; }, 'resultados del Decano con v2 y sin la observada', 40);
  assert.deepEqual([rDecano.observadas, rDecano.requierenRevision], [0, 1], 'La observada conserva su aporte válido y queda para revisión');
  const rRector = await hasta(async () => { const r = await resultados(rector.id); return r.contabilizadas === 1 && r; }, 'resultados del Rector', 40);
  for (const c of rRector.candidatos) assert.equal(c.votos, suma(2, c.nombre));
  ok('Resultados públicos: la v2 reemplaza a la v1, la observada conserva la versión válida y cada cargo suma solo su acta');

  const actas = eventos.filter(e => e.tipo === 'acta').map(e => e.datos);
  assert.deepEqual(actas.map(a => a.tipo), ['nueva', 'nueva', 'nueva', 'correccion', 'observada']);
  assert.ok(actas[3].cambios.length >= 1, 'La corrección muestra la diferencia');
  assert.equal(JSON.stringify(actas).includes(idOperador), false, 'Sin identificador del operador');
  const lecturas = eventos.filter(e => e.tipo === 'solicitud' && e.datos.accion === 'Lectura OCR del acta' && e.datos.resultado === 'ok');
  assert.ok(lecturas.length >= 5, 'Cada lectura aparece en el mapa');
  assert.ok(eventos.some(e => e.tipo === 'resultados'));
  ok('Mapa vivo: 5 eventos reales de RabbitMQ (3 nuevas, corrección con diferencias, observada) y las lecturas OCR desde NGINX');

  // 7. Caída del conteo durante el registro: la cola retiene el acta y se procesa al volver.
  await presentador({accion: 'apagar', servicio: 'resultados-conteo'});
  await hasta(() => eventos.some(e => e.tipo === 'aviso' && e.datos.tipo === 'caida' && e.datos.nodo === 'conteo'), 'aviso de caída del conteo');
  await pagina.getByRole('button', {name: 'Volver a mis mesas'}).click();
  const [selector] = await Promise.all([pagina.waitForEvent('filechooser'), pagina.getByRole('button', {name: 'Escanear acta de Rector, mesa FERIA-01'}).click()]);
  await selector.setFiles(fotos[2]);
  await pagina.locator('.destino-operador').waitFor({timeout: 45000});
  await confirmar('¡Acta enviada!');
  await hasta(() => (eventos.ultimoEstado.colas.conteo?.mensajes ?? 0) >= 1, 'acta en espera en la cola de conteo');
  await presentador({accion: 'encender', servicio: 'resultados-conteo'});
  const vacia = await hasta(() => eventos.find(e => e.tipo === 'aviso' && e.datos.tipo === 'cola-vacia' && e.datos.nodo === 'conteo'), 'cola de conteo vaciada tras volver', 120);
  assert.ok(vacia.datos.procesadas >= 1 && vacia.datos.errores === 0);
  assert.ok(eventos.some(e => e.tipo === 'aviso' && e.datos.tipo === 'recuperado' && e.datos.nodo === 'conteo'));
  ok(`Caos: conteo apagado, ${vacia.datos.procesadas} acta(s) en espera procesadas al encenderlo y ninguna en la cola de errores`);

  // 8. Derribo con reinicio automático de Docker, ataque rechazado y ráfaga.
  await presentador({accion: 'derribar', servicio: 'resultados-auditoria'});
  await hasta(() => eventos.some(e => e.tipo === 'aviso' && e.datos.tipo === 'recuperado' && e.datos.nodo === 'auditoria'), 'auditoría reiniciada por Docker', 120);
  assert.ok(eventos.ultimoEstado.nodos.auditoria.contenedor.reinicios >= 1);
  const ataque = await presentador({accion: 'ataque-sesion'});
  assert.ok([401, 403].includes(ataque.estado));
  const interno = await presentador({accion: 'ataque-interno'});
  assert.equal(interno.estado, 403);
  await hasta(() => eventos.some(e => e.tipo === 'solicitud' && e.datos.prueba === 'ataque' && e.datos.resultado === 'denegado'), 'rechazo visible en el mapa');
  const rafaga = await presentador({accion: 'rafaga'});
  assert.equal(rafaga.correctas, 300);
  ok(`Docker reinició auditoría; ataques rechazados (${ataque.estado}, ${interno.estado}); ráfaga 300/300 con p95 ${rafaga.p95Ms} ms`);
  assert.deepEqual(errores, []);
  console.log('Prueba de feria completada en', proyecto);
} finally {
  flujo.abort();
  await navegador.close();
}
