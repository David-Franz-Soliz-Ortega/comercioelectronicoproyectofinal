// Dobles HTTP exclusivos de prueba; no contactan servicios ni crean datos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { iniciarSesion, obtenerSesion, finalizarSesion, seleccionarOrganizacion, establecerOrganizacion } from '../src/api/clienteSesion.js';
import { consultarGraphql } from '../src/api/clienteGraphql.js';
import { puedeVerSeccion, tienePermiso } from '../src/navegacion/planPermisos.js';

function simularGlobal(t, nombre, valor) {
  const anterior = Object.getOwnPropertyDescriptor(globalThis, nombre);
  Object.defineProperty(globalThis, nombre, { value: valor, configurable: true });
  t.after(() => anterior ? Object.defineProperty(globalThis, nombre, anterior) : delete globalThis[nombre]);
}
test('login usa CSRF y cookies same-origin; restauración y logout utilizan los endpoints reales', async t => {
  simularGlobal(t, 'document', { cookie: 'sigape-csrf=csrf-de-prueba' });
  const llamadas = [];
  t.mock.method(globalThis, 'fetch', async (url, opciones) => {
    llamadas.push([url, opciones]);
    assert.equal(opciones.credentials, 'same-origin');
    assert.equal(opciones.headers['X-CSRF-Token'], 'csrf-de-prueba');
    return url.endsWith('/logout') ? new Response(null, { status: 204 }) : Response.json(url.endsWith('/yo') ? { idUsuario: 'usuario-prueba', roles: [] } : { csrf: 'csrf-de-prueba' });
  });
  assert.equal((await iniciarSesion('prueba', 'solo-doble-de-prueba')).idUsuario, 'usuario-prueba');
  await obtenerSesion(); await finalizarSesion();
  assert.deepEqual(llamadas.map(([url]) => url), ['csrf', 'login', 'yo', 'yo', 'logout'].map(ruta => '/api/v1/autenticacion/' + ruta));
  assert.deepEqual(JSON.parse(llamadas[1][1].body), { usuario: 'prueba', contrasena: 'solo-doble-de-prueba' });
  assert.equal(llamadas[4][1].method, 'POST');
});
test('401 caduca la sesión, 403 conserva la sesión y login incorrecto no provoca una caducidad global', async t => {
  const eventos = [];
  simularGlobal(t, 'window', { dispatchEvent: evento => eventos.push(evento.type) });
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 401 }));
  await assert.rejects(obtenerSesion(), error => error.estado === 401);
  assert.deepEqual(eventos, ['sigape:sesion-caducada']);
  fetch.mock.mockImplementation(async url => url.endsWith('/csrf') ? Response.json({ csrf: 'prueba' }) : new Response(null, { status: 401 }));
  await assert.rejects(iniciarSesion('prueba', 'clave-prueba'), /incorrectos/);
  assert.equal(eventos.length, 1);
  fetch.mock.mockImplementation(async () => new Response(null, { status: 403 }));
  await assert.rejects(finalizarSesion(), error => error.estado === 403);
  assert.equal(eventos.length, 1);
});
test('GraphQL envía el alcance y CSRF; no presenta datos parciales cuando hay errores de autorización', async t => {
  establecerOrganizacion('organizacion-prueba');
  t.after(() => establecerOrganizacion(null));
  simularGlobal(t, 'document', { cookie: '__Host-sigape-csrf=csrf-prueba' });
  t.mock.method(globalThis, 'fetch', async (_url, opciones) => {
    assert.equal(opciones.headers['X-Organizacion'], 'organizacion-prueba');
    assert.equal(opciones.headers['X-CSRF-Token'], 'csrf-prueba');
    return Response.json({ data: { elecciones: null }, errors: [{ extensions: { code: 'NO_AUTORIZADO' } }] });
  });
  await assert.rejects(consultarGraphql('query { elecciones { total } }'), error => error.estado === 403);
});
test('selección de organización persistida en identidad antes de restaurar su sesión', async t => {
  const rutas = [];
  t.mock.method(globalThis, 'fetch', async (url, opciones) => {
    rutas.push(url);
    if (url.endsWith('/organizacion')) { assert.deepEqual(JSON.parse(opciones.body), { idOrganizacion: 'org-prueba' }); return new Response(null, { status: 204 }); }
    return Response.json({ idOrganizacion: 'org-prueba' });
  });
  assert.equal((await seleccionarOrganizacion('org-prueba')).idOrganizacion, 'org-prueba');
  assert.equal(rutas.length, 2);
});
test('roles y alcance proceden de la sesión; SUPERADMIN no hereda permisos electorales', () => {
  const sesion = { idOrganizacion: 'a', roles: [{ rol: 'ELECTOR', idOrganizacion: 'a' }, { rol: 'ADMIN_ELECTORAL', idOrganizacion: 'b' }] };
  assert.equal(puedeVerSeccion(sesion, 'elecciones'), true);
  assert.equal(puedeVerSeccion(sesion, 'padron'), false);
  assert.equal(tienePermiso(sesion, 'elecciones:crear'), false);
  assert.equal(tienePermiso({ ...sesion, idOrganizacion: 'b' }, 'elecciones:crear'), true);
  assert.equal(puedeVerSeccion({ roles: [{ rol: 'SUPERADMIN', idOrganizacion: null }] }, 'usuarios'), true);
  assert.equal(puedeVerSeccion({ roles: [{ rol: 'SUPERADMIN', idOrganizacion: null }] }, 'elecciones'), false);
  assert.equal(puedeVerSeccion(null, 'inicio'), false);
  assert.equal(puedeVerSeccion({ roles: [{ rol: 'INVENTADO' }], idOrganizacion: 'a' }, 'elecciones'), false);
});
