// Navegador aislado: archivos compilados y todas las APIs interceptadas con datos sintéticos.
// La propuesta de lectura es un doble explícito; el OCR real se prueba en microservicios/actas.
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
const pagina = await navegador.newPage({viewport:{width:390, height:900}});
pagina.setDefaultTimeout(10000);
const errores = [], escrituras = [], pendientes = [], lecturas = [];
pagina.on('pageerror', e => errores.push(e.message));
const org = '10000000-0000-4000-8000-000000000000';
const rector = [{id:'20000000-0000-4000-8000-000000000001', nombre:'Candidatura Alfa'}, {id:'20000000-0000-4000-8000-000000000002', nombre:'Candidatura Beta'}];
const decano = [{id:'20000000-0000-4000-8000-000000000003', nombre:'Candidatura Gama'}, {id:'20000000-0000-4000-8000-000000000004', nombre:'Candidatura Delta'}];
const id = n => '30000000-0000-4000-8000-00000000000' + n;
const mesas = [
  {id:id(1), idMesaFisica:'fisica-1', idProceso:'p-rector', codigo:'PRUEBA-01', unidad:'Unidad de demostración', sector:'general', cargo:'Rectorado de demostración', estado:'recepcion', candidatos:rector},
  {id:id(2), idMesaFisica:'fisica-1', idProceso:'p-decano', codigo:'PRUEBA-01', unidad:'Unidad de demostración', sector:'general', cargo:'Decanatura de demostración', estado:'recepcion', candidatos:decano},
  {id:id(3), idMesaFisica:'fisica-2', idProceso:'p-rector', codigo:'PRUEBA-02', unidad:'Unidad de demostración', sector:'general', cargo:'Rectorado de demostración', estado:'cerrada', candidatos:rector},
];
const propuestaDe = (mesa, extra = {}) => ({votos:mesa.candidatos.map((c,i) => ({idCandidato:c.id,cantidad:i ? 80 : 120})), blancos:3, nulos:2, total:205, completa:true, sumaCoincide:true, advertencias:[], requiereRevision:true, motor:'tesseract', idMesa:mesa.id, detectada:false, opciones:[], ...extra});
let modo = 'detectada';
const versiones = new Map();
await pagina.route('**/api/**', async ruta => {
  const solicitud = ruta.request(), url = new URL(solicitud.url());
  if (url.pathname.endsWith('/autenticacion/yo')) return ruta.fulfill({json:{idUsuario:'operador-prueba',usuario:'operador.prueba',idOrganizacion:org,roles:[{rol:'OPERADOR',idOrganizacion:org}]}});
  if (url.pathname.endsWith('/mis-mesas')) return ruta.fulfill({json:{elementos:mesas.map(({candidatos, ...m}) => m)}});
  if (url.pathname.endsWith('/contexto')) { const m = mesas.find(m => url.pathname.includes(m.id)); return ruta.fulfill({json:{...m, sectorNombre:'General'}}); }
  if (url.pathname.includes('/actas/mesa/')) { const v = versiones.get(url.pathname.split('/').at(-1)) ?? 0; return ruta.fulfill({json:{elementos:v ? [{id:'acta-'+v, version:v, estado:'publicada', creado_en:'2026-11-24T20:00:00Z'}] : [], versionAnterior:v}}); }
  if (url.pathname.endsWith('/actas') && solicitud.method() === 'GET') return ruta.fulfill({json:{elementos:[...versiones].map(([idMesa, version]) => ({idMesa, version, estado:'publicada'})), total:versiones.size}});
  if (url.pathname.includes('/actas/mesas/') && solicitud.method() === 'PUT') {
    const datos = solicitud.postDataJSON(); escrituras.push(datos); versiones.set(datos.idMesa, datos.versionAnterior + 1);
    return ruta.fulfill({json:{id:'correccion-sintetica', version:datos.versionAnterior + 1, estado:'publicada'}});
  }
  if (url.pathname.endsWith('/actas/lectura')) {
    const datos = solicitud.postDataJSON();
    lecturas.push(datos);
    assert.match(datos.foto, /^data:image\/png;base64,/);
    assert.equal(solicitud.headers()['x-organizacion'], org);
    if (!datos.idMesa) assert.deepEqual(datos.candidatas, [id(1), id(2)], 'Solo se proponen mesas abiertas');
    if (modo === 'espera') { pendientes.push(ruta); return; }
    if (modo === '429') { modo = 'detectada'; return ruta.fulfill({status:429, json:{detail:'Hay otras fotografías en lectura.'}}); }
    if (modo === 'sin-destino' && !datos.idMesa) return ruta.fulfill({json:{votos:[], blancos:null, nulos:null, total:null, completa:false, sumaCoincide:null, advertencias:['Hay más de un destino posible: elige la mesa y el cargo.'], requiereRevision:true, motor:'tesseract', idMesa:null, detectada:false, opciones:[id(1), id(2)]}});
    if (modo === 'error') return ruta.fulfill({status:422, json:{detail:'La mesa de la fotografía no coincide o no se pudo leer.'}});
    if (datos.idMesa) return ruta.fulfill({json:propuestaDe(mesas.find(m => m.id === datos.idMesa))});
    return ruta.fulfill({json:propuestaDe(mesas[1], {detectada:true})});
  }
  errores.push('API inesperada: ' + solicitud.method() + ' ' + url.pathname); await ruta.abort();
});
await pagina.route('**/graphql', ruta => {
  const datos = ruta.request().postDataJSON();
  if (datos.query.includes('mutation Registrar')) {
    escrituras.push(datos.variables.entrada);
    versiones.set(datos.variables.entrada.idMesa, 1);
    return ruta.fulfill({json:{data:{registrarActa:{id:'acta-sintetica', version:1, estado:'publicada'}}}});
  }
  return ruta.fulfill({json:{data:{eventos:[]}}});
});
const foto = resolve(frontend, 'public/ejemplos/acta-prueba.png');
const camara = () => pagina.getByLabel('Tomar fotografía del acta').setInputFiles(foto);
const valor = nombre => pagina.getByLabel(nombre, {exact:true}).inputValue();
const enviar = () => pagina.getByRole('button', {name:/^(Confirmar y enviar|Confirmar corrección)$/});
const confirmarLectura = () => pagina.getByLabel('He comparado los datos con el acta.').check();
const elegirArchivo = async boton => { const [selector] = await Promise.all([pagina.waitForEvent('filechooser'), boton.click()]); await selector.setFiles(foto); };
const sinDesborde = async ancho => { await pagina.setViewportSize({width:ancho, height:900}); assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Sin desbordamiento a ' + ancho); };
try {
  // El portal conserva su animación continua y respeta el movimiento reducido.
  await pagina.addInitScript(() => localStorage.setItem('tuvoto:pausar-animaciones', 'si'));
  await pagina.goto(base);
  await pagina.locator('.papeleta-animada').first().waitFor();
  assert.equal(await pagina.locator('.papeleta-animada').first().evaluate(n => getComputedStyle(n).animationIterationCount), 'infinite');
  await pagina.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await pagina.locator('.papeleta-animada').first().evaluate(n => getComputedStyle(n).animationName), 'none');
  await pagina.emulateMedia({reducedMotion:'no-preference'});

  // Inicio: progreso, mesas agrupadas por mesa física y mesa cerrada sin acción.
  await pagina.goto(base + '/#panel');
  await pagina.getByRole('heading', {name:'Hola, operador.prueba'}).waitFor();
  await pagina.getByText('Registraste 0 de 2 actas.').waitFor();
  assert.equal(await pagina.getByRole('heading', {name:'Mesa PRUEBA-01'}).count(), 1);
  assert.ok(await pagina.getByRole('button', {name:'Escanear acta de Rectorado de demostración, mesa PRUEBA-02'}).isDisabled());
  for (const ancho of [320, 390, 768, 1440]) await sinDesborde(ancho);
  await pagina.setViewportSize({width:390, height:900});
  await pagina.screenshot({path:'/tmp/tuvoto-operador-inicio-390.png', fullPage:true, animations:'disabled'});

  // Detección automática: la foto encuentra la mesa física compartida y el cargo correcto.
  modo = 'espera'; await camara();
  await pagina.getByRole('heading', {name:'Buscando la mesa y el cargo…'}).waitFor();
  while (!pendientes.length) await new Promise(r => setTimeout(r, 20));
  await pendientes.shift().fulfill({json:propuestaDe(mesas[1], {detectada:true})});
  await pagina.getByText('Detectada en la foto').waitFor();
  assert.match(await pagina.locator('.destino-operador').innerText(), /Mesa PRUEBA-01[\s\S]*Decanatura de demostración/);
  assert.equal(await valor('Votos de Candidatura Gama'), '120');
  assert.equal(await valor('Votos de Candidatura Delta'), '80');
  assert.equal(await valor('Total del acta'), '205');
  await pagina.getByText('Suma correcta: 205').waitFor();
  assert.equal(escrituras.length, 0, 'Leer no publica');
  assert.ok(await enviar().isDisabled(), 'Exige revisión humana');
  await pagina.getByRole('button', {name:'Ampliar fotografía ↗'}).click();
  await pagina.getByRole('dialog').waitFor();
  assert.equal(await pagina.locator('.ampliacion-foto-operador img').evaluate(n => n.complete && n.naturalWidth > 0), true);
  await pagina.keyboard.press('Escape');
  for (const ancho of [320, 390, 768, 1024, 1440]) {
    await sinDesborde(ancho);
    if ([390, 1440].includes(ancho)) await pagina.screenshot({path:'/tmp/tuvoto-operador-revision-' + ancho + '.png', fullPage:true, animations:'disabled'});
  }
  await pagina.setViewportSize({width:390, height:900});
  await confirmarLectura();
  await pagina.getByLabel('Votos de Candidatura Gama', {exact:true}).fill('121');
  assert.ok(await enviar().isDisabled(), 'Editar invalida la confirmación');
  assert.equal(await pagina.locator('.campo-editado').count(), 1);
  await pagina.getByLabel('Votos de Candidatura Gama', {exact:true}).fill('120');
  await confirmarLectura();
  await enviar().click();
  await pagina.getByRole('heading', {name:'¡Acta enviada!'}).waitFor();
  await pagina.getByText('Mesa PRUEBA-01 · Decanatura de demostración · versión 1').waitFor();
  assert.equal(escrituras.length, 1);
  assert.deepEqual({idMesa:escrituras[0].idMesa, total:escrituras[0].total, confirmado:escrituras[0].confirmado, versionAnterior:escrituras[0].versionAnterior}, {idMesa:id(2), total:205, confirmado:true, versionAnterior:0});
  assert.ok(!('idActaOrigen' in escrituras[0]));
  await pagina.screenshot({path:'/tmp/tuvoto-operador-enviado-390.png', fullPage:true, animations:'disabled'});

  // Saturación del lector: reintento automático tras 429.
  modo = '429';
  await elegirArchivo(pagina.getByRole('button', {name:/Escanear siguiente acta/}));
  await pagina.getByRole('heading', {name:'Otras actas se están leyendo'}).waitFor();
  await pagina.getByText('Detectada en la foto').waitFor({timeout:8000});
  await pagina.getByText('Esta mesa ya tiene la versión 1. Se guardará la versión 2: reemplaza a la anterior, no se suma.').waitFor();
  await pagina.getByRole('button', {name:'Descartar'}).click();
  await pagina.getByText('Registraste 1 de 2 actas.').waitFor();

  // Destino ambiguo: el operador elige y se vuelve a leer con esa mesa.
  modo = 'sin-destino'; await camara();
  await pagina.getByRole('heading', {name:'¿De qué mesa y cargo es esta acta?'}).waitFor();
  assert.equal(await pagina.locator('.opciones-destino button').count(), 2);
  await pagina.getByRole('button', {name:/Mesa PRUEBA-01 · Rectorado de demostración/}).click();
  await pagina.getByText('Elegida por ti').waitFor();
  assert.equal(lecturas.at(-1).idMesa, id(1));
  assert.equal(await valor('Votos de Candidatura Alfa'), '120');
  await confirmarLectura(); await enviar().click();
  await pagina.getByRole('heading', {name:'¡Acta enviada!'}).waitFor();
  assert.equal(escrituras.at(-1).idMesa, id(1));
  await pagina.getByRole('button', {name:'Volver a mis mesas'}).click();
  await pagina.getByText('Registraste 2 de 2 actas.').waitFor();

  // Corrección desde la tarjeta de la mesa: versión nueva por PUT, sin sumar.
  modo = 'detectada';
  await elegirArchivo(pagina.getByRole('button', {name:'Escanear acta de Decanatura de demostración, mesa PRUEBA-01'}));
  await pagina.getByRole('button', {name:'Confirmar corrección'}).waitFor();
  assert.equal(lecturas.at(-1).idMesa, id(2));
  await confirmarLectura(); await enviar().click();
  await pagina.getByRole('heading', {name:'¡Acta enviada!'}).waitFor();
  assert.equal(escrituras.at(-1).versionAnterior, 1);
  assert.match(escrituras.at(-1).foto, /^data:image\/png;base64,/);
  await pagina.getByRole('button', {name:'Volver a mis mesas'}).click();

  // Error de lectura con mesa elegida: campos vacíos y revisión obligatoria.
  modo = 'error';
  await elegirArchivo(pagina.getByRole('button', {name:'Escanear acta de Rectorado de demostración, mesa PRUEBA-01'}));
  await pagina.getByText('La mesa de la fotografía no coincide o no se pudo leer.').waitFor();
  assert.equal(await valor('Total del acta'), '');
  assert.ok(await enviar().isDisabled());
  assert.equal(await pagina.locator('.campo-vacio').count(), 5);
  await pagina.getByRole('button', {name:'Descartar'}).click();

  // Una respuesta antigua no reemplaza la foto vigente.
  modo = 'espera'; await camara();
  await pagina.getByRole('heading', {name:'Buscando la mesa y el cargo…'}).waitFor();
  while (!pendientes.length) await new Promise(r => setTimeout(r, 20));
  const antigua = pendientes.shift();
  await pagina.getByRole('button', {name:'Cancelar'}).click();
  modo = 'detectada'; await camara();
  await pagina.getByText('Detectada en la foto').waitFor();
  await antigua.fulfill({json:propuestaDe(mesas[1], {total:999, detectada:true})}).catch(() => {});
  await new Promise(r => setTimeout(r, 200));
  assert.equal(await valor('Total del acta'), '205', 'Una respuesta anterior no cambia la foto vigente');
  assert.equal(escrituras.length, 3, 'Solo se publicó tras confirmar explícitamente');
  assert.deepEqual(errores, []);
  console.log('OK: portal animado; inicio con progreso y mesas; detección automática, reintento 429, destino ambiguo, corrección, error de lectura, respuesta antigua; revisión obligatoria; 320-1440 px. APIs sintéticas, sin escrituras reales.');
} catch (e) {
  await pagina.screenshot({path:'/tmp/tuvoto-operador-fallo.png', fullPage:true, animations:'disabled'}); throw e;
} finally {
  await navegador.close(); servidor.closeAllConnections(); await new Promise(r => servidor.close(r));
}
