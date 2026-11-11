// Verificación ligera de contratos de frontend con dobles HTTP; sin escrituras reales.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solicitarRest } from '../src/api/clienteRest.js';
import { recursosP1, datosEditables } from '../src/api/recursosP1.js';
import { consultarEstadoServicio } from '../src/api/estadoServicios.js';
import { establecerOrganizacion } from '../src/api/clienteSesion.js';
import { tienePermiso } from '../src/navegacion/planPermisos.js';

test('CRUD P1 respeta rutas, cuerpos OpenAPI, alcance y cookies; las eliminaciones solo se simulan', async t => {
  const documento = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'sigape-csrf=solo-prueba' } });
  t.after(() => { documento ? Object.defineProperty(globalThis, 'document', documento) : delete globalThis.document; establecerOrganizacion(null); });
  establecerOrganizacion('organizacion-de-sesion');
  const llamadas = [];
  t.mock.method(globalThis, 'fetch', async (ruta, opciones) => {
    llamadas.push([ruta, opciones]);
    assert.equal(opciones.credentials, 'same-origin');
    assert.equal(opciones.headers['X-CSRF-Token'], 'solo-prueba');
    assert.equal(opciones.headers['X-Organizacion'], 'organizacion-autorizada');
    return opciones.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json({ elementos: [], total: 0 });
  });
  for (const [recurso, especificacion] of Object.entries(recursosP1)) {
    const datos = datosEditables(recurso, { nombre: 'Demostración', idEleccion: 'eleccion-de-prueba', [especificacion.id]: 'id-prueba', campoInterno: 'no-enviar', elegible: true });
    assert.deepEqual(Object.keys(datos), especificacion.campos);
    assert.equal(Object.hasOwn(datos, 'campoInterno'), false);
    await solicitarRest('/' + especificacion.ruta, { organizacion: 'organizacion-autorizada' });
    await solicitarRest('/' + especificacion.ruta, { metodo: 'POST', datos, organizacion: 'organizacion-autorizada' });
    await solicitarRest('/' + especificacion.ruta + '/id-prueba', { metodo: 'PUT', datos, organizacion: 'organizacion-autorizada' });
    assert.equal(await solicitarRest('/' + especificacion.ruta + '/id-prueba', { metodo: 'DELETE', organizacion: 'organizacion-autorizada' }), null);
  }
  assert.equal(llamadas.length, 16);
  assert.deepEqual(llamadas.slice(0, 4).map(([ruta]) => ruta), ['/api/v1/elecciones', '/api/v1/elecciones', '/api/v1/elecciones/id-prueba', '/api/v1/elecciones/id-prueba']);
});
test('errores REST distinguen validación, acceso y registro inexistente; no aceptan rutas externas', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 422 }));
  await assert.rejects(solicitarRest('/candidaturas', { metodo: 'POST', datos: {} }), /campos requeridos/);
  fetch.mock.mockImplementation(async () => new Response(null, { status: 403 }));
  await assert.rejects(solicitarRest('/identidades'), error => error.estado === 403);
  fetch.mock.mockImplementation(async () => new Response(null, { status: 404 }));
  await assert.rejects(solicitarRest('/inscripciones/id-prueba'), /ya no está disponible/);
  await assert.rejects(solicitarRest('http://principal.invalid/identidades'), /no permitido/);
});
test('salud solo indica disponible con respuesta exitosa y servicio coincidente, nunca con errores', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ servicio: 'identidad', estado: 'saludable' }));
  const senal = new AbortController().signal;
  assert.equal(await consultarEstadoServicio('identidad', senal), 'Disponible');
  assert.equal(await consultarEstadoServicio('elecciones', senal), 'No disponible');
  fetch.mock.mockImplementation(async () => Response.json({ servicio: 'identidad' }, { status: 503 }));
  assert.equal(await consultarEstadoServicio('identidad', senal), 'No disponible');
  fetch.mock.mockImplementation(async () => Response.json({}, { status: 403 }));
  assert.equal(await consultarEstadoServicio('identidad', senal), 'Consulta restringida');
  fetch.mock.mockImplementation(async () => { throw new Error('sin red'); });
  assert.equal(await consultarEstadoServicio('identidad', senal), 'Sin respuesta');
});
test('OPERADOR puede registrar candidaturas e inscripciones pero no modificarlas ni eliminarlas', () => {
  const sesion = { idOrganizacion: 'a', roles: [{ rol: 'OPERADOR', idOrganizacion: 'a' }] };
  assert.equal(tienePermiso(sesion, 'candidaturas:crear'), true);
  assert.equal(tienePermiso(sesion, 'padron:crear'), true);
  assert.equal(tienePermiso(sesion, 'candidaturas:modificar'), false);
  assert.equal(tienePermiso(sesion, 'padron:modificar'), false);
  assert.equal(tienePermiso({ ...sesion, idOrganizacion: 'b' }, 'padron:crear'), false);
});
