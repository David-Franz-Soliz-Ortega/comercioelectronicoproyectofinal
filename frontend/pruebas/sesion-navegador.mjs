// Prueba ligera con dobles HTTP: no accede a Docker ni a APIs o datos reales.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
const servidor = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 42000 + Math.floor(Math.random() * 20000) } });
let navegador;
try {
  await servidor.listen();
  const base = `http://127.0.0.1:${servidor.httpServer.address().port}`;
  navegador = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const pagina = await navegador.newPage();
  const errores = []; pagina.on('pageerror', error => errores.push(error.message));
  let autenticado = false, organizacion = 'a', modo = 'normal', logouts = 0, csrfLogin = 0;
  const identidad = () => ({ idUsuario: 'usuario-de-prueba', usuario: 'operador-de-prueba', idOrganizacion: organizacion, roles: [{ rol: 'OPERADOR', idOrganizacion: 'a' }, { rol: 'ADMIN_ELECTORAL', idOrganizacion: 'b' }] });
  await pagina.route('**/api/v1/autenticacion/**', async ruta => {
    const peticion = ruta.request(), accion = new URL(peticion.url()).pathname.split('/').at(-1);
    const responder = (status, datos, headers = {}) => ruta.fulfill({ status, contentType: 'application/json', headers, ...(status === 204 ? {} : { body: JSON.stringify(datos) }) });
    if (accion === 'csrf') { csrfLogin++; return responder(200, { csrf: 'csrf-exclusivo-de-prueba' }, { 'Set-Cookie': 'sigape-csrf=csrf-exclusivo-de-prueba; Path=/; SameSite=Strict' }); }
    if (accion === 'login') {
      assert.equal(peticion.headers()['x-csrf-token'], 'csrf-exclusivo-de-prueba');
      if (peticion.postDataJSON().contrasena !== 'clave-exclusiva-de-prueba') return responder(401, {});
      autenticado = true; modo = 'normal'; return responder(200, { csrf: 'csrf-exclusivo-de-prueba' });
    }
    if (accion === 'yo') return responder(autenticado ? 200 : 401, autenticado ? identidad() : {});
    assert.equal(peticion.headers()['x-csrf-token'], 'csrf-exclusivo-de-prueba');
    if (accion === 'organizacion') { organizacion = peticion.postDataJSON().idOrganizacion; return responder(204); }
    if (accion === 'logout') { autenticado = false; logouts++; return responder(204); }
    throw new Error('Solicitud inesperada en prueba');
  });
  await pagina.route('**/graphql', async ruta => {
    assert.equal(ruta.request().headers()['x-organizacion'], organizacion);
    if (modo !== 'normal') {
      const status = modo === 'expirada' ? 401 : 403;
      if (status === 401) autenticado = false;
      return ruta.fulfill({ status, json: { errors: [{ message: 'Acceso denegado de prueba' }] } });
    }
    return ruta.fulfill({ json: { data: Object.fromEntries(['elecciones', 'candidaturas', 'inscripciones'].map(clave => [clave, { total: 0, pagina: 1, limite: 10, elementos: [] }])) } });
  });
  async function login(clave = 'clave-exclusiva-de-prueba') {
    await pagina.getByLabel('Usuario', { exact: true }).fill('operador-de-prueba');
    await pagina.getByLabel('Contraseña', { exact: true }).fill(clave);
    await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
  }
  await pagina.goto(base);
  await login('incorrecta-de-prueba');
  await pagina.getByText('Usuario o contraseña incorrectos.').waitFor();
  assert.equal(await pagina.getByLabel('Contraseña', { exact: true }).inputValue(), '');
  await login();
  await pagina.getByRole('button', { name: 'Cerrar sesión', exact: true }).waitFor();
  assert.equal(await pagina.getByRole('button', { name: 'Nueva elección', exact: true }).count(), 0);
  assert.equal(await pagina.getByRole('navigation').getByRole('button', { name: 'Usuarios', exact: true }).count(), 0);
  await pagina.getByRole('navigation').getByRole('button', { name: 'Elecciones', exact: true }).click();
  await pagina.locator('.panel[aria-busy="false"]').waitFor();
  await pagina.reload();
  await pagina.getByRole('button', { name: 'Cerrar sesión', exact: true }).waitFor();
  assert.equal(csrfLogin, 2, 'Restaurar sesión no solicita login ni rota CSRF');
  assert.equal(await pagina.evaluate(() => localStorage.length), 0);
  modo = 'prohibida';
  await pagina.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await pagina.getByText('No tienes permiso para esta operación o su organización.', { exact: true }).first().waitFor();
  assert.equal(await pagina.getByRole('button', { name: 'Cerrar sesión', exact: true }).count(), 1);
  modo = 'normal';
  await pagina.getByLabel('Organización', { exact: true }).selectOption('b');
  await pagina.getByRole('button', { name: 'Nueva elección', exact: true }).waitFor();
  modo = 'expirada';
  await pagina.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await pagina.getByRole('heading', { name: 'Iniciar sesión', exact: true }).waitFor();
  await login();
  await pagina.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await pagina.getByRole('heading', { name: 'Iniciar sesión', exact: true }).waitFor();
  assert.equal(logouts, 1);
  assert.deepEqual(errores, []);
  console.log('OK: login incorrecto/correcto, recarga, roles y organización, 403 sin logout, expiración 401, logout y ausencia de localStorage (dobles HTTP).');
} finally { await navegador?.close(); await servidor.close(); }
