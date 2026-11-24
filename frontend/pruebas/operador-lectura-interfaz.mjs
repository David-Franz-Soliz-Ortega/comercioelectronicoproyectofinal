// Navegador aislado: archivos compilados; todas las APIs están interceptadas.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const frontend = fileURLToPath(new URL('..', import.meta.url));
const carpeta = resolve(frontend, 'dist');
const servidor = http.createServer(async(req, res) => {
  const ruta = resolve(carpeta, '.' + (req.url === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!ruta.startsWith(carpeta + '/')) { res.writeHead(403).end(); return; }
  try {
    res.setHeader('Content-Type', ({'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.ttf':'font/ttf', '.png':'image/png'})[extname(ruta)] ?? 'application/octet-stream');
    res.end(await readFile(ruta));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => servidor.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + servidor.address().port;
const navegador = await chromium.launch({headless:true, ...(process.env.CHROMIUM_EJECUTABLE ? {executablePath:process.env.CHROMIUM_EJECUTABLE} : {}), args:['--no-sandbox']});
const pagina = await navegador.newPage({viewport:{width:1440, height:1100}});
pagina.setDefaultTimeout(10000);
const errores = [], escrituras = [], pendientes = [];
pagina.on('pageerror', e => errores.push(e.message));
const org = '10000000-0000-4000-8000-000000000000';
const candidatos = [{id:'20000000-0000-4000-8000-000000000001', nombre:'Candidatura Alfa'}, {id:'20000000-0000-4000-8000-000000000002', nombre:'Candidatura Beta'}];
const mesas = [1,2].map(n => ({id: '30000000-0000-4000-8000-00000000000'+n, idProceso:'cargo-prueba', codigo:'PRUEBA-0'+n, unidad:'Unidad de demostración', sector:'general', cargo:'Rectorado de demostración', estado:'recepcion', candidatos}));
const propuesta = {votos:candidatos.map((c,i) => ({idCandidato:c.id,cantidad:i ? 80 : 120})), blancos:3,nulos:2,total:205,completa:true,advertencias:[],requiereRevision:true};
let modo = 'completa';
const versiones = new Map();
mesas[1].estado = 'cerrada';
await pagina.route('**/api/**', async ruta => {
  const solicitud = ruta.request(), url = new URL(solicitud.url());
  if (url.pathname.endsWith('/autenticacion/yo')) return ruta.fulfill({json:{idUsuario:'operador-prueba',usuario:'operador.prueba',idOrganizacion:org,roles:[{rol:'OPERADOR',idOrganizacion:org}]}});
  if (url.pathname.endsWith('/mis-mesas')) return ruta.fulfill({json:{elementos:mesas}});
  if (url.pathname.endsWith('/contexto')) return ruta.fulfill({json:mesas.find(m => url.pathname.includes(m.id))});
  if (url.pathname.includes('/actas/mesa/')) return ruta.fulfill({json:{elementos:[],versionAnterior:versiones.get(url.pathname.split('/').at(-1))??0}});
  if (url.pathname.includes('/actas/mesas/') && solicitud.method() === 'PUT') {
    const datos = solicitud.postDataJSON(); escrituras.push(datos); versiones.set(datos.idMesa, datos.versionAnterior + 1);
    return ruta.fulfill({json:{id:'correccion-sintetica',version:datos.versionAnterior + 1,estado:'publicada'}});
  }
  if (url.pathname.endsWith('/actas/lectura')) {
    const datos = solicitud.postDataJSON();
    assert.match(datos.foto, /^data:image\/png;base64,/);
    assert.ok(mesas.some(m => m.id === datos.idMesa));
    assert.equal(solicitud.headers()['x-organizacion'], org);
    if (modo === 'espera') { pendientes.push(ruta); return; }
    if (modo === 'error') return ruta.fulfill({status:422,json:{detail:'La mesa de la fotografía no coincide.'}});
    return ruta.fulfill({json: modo === 'parcial' ? {...propuesta,completa:false,votos:[propuesta.votos[0],{...propuesta.votos[1],cantidad:null}],advertencias:['Completa el campo vacío.']} : propuesta});
  }
  if (url.pathname.endsWith('/actas')) return ruta.fulfill({json:{elementos:[],total:0}});
  errores.push('API inesperada: '+url.pathname); await ruta.abort();
});
await pagina.route('**/graphql', ruta => {
  const datos = ruta.request().postDataJSON();
  if (datos.query.includes('mutation Registrar')) {
    escrituras.push(datos.variables.entrada);
    versiones.set(datos.variables.entrada.idMesa,1);
    return ruta.fulfill({json:{data:{registrarActa:{id:'acta-sintetica',version:1,estado:'publicada'}}}});
  }
  return ruta.fulfill({json:{data:{eventos:[]}}});
});
const foto = resolve(frontend, 'public/ejemplos/acta-prueba.png');
const subir = () => pagina.getByLabel('Subir imagen').setInputFiles(foto);
const valor = (nombre) => pagina.getByLabel(nombre, {exact:true}).inputValue();
const confirmar = () => pagina.getByRole('button', {name:/^Confirmar (y publicar|corrección)$/});
try {
  // Una preferencia antigua de pausa ya no desactiva la animación.
  await pagina.addInitScript(() => localStorage.setItem('tuvoto:pausar-animaciones', 'si'));
  await pagina.goto(base);
  await pagina.locator('.papeleta-animada').first().waitFor();
  assert.equal(await pagina.getByRole('button', {name:/Pausar|Reanudar/}).count(), 0);
  assert.equal(await pagina.locator('.papeleta-animada').first().evaluate(n => getComputedStyle(n).animationIterationCount), 'infinite');
  await pagina.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await pagina.locator('.papeleta-animada').first().evaluate(n => getComputedStyle(n).animationName), 'none');
  await pagina.emulateMedia({reducedMotion:'no-preference'});
  await pagina.goto(base + '/#panel');
  await pagina.getByRole('heading', {name:'2. Revisa los datos'}).waitFor();
  assert.equal(await pagina.getByText('Usar una foto de otro cargo',{exact:true}).count(),0);
  assert.equal(await valor('Total del acta'), '');
  assert.ok(await confirmar().isDisabled());

  modo = 'espera'; await subir();
  await pagina.getByText('Leyendo la fotografía…', {exact:true}).waitFor();
  assert.ok(await pagina.getByLabel('Votos de Candidatura Alfa', {exact:true}).isDisabled());
  assert.ok(await confirmar().isDisabled());
  await pagina.waitForFunction(() => document.querySelector('.imagen-acta-cargada')?.complete);
  while (!pendientes.length) await new Promise(r => setTimeout(r, 20));
  await pendientes.shift().fulfill({json:propuesta});
  await pagina.getByText('Lectura lista. Comprueba cada número.', {exact:true}).waitFor();
  assert.equal(await valor('Votos de Candidatura Alfa'), '120');
  assert.equal(await valor('Votos de Candidatura Beta'), '80');
  assert.equal(await valor('Total del acta'), '205');
  assert.equal(escrituras.length, 0, 'Leer no publica');
  assert.ok(await confirmar().isDisabled(), 'Exige revisión humana');
  await pagina.getByRole('button', {name:'Ampliar fotografía ↗'}).click();
  await pagina.getByRole('dialog').waitFor();
  assert.equal(await pagina.locator('.ampliacion-acta img').evaluate(n => n.complete && n.naturalWidth > 0), true);
  await pagina.keyboard.press('Escape');
  for (const ancho of [320,390,768,1024,1440]) {
    await pagina.setViewportSize({width:ancho,height:1100});
    assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Sin desbordamiento a '+ancho);
    if ([390,1440].includes(ancho)) await pagina.screenshot({path:'/tmp/tuvoto-operador-lectura-'+ancho+'.png',fullPage:true,animations:'disabled'});
  }
  await pagina.getByLabel('He comparado los datos con el acta.').check();
  await pagina.getByLabel('Votos de Candidatura Alfa', {exact:true}).fill('121');
  assert.ok(await confirmar().isDisabled(), 'Editar invalida la confirmación');
  await pagina.getByLabel('Votos de Candidatura Alfa', {exact:true}).fill('120');
  await pagina.getByLabel('He comparado los datos con el acta.').check();
  await confirmar().click();
  await pagina.getByText('Acta confirmada. La publicación de resultados se procesa en segundo plano.').waitFor();
  assert.equal(escrituras.length, 1);
  assert.equal(escrituras[0].total, 205);
  assert.equal(escrituras[0].confirmado, true);
  assert.equal(escrituras[0].votos[0].cantidad, 120);
  await pagina.getByRole('button', {name:'Entendido'}).click();
  await pagina.waitForFunction(() => document.querySelector('[aria-label="Total del acta"]')?.value === '');

  assert.ok(!('idActaOrigen' in escrituras[0]));
  await pagina.getByRole('button',{name:'Confirmar corrección',exact:true}).waitFor();
  modo = 'completa'; await subir();
  await pagina.getByText('Lectura lista. Comprueba cada número.',{exact:true}).waitFor();
  await pagina.getByLabel('He comparado los datos con el acta.').check();
  await confirmar().click();
  await pagina.getByRole('button',{name:'Entendido'}).click();
  await pagina.waitForFunction(() => document.querySelector('[aria-label="Total del acta"]')?.value === '');
  assert.equal(escrituras.length,2);assert.equal(escrituras[1].versionAnterior,1);assert.match(escrituras[1].foto,/^data:image\/png;base64,/);
  assert.ok(!('idActaOrigen' in escrituras[1]));

  modo = 'parcial'; await subir();
  await pagina.getByText('Lectura parcial. Completa los campos vacíos.', {exact:true}).waitFor();
  assert.equal(await valor('Votos de Candidatura Beta'), '');
  assert.ok(await confirmar().isDisabled());
  await pagina.getByLabel('Votos de Candidatura Beta', {exact:true}).fill('80');
  await pagina.getByText('Suma correcta: 205').waitFor();
  modo = 'error'; await subir();
  await pagina.getByText('La mesa de la fotografía no coincide.', {exact:true}).waitFor();
  assert.equal(await valor('Total del acta'), '');
  assert.ok(await confirmar().isDisabled());

  modo = 'espera'; await subir();
  await pagina.getByText('Leyendo la fotografía…', {exact:true}).waitFor();
  while (!pendientes.length) await new Promise(r => setTimeout(r, 20));
  const antigua = pendientes.shift();
  modo = 'completa'; await subir();
  await pagina.getByText('Lectura lista. Comprueba cada número.', {exact:true}).waitFor();
  await antigua.fulfill({json:{...propuesta,total:999}}).catch(() => {});
  assert.equal(await valor('Total del acta'), '205', 'Una respuesta anterior no cambia la foto vigente');
  modo = 'espera'; await subir();
  await pagina.getByText('Leyendo la fotografía…', {exact:true}).waitFor();
  await pagina.getByLabel('Mesa asignada').selectOption(mesas[1].id);
  await pagina.waitForFunction(() => document.querySelector('[aria-label="Total del acta"]')?.value === '');
  assert.equal(await pagina.locator('.imagen-acta-cargada').count(), 0);
  assert.equal(escrituras.length, 2, 'Solo se publicó y corrigió tras confirmar explícitamente');
  assert.ok(await pagina.getByLabel('Subir imagen').isDisabled());
  assert.ok(await pagina.getByLabel('Tomar fotografía').isDisabled());
  assert.ok(await confirmar().isDisabled());
  assert.deepEqual(errores, []);
  console.log('OK: animación continua y movimiento reducido; autollenado, campos vacíos, revisión obligatoria, edición, carga parcial, errores, respuestas antiguas y cambio de mesa; cinco tamaños. APIs sintéticas, sin escrituras reales.');
} catch (e) {
  await pagina.screenshot({path:'/tmp/tuvoto-operador-fallo.png', fullPage:true,animations:'disabled'}); throw e;
} finally {
  await navegador.close(); servidor.closeAllConnections(); await new Promise(r => servidor.close(r));
}
