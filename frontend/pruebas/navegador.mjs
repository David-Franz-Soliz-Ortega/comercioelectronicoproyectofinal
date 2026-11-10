import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.URL_BASE ?? 'http://localhost:8080';
const carpeta = process.env.EVIDENCIA_FRONTEND ?? '/tmp/sigape-frontend-' + randomUUID();
await mkdir(carpeta, { recursive: true });
const navegador = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'es-VE' });
const pagina = await contexto.newPage();
const errores = [];
const solicitudes = [];
const verificaciones = [];
const prefijo = 'Prueba navegador SIGAPE ' + randomUUID();
let idCreado;
let correlacionMutation;
let mutations = 0;
pagina.on('pageerror', error => errores.push(error.message));
pagina.on('request', solicitud => {
  if (solicitud.url() === base + '/graphql') {
    const cuerpo = solicitud.postDataJSON();
    solicitudes.push({ url: solicitud.url(), metodo: solicitud.method(), consulta: cuerpo.query });
    if (cuerpo.query.includes('mutation CrearEleccion')) mutations++;
  }
});
function correcto(mensaje) { verificaciones.push(mensaje); console.log('OK:', mensaje); }
async function pedir(ruta) {
  const respuesta = await contexto.request.get(base + ruta);
  assert.equal(respuesta.status(), 200, ruta);
  return respuesta.json();
}
async function esperarListado(nombre) {
  await pagina.getByRole('heading', { name: new RegExp('^' + nombre), level: 2 }).waitFor();
  await pagina.locator('.panel[aria-busy="false"]').waitFor();
  assert.equal(await pagina.getByRole('alert').count(), 0, 'No debe haber errores en la consulta real');
}
try {
  await pagina.goto(base, { waitUntil: 'networkidle' });
  await esperarListado('Elecciones');
  const elecciones = await pedir('/api/v1/elecciones?limite=10');
  const formatear = valor => new Intl.NumberFormat('es-VE').format(valor);
  assert.equal(await pagina.getByTestId('total-elecciones').innerText(), formatear(elecciones.total));
  if (elecciones.elementos.length) await pagina.getByRole('cell', { name: elecciones.elementos[0].nombre, exact: false }).first().waitFor();
  await pagina.screenshot({ path: carpeta + '/inicio.png', fullPage: true });
  correcto('Navegador carga React desde NGINX y muestra elecciones y totales reales obtenidos por GraphQL');
  if (elecciones.total > 10) {
  const segundaPagina = pagina.waitForResponse(respuesta => respuesta.url() === base + '/graphql' && respuesta.request().postDataJSON().variables?.pagina === 2);
  await pagina.getByRole('button', { name: 'Página siguiente', exact: true }).click();
  await segundaPagina;
  await pagina.locator('.panel[aria-busy="false"]').waitFor();
  assert.match(await pagina.locator('.paginacion').innerText(), /Página 2 de/);
  correcto('Paginación consultada al servidor, sin cargar el listado completo en el navegador');

  } else {
    assert.equal(await pagina.getByRole('button', { name: 'Página siguiente', exact: true }).isDisabled(), true);
    correcto('Paginación deshabilitada cuando la base real no tiene más páginas');
  }

  await pagina.getByRole('button', { name: 'Candidaturas', exact: true }).click();
  await esperarListado('Candidaturas');
  const candidaturas = await pedir('/api/v1/candidaturas?limite=10');
  assert.equal(await pagina.locator('tbody tr').count(), candidaturas.elementos.length);
  if (candidaturas.elementos.length) await pagina.getByRole('cell', { name: candidaturas.elementos[0].nombre, exact: false }).first().waitFor();
  assert.equal(await pagina.getByTestId('total-candidaturas').innerText(), formatear(candidaturas.total));
  correcto('Listado de candidaturas coincide con la persistencia real de su microservicio');

  await pagina.getByRole('button', { name: 'Padrón electoral', exact: true }).click();
  await esperarListado('Padrón electoral');
  const inscripciones = await pedir('/api/v1/inscripciones?limite=10');
  assert.equal(await pagina.locator('tbody tr').count(), inscripciones.elementos.length);
  assert.equal(await pagina.getByTestId('total-padron').innerText(), formatear(inscripciones.total));
  const filtroPadron = pagina.waitForResponse(respuesta => respuesta.url() === base + '/graphql' && respuesta.request().postDataJSON().variables?.elegible === false);
  await pagina.getByLabel('Elegibilidad', { exact: true }).selectOption('false');
  await filtroPadron;
  await pagina.locator('.panel[aria-busy="false"]').waitFor();
  const noElegibles = await pedir('/api/v1/inscripciones?limite=10&elegible=false');
  assert.equal(await pagina.locator('tbody tr').count(), noElegibles.elementos.length);
  if (noElegibles.elementos.length) assert.equal(await pagina.getByRole('cell', { name: 'No elegible', exact: true }).count(), noElegibles.elementos.length);
  correcto('Padrón y filtro de elegibilidad leen datos reales, sin identidad ni datos personales');

  await pagina.getByRole('button', { name: 'Nueva elección', exact: true }).click();
  await pagina.getByRole('dialog').waitFor();
  await pagina.getByLabel('Nombre de la elección', { exact: true }).fill(prefijo);
  const guardado = pagina.waitForResponse(respuesta => respuesta.url() === base + '/graphql' && respuesta.request().postDataJSON().query.includes('mutation CrearEleccion'));
  await pagina.getByRole('button', { name: 'Guardar elección', exact: true }).click();
  const respuestaGuardado = await guardado;
  assert.equal(respuestaGuardado.status(), 200);
  const resultado = await respuestaGuardado.json();
  assert.equal(resultado.errors, undefined);
  idCreado = resultado.data.crearEleccion.idEleccion;
  correlacionMutation = (await respuestaGuardado.allHeaders())['x-correlation-id'];
  assert.equal(mutations, 1, 'El formulario debe emitir exactamente una mutation');
  await pagina.getByRole('status').filter({ hasText: 'guardada correctamente' }).waitFor();
  await esperarListado('Elecciones');
  await pagina.getByRole('cell', { name: prefijo, exact: false }).waitFor();
  const persistido = await pedir('/api/v1/elecciones/' + idCreado);
  assert.equal(persistido.nombre, prefijo);
  assert.equal(persistido.estado, 'borrador');
  correcto('Formulario → NGINX → mutation GraphQL → elecciones: guardado confirmado por REST independiente');

  await pagina.reload({ waitUntil: 'networkidle' });
  await esperarListado('Elecciones');
  await pagina.getByRole('cell', { name: prefijo, exact: false }).waitFor();
  await pagina.getByLabel('Buscar elección por nombre').fill(prefijo);
  const busquedaGuardada = pagina.waitForResponse(respuesta => respuesta.url() === base + '/graphql' && respuesta.request().postDataJSON().variables?.nombre === prefijo);
  await pagina.getByRole('button', { name: 'Buscar', exact: true }).click();
  await busquedaGuardada;
  await pagina.locator('.panel[aria-busy="false"]').waitFor();
  assert.equal(await pagina.locator('tbody tr').count(), 1);
  await pagina.screenshot({ path: carpeta + '/escritorio.png', fullPage: true });
  correcto('La elección persiste tras recargar y aparece en la búsqueda real por nombre');

  // Fallo real de conectividad del navegador, sin sustituir respuestas ni alterar servicios.
  await contexto.setOffline(true);
  await pagina.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await pagina.getByText('No pudimos cargar el listado', { exact: true }).waitFor();
  assert.equal(await pagina.locator('tbody tr').count(), 0);
  await contexto.setOffline(false);
  await pagina.getByRole('button', { name: 'Volver a intentar', exact: true }).click();
  await pagina.getByRole('cell', { name: prefijo, exact: false }).waitFor();
  correcto('Sin red se muestra error sin datos sustitutos; la recuperación vuelve a consultar GraphQL');

  await pagina.setViewportSize({ width: 390, height: 844 });
  await pagina.screenshot({ path: carpeta + '/movil.png', fullPage: true });
  assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'El diseño no debe desbordar horizontalmente');
  await pagina.getByRole('button', { name: 'Candidaturas', exact: true }).click();
  await esperarListado('Candidaturas');
  correcto('Interfaz móvil de 390 px navegable, sin desbordamiento de la página');
  assert.equal(errores.length, 0, errores.join('\n'));
  assert.ok(solicitudes.some(s => s.consulta.includes('ListarCandidaturas')));
  assert.ok(solicitudes.some(s => s.consulta.includes('ListarPadron')));
  assert.ok(solicitudes.every(s => s.metodo === 'POST'));
  await writeFile(carpeta + '/evidencia.json', JSON.stringify({ fecha: new Date().toISOString(), base, nombre: prefijo, idEleccion: idCreado, correlacionMutation, mutations,
    verificaciones, solicitudesGraphql: solicitudes.map(s => ({ metodo: s.metodo, url: s.url, operacion: s.consulta.trim().split('{')[0].trim() })), erroresJavascript: errores }, null, 2));
  console.log(JSON.stringify({ idEleccion: idCreado, correlacionMutation, mutations, evidencia: carpeta }));
} catch (error) {
  await pagina.screenshot({ path: carpeta + '/fallo.png', fullPage: true });
  console.error('Errores de JavaScript:', errores);
  console.error('URL del fallo:', pagina.url(), 'Elección de prueba:', idCreado ?? 'no creada', 'Nombre:', prefijo);
  throw error;
} finally { await navegador.close(); }
