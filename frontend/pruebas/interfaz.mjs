import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { calcularResultado, resultadosDemostracion } from '../src/datos/demostracion.js';

// Prueba aislada del frontend: las respuestas GraphQL se interceptan en el navegador.
// No escribe en microservicios ni sustituye la prueba real navegador.mjs.
const base = process.env.URL_BASE ?? 'http://127.0.0.1:5173';
const carpeta = process.env.EVIDENCIA_FRONTEND ?? `/tmp/sigape-rediseno-${Date.now()}`;
await mkdir(carpeta, { recursive: true });
const navegador = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EJECUTABLE ? { executablePath: process.env.CHROMIUM_EJECUTABLE } : {}), args: ['--no-sandbox'] });
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'es-BO' });
const pagina = await contexto.newPage();
pagina.setDefaultTimeout(10000);
const errores = [];
const verificaciones = [];
let solicitudesGraphql = 0;
pagina.on('pageerror', error => errores.push(error.message));
pagina.on('request', solicitud => { if (solicitud.url().endsWith('/graphql')) solicitudesGraphql++; });
function correcto(mensaje) { verificaciones.push(mensaje); console.log('OK:', mensaje); }
async function esperarListado() { await pagina.locator('.panel[aria-busy="false"]').waitFor(); }
async function consultarConAccion(accion) {
  const respuesta = pagina.waitForResponse(respuesta => respuesta.url().endsWith('/graphql') && respuesta.request().postDataJSON().query.includes('query Listar'));
  await accion(); await respuesta; await esperarListado();
}
async function comprobarAncho() { assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'La página no debe desbordar horizontalmente'); }

try {
  for (const resultado of resultadosDemostracion) {
    for (const estamento of ['estudiantes', 'docentes']) {
      const calculado = calcularResultado(resultado, estamento);
      assert.ok(Math.abs(calculado.candidaturas.reduce((total, candidatura) => total + candidatura.porcentaje, 0) - 100) < 0.0001);
      assert.equal(calculado.validos, resultado.candidaturas.reduce((total, candidatura) => total + candidatura[estamento], 0));
      assert.ok(calculado.avance <= 100 && calculado.avance >= 0);
    }
  }
  correcto('Porcentajes coherentes por estamento, separados del avance de actas');
  await pagina.goto(base);
  await pagina.getByRole('heading', { name: /Tu universidad.*Cada voto, a la vista/ }).waitFor();
  await pagina.getByText('Las candidaturas, los votos y las actas son ficticios.', { exact: false }).waitFor();
  assert.equal(await pagina.locator('.tarjeta-resultado').count(), 4);
  assert.equal(solicitudesGraphql, 0, 'La demostración no debe consultar ni escribir en las API');
  await comprobarAncho();
  await pagina.getByRole('button', { name: 'Pausar animaciones', exact: true }).click();
  assert.equal(await pagina.locator('.papeleta-animada').evaluate(nodo => getComputedStyle(nodo).animationName), 'none');
  await pagina.screenshot({ path: carpeta + '/escritorio.png', fullPage: true, animations: 'disabled' });
  await pagina.getByRole('button', { name: 'Reanudar animaciones', exact: true }).click();
  assert.equal(await pagina.locator('.papeleta-animada').evaluate(nodo => getComputedStyle(nodo).animationName), 'votar');
  correcto('Portada identificada como demostración, sin llamadas GraphQL y con animaciones controlables');

  await pagina.getByRole('button', { name: 'Ver las 6 elecciones de ejemplo', exact: true }).click();
  assert.equal(await pagina.locator('.tarjeta-resultado').count(), 6);
  await pagina.getByRole('button', { name: 'Rectorado', exact: true }).click();
  assert.equal(await pagina.locator('.tarjeta-resultado').count(), 1);
  await pagina.getByRole('button', { name: 'Todos los cargos', exact: true }).click();
  await pagina.getByLabel('Facultad', { exact: true }).selectOption('Ciencias y Tecnología');
  assert.equal(await pagina.locator('.tarjeta-resultado').count(), 2);
  await pagina.getByLabel('Carrera', { exact: true }).selectOption('Ingeniería de Sistemas');
  assert.equal(await pagina.locator('.tarjeta-resultado').count(), 1);
  await pagina.getByRole('button', { name: 'Docentes', exact: true }).click();
  assert.match(await pagina.locator('.tarjeta-resultado .candidatura').first().innerText(), /Candidatura Conecta/);
  await pagina.getByRole('button', { name: 'Ver detalle de Ingeniería de Sistemas', exact: true }).click();
  await pagina.getByRole('dialog').waitFor();
  assert.equal(await pagina.locator('.desglose-votos dd').allTextContents().then(valores => valores.join(',')), '32,3,2,37');
  await pagina.screenshot({ path: carpeta + '/detalle.png', fullPage: false, animations: 'disabled' });
  await pagina.keyboard.press('Escape');
  assert.equal(await pagina.getByRole('dialog').count(), 0);
  assert.equal(await pagina.getByRole('button', { name: 'Ver detalle de Ingeniería de Sistemas', exact: true }).evaluate(nodo => nodo === document.activeElement), true);
  await pagina.getByLabel('Facultad', { exact: true }).selectOption('Derecho');
  assert.equal(await pagina.getByLabel('Carrera', { exact: true }).inputValue(), '');
  await pagina.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
  await pagina.getByLabel('Buscar facultad, carrera o candidatura').fill('ingenieria');
  assert.equal(await pagina.locator('.tarjeta-resultado').count(), 1);
  await pagina.getByLabel('Buscar facultad, carrera o candidatura').fill('sin coincidencias');
  await pagina.getByRole('heading', { name: 'No encontramos una elección' }).waitFor();
  await pagina.getByRole('button', { name: 'Restablecer filtros', exact: true }).click();
  correcto('Filtros combinados, búsqueda sin tildes, reinicio de carrera, estados vacíos y cambio de estamento');
  correcto('Detalle con votos válidos, blancos y nulos; Escape cierra y devuelve el foco');

  await pagina.getByRole('button', { name: 'Cómo funciona', exact: true }).click();
  await pagina.getByRole('heading', { name: 'Del acta al resultado.' }).waitFor();
  assert.equal(await pagina.locator('.fuentes-guia a').count(), 2);
  await pagina.goBack();
  await pagina.getByRole('heading', { name: 'Encuentra tu elección' }).waitFor();
  correcto('Navegación por fragmentos y botón Atrás; guía con fuentes oficiales');

  let fallo = false;
  let liberacionCarga;
  let esperarCarga = null;
  let mutations = 0;
  const elecciones = Array.from({ length: 11 }, (_, indice) => ({ idEleccion: `eleccion-sintetica-${indice}`, nombre: `Elección de prueba ${indice + 1}`, estado: 'borrador', creadoEn: '2026-01-01T12:00:00Z' }));
  await pagina.route('**/graphql', async ruta => {
    const { query, variables } = ruta.request().postDataJSON();
    if (esperarCarga) await esperarCarga;
    if (fallo) return ruta.fulfill({ status: 503, body: 'Servicio no disponible' });
    let data;
    const paginar = elementos => ({ elementos: elementos.slice(((variables.pagina ?? 1) - 1) * 10, (variables.pagina ?? 1) * 10), total: elementos.length, pagina: variables.pagina ?? 1, limite: 10 });
    if (query.includes('ResumenSigape')) data = { elecciones: { total: elecciones.length }, candidaturas: { total: 1 }, inscripciones: { total: 1 } };
    else if (query.includes('ListarElecciones')) data = { elecciones: paginar(elecciones.filter(eleccion => (!variables.nombre || eleccion.nombre.includes(variables.nombre)) && (!variables.estado || eleccion.estado === variables.estado))) };
    else if (query.includes('ListarCandidaturas')) data = { candidaturas: paginar([{ idCandidatura: 'candidatura-sintetica', nombre: 'Postulación de prueba', idEleccion: elecciones[0].idEleccion, eleccion: { nombre: elecciones[0].nombre }, tipo: 'individual', estado: 'aprobada' }].filter(candidatura => !variables.estado || candidatura.estado === variables.estado)) };
    else if (query.includes('ListarPadron')) data = { inscripciones: paginar([{ idInscripcion: 'inscripcion-sintetica', idEleccion: elecciones[0].idEleccion, eleccion: { nombre: elecciones[0].nombre }, elegible: false, creadoEn: elecciones[0].creadoEn }].filter(inscripcion => variables.elegible == null || inscripcion.elegible === variables.elegible)) };
    else if (query.includes('CrearEleccion')) { mutations++; const creada = { idEleccion: 'nueva-eleccion-sintetica', ...variables.entrada, creadoEn: '2026-01-01T12:00:00Z' }; elecciones.unshift(creada); data = { crearEleccion: creada }; }
    else throw new Error('Operación inesperada: ' + query);
    await ruta.fulfill({ json: { data } });
  });
  await consultarConAccion(() => pagina.getByRole('button', { name: 'Elecciones', exact: true }).click());
  assert.equal(await pagina.locator('tbody tr').count(), 10);
  await consultarConAccion(() => pagina.getByRole('button', { name: 'Página siguiente', exact: true }).click());
  assert.equal(await pagina.locator('tbody tr').count(), 1);
  await consultarConAccion(() => pagina.getByLabel('Estado', { exact: true }).selectOption('finalizada'));
  await pagina.getByText('No hay registros para mostrar').waitFor();
  await consultarConAccion(() => pagina.getByRole('button', { name: 'Candidaturas', exact: true }).click());
  await pagina.getByRole('cell', { name: 'Postulación de prueba', exact: false }).waitFor();
  await consultarConAccion(() => pagina.getByRole('button', { name: 'Padrón electoral', exact: true }).click());
  await consultarConAccion(() => pagina.getByLabel('Elegibilidad', { exact: true }).selectOption('false'));
  await pagina.getByRole('cell', { name: 'No elegible', exact: true }).waitFor();
  await pagina.getByRole('button', { name: 'Nueva elección', exact: true }).click();
  await pagina.getByLabel('Nombre de la elección', { exact: true }).fill('Registro aislado del frontend');
  await pagina.getByRole('button', { name: 'Guardar elección', exact: true }).click();
  await pagina.getByRole('status').filter({ hasText: 'guardada correctamente' }).waitFor();
  await esperarListado();
  assert.equal(mutations, 1);
  await pagina.getByLabel('Buscar elección por nombre').fill('Registro aislado del frontend');
  await consultarConAccion(() => pagina.getByRole('button', { name: 'Buscar', exact: true }).click());
  assert.equal(await pagina.locator('tbody tr').count(), 1);
  await pagina.screenshot({ path: carpeta + '/gestion.png', fullPage: true, animations: 'disabled' });
  correcto('Gestión conserva paginación, filtros, referencias y creación con una mutation; respuestas interceptadas');

  esperarCarga = new Promise(resolver => { liberacionCarga = resolver; });
  await pagina.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await pagina.getByRole('status').filter({ hasText: 'Consultando registros' }).waitFor();
  assert.equal(await pagina.locator('.panel .papeleta-animada').count(), 1);
  assert.equal(await pagina.getByRole('button', { name: 'Actualizar', exact: true }).isDisabled(), true);
  await pagina.screenshot({ path: carpeta + '/carga.png', fullPage: true, animations: 'disabled' });
  liberacionCarga(); esperarCarga = null;
  await esperarListado();
  fallo = true;
  await pagina.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await pagina.getByText('No pudimos cargar el listado').waitFor();
  assert.equal(await pagina.locator('tbody tr').count(), 0);
  assert.equal(await pagina.getByTestId('total-elecciones').innerText(), '—');
  fallo = false;
  await consultarConAccion(() => pagina.getByRole('button', { name: 'Volver a intentar', exact: true }).click());
  assert.equal(await pagina.locator('tbody tr').count(), 1);
  correcto('Carga con urna, botones bloqueados durante consulta, error sin sustitución por datos ficticios y reintento');

  await pagina.getByRole('button', { name: 'Resultados', exact: true }).click();
  await pagina.getByRole('heading', { name: 'Encuentra tu elección' }).waitFor();
  await pagina.setViewportSize({ width: 390, height: 844 });
  await comprobarAncho();
  await pagina.getByRole('button', { name: 'Pausar animaciones', exact: true }).click();
  await pagina.screenshot({ path: carpeta + '/movil.png', fullPage: true, animations: 'disabled' });
  await pagina.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  await pagina.keyboard.press('Escape');
  assert.equal(await pagina.getByRole('button', { name: 'Abrir menú', exact: true }).getAttribute('aria-expanded'), 'false');
  await pagina.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  await consultarConAccion(() => pagina.getByRole('button', { name: 'Candidaturas', exact: true }).click());
  await comprobarAncho();
  await pagina.screenshot({ path: carpeta + '/gestion-movil.png', fullPage: true, animations: 'disabled' });
  await pagina.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  await pagina.getByRole('button', { name: 'Resultados', exact: true }).click();
  await pagina.getByRole('heading', { name: 'Encuentra tu elección' }).waitFor();
  for (const ancho of [320, 768, 1024, 1280]) {
    await pagina.setViewportSize({ width: ancho, height: 900 });
    await comprobarAncho();
  }
  await pagina.emulateMedia({ reducedMotion: 'reduce' });
  await pagina.getByRole('button', { name: 'Reanudar animaciones', exact: true }).click();
  assert.equal(await pagina.locator('.papeleta-animada').evaluate(nodo => getComputedStyle(nodo).animationName), 'none');
  assert.equal(await pagina.locator('.barra-porcentaje>span').first().evaluate(nodo => getComputedStyle(nodo).animationName), 'none');
  correcto('Vistas de 320, 390, 768, 1024, 1280 y 1440 px sin desbordamiento; menú con Escape y movimiento reducido');
  assert.deepEqual(errores, []);
  await writeFile(carpeta + '/evidencia.json', JSON.stringify({ fecha: new Date().toISOString(), base, tipo: 'Interfaz aislada, GraphQL interceptado; sin escrituras en servicios', verificaciones, erroresJavascript: errores }, null, 2));
  console.log('Evidencia:', carpeta);
} catch (error) {
  await pagina.screenshot({ path: carpeta + '/fallo.png', fullPage: true, animations: 'disabled' });
  console.error('Evidencia del fallo:', carpeta, 'Errores de JavaScript:', errores);
  throw error;
} finally { await navegador.close(); }
