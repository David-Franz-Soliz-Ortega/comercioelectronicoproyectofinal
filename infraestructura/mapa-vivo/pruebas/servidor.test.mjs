import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { crearMapaVivo, crearVigilante, disponibilidad, hostPermitido } from '../src/servidor.mjs';
import { crearDocker, PERMITIDOS } from '../src/docker.mjs';

const catalogoVacio = { proceso: async () => null, resultados: async () => null, actual: async () => null };

function pedir(puerto, { metodo = 'GET', ruta = '/', cabeceras = {}, cuerpo } = {}) {
  return new Promise((resolver, rechazar) => {
    const req = http.request({ host: '127.0.0.1', port: puerto, path: ruta, method: metodo, headers: { Host: `localhost:${puerto}`, ...cabeceras } }, res => {
      const partes = [];
      res.on('data', p => partes.push(p));
      res.on('end', () => resolver({ estado: res.statusCode, cabeceras: res.headers, texto: Buffer.concat(partes).toString('utf8') }));
    });
    req.on('error', rechazar);
    if (cuerpo) req.write(cuerpo);
    req.end();
  });
}

async function levantar(opciones = {}) {
  const mapa = crearMapaVivo({ catalogo: catalogoVacio, intervaloEstado: 60_000, ...opciones });
  await mapa.iniciar();
  await new Promise(r => mapa.servidor.listen(0, '127.0.0.1', r));
  return { mapa, puerto: mapa.servidor.address().port };
}

test('rechaza hosts ajenos para evitar DNS rebinding', async () => {
  assert.equal(hostPermitido('localhost:8891'), true);
  assert.equal(hostPermitido('[::1]:8891'), true);
  assert.equal(hostPermitido('ataque.example:8891'), false);
  const { mapa, puerto } = await levantar();
  try {
    assert.equal((await pedir(puerto, { ruta: '/api/salud', cabeceras: { Host: 'ataque.example' } })).estado, 421);
    const pagina = await pedir(puerto);
    assert.equal(pagina.estado, 200);
    assert.match(pagina.cabeceras['content-security-policy'], /script-src 'self'/);
  } finally { await mapa.detener(); }
});

test('los controles exigen cabecera propia y origen del mismo host', async () => {
  let ataques = 0;
  const pruebas = { ataqueSesion: async () => { ataques += 1; return { tipo: 'ataque-sesion', estado: 401 }; }, ataqueInterno: async () => ({}), rafaga: async () => ({}) };
  const { mapa, puerto } = await levantar({ pruebas });
  const cuerpo = JSON.stringify({ accion: 'ataque-sesion' });
  try {
    assert.equal((await pedir(puerto, { metodo: 'POST', ruta: '/api/presentador', cuerpo, cabeceras: { 'Content-Type': 'application/json' } })).estado, 403);
    assert.equal((await pedir(puerto, { metodo: 'POST', ruta: '/api/presentador', cuerpo, cabeceras: { 'Content-Type': 'application/json', 'X-Mapa-Vivo': 'presentador', Origin: 'http://ataque.example' } })).estado, 403);
    const ok = await pedir(puerto, { metodo: 'POST', ruta: '/api/presentador', cuerpo, cabeceras: { 'Content-Type': 'application/json', 'X-Mapa-Vivo': 'presentador', Origin: `http://localhost:${puerto}` } });
    assert.equal(ok.estado, 202);
    assert.equal(ataques, 1);
    const sinDocker = await pedir(puerto, { metodo: 'POST', ruta: '/api/presentador', cuerpo: JSON.stringify({ accion: 'derribar', servicio: 'actas' }), cabeceras: { 'Content-Type': 'application/json', 'X-Mapa-Vivo': 'presentador' } });
    assert.equal(sinDocker.estado, 503);
  } finally { await mapa.detener(); }
});

test('el flujo SSE difunde solicitudes reales y omite la sonda interna', async () => {
  const { mapa, puerto } = await levantar();
  try {
    const recibido = await new Promise((resolver, rechazar) => {
      const req = http.get({ host: '127.0.0.1', port: puerto, path: '/api/flujo', headers: { Host: 'localhost' } }, res => {
        let texto = '';
        res.on('data', parte => {
          texto += parte;
          if (texto.includes('event: inicio') && !texto.includes('event: solicitud')) {
            mapa.ingresarSolicitud({ metodo: 'GET', uri: '/salud', estado: 200, ms: 1, cliente: '', prueba: 'sonda' });
            mapa.ingresarSolicitud({ metodo: 'POST', uri: '/api/v1/actas/lectura', estado: 200, ms: 1200, cliente: '10.0.0.5', prueba: '' });
          }
          if (texto.includes('event: solicitud')) { req.destroy(); resolver(texto); }
        });
      });
      req.on('error', e => { if (e.code !== 'ECONNRESET') rechazar(e); });
    });
    const solicitudes = recibido.split('\n\n').filter(b => b.startsWith('event: solicitud'));
    assert.equal(solicitudes.length, 1);
    const datos = JSON.parse(solicitudes[0].split('data: ')[1]);
    assert.equal(datos.accion, 'Lectura OCR del acta');
    assert.equal(JSON.stringify(datos).includes('10.0.0.5'), false);
    assert.equal(mapa.estadoActual().registroEntrada, true);
  } finally { await mapa.detener(); }
});

test('la disponibilidad sale de señales observadas', () => {
  assert.equal(disponibilidad('actas', {}, null, {}), 'sin-datos');
  assert.equal(disponibilidad('actas', { actas: 'ok' }, { estado: 'exited' }, {}), 'caido');
  assert.equal(disponibilidad('actas', { actas: 'caido' }, { estado: 'running', salud: 'starting' }, {}), 'iniciando');
  assert.equal(disponibilidad('conteo', {}, null, { 'resultados.conteo.v1': { mensajes: 3, consumidores: 0 } }), 'caido');
  assert.equal(disponibilidad('conteo', {}, null, { 'resultados.conteo.v1': { mensajes: 0, consumidores: 1 } }), 'ok');
  assert.equal(disponibilidad('conteo', {}, null, {}), 'sin-datos');
});

test('detecta caída, recuperación y vaciado de la cola sin inventar pérdidas', () => {
  let t = 0;
  const v = crearVigilante({ ahora: () => t });
  const cola = (mensajes, consumidores, errores = 0) => ({ 'resultados.conteo.v1': { mensajes, consumidores }, 'resultados.conteo.v1.dlq': { mensajes: errores, consumidores: 0 } });
  assert.deepEqual(v.revisar({ conteo: 'ok' }, cola(0, 1)), []);
  t = 1000;
  assert.deepEqual(v.revisar({ conteo: 'caido' }, cola(1, 0)), [{ tipo: 'caida', nodo: 'conteo', cola: 1 }]);
  t = 2000;
  assert.deepEqual(v.revisar({ conteo: 'caido' }, cola(4, 0)), []);
  t = 4500;
  assert.deepEqual(v.revisar({ conteo: 'ok' }, cola(2, 1)), [{ tipo: 'recuperado', nodo: 'conteo', duracionMs: 3500, cola: 4 }]);
  t = 5000;
  assert.deepEqual(v.revisar({ conteo: 'ok' }, cola(0, 1)), [{ tipo: 'cola-vacia', nodo: 'conteo', procesadas: 4, errores: 0 }]);
  // El primer estado observado nunca se anuncia como caída.
  assert.deepEqual(crearVigilante().revisar({ actas: 'caido' }, {}), []);
});

test('Docker solo actúa sobre servicios permitidos y con un comando fijo', async () => {
  const llamadas = [];
  const contenedores = [
    { Id: 'abc', State: 'running', Labels: { 'com.docker.compose.project': 'tuvoto', 'com.docker.compose.service': 'resultados-conteo' } },
    { Id: 'def', State: 'running', Labels: { 'com.docker.compose.project': 'tuvoto', 'com.docker.compose.service': 'identidad' } },
    { Id: 'ghi', State: 'running', Labels: { 'com.docker.compose.project': 'otro', 'com.docker.compose.service': 'actas' } },
  ];
  const docker = crearDocker({ peticion: async (metodo, ruta, cuerpo) => {
    llamadas.push([metodo, ruta, cuerpo]);
    if (ruta.startsWith('/containers/json')) return contenedores;
    if (ruta.endsWith('/exec')) return { Id: 'ejec' };
    if (ruta.match(/\/containers\/\w+\/json/)) return { State: { Status: 'running', Health: { Status: 'healthy' } }, RestartCount: 2 };
    return null;
  } });
  const lista = await docker.listar();
  assert.deepEqual(Object.keys(lista).sort(), ['conteo', 'identidad']);
  assert.equal(lista.conteo.reinicios, 2);
  assert.equal(lista.identidad.controlable, false);

  await assert.rejects(docker.accion('identidad', 'derribar'), /no permitida/);
  await assert.rejects(docker.accion('resultados-conteo', 'borrar'), /no permitida/);
  await docker.accion('resultados-conteo', 'derribar');
  const exec = llamadas.find(([, ruta]) => ruta === '/containers/abc/exec');
  assert.deepEqual(exec[2].Cmd, ['python', '-c', 'import os,signal; os.kill(1, signal.SIGINT)']);
  assert.ok(llamadas.some(([m, ruta]) => m === 'POST' && ruta === '/exec/ejec/start'));
  assert.ok(!PERMITIDOS.includes('base-postgres'));
});

test('una búsqueda DNS colgada se comparte y no se acumula', async () => {
  const { direccion } = await import('../src/sondas.mjs');
  let llamadas = 0;
  let liberar;
  const buscar = () => { llamadas += 1; return new Promise(r => { liberar = () => r({ address: '10.0.0.9' }); }); };
  await assert.rejects(direccion('actas-detenido', { timeout: 20, buscar }), /DNS sin respuesta/);
  await assert.rejects(direccion('actas-detenido', { timeout: 20, buscar }), /DNS sin respuesta/);
  assert.equal(llamadas, 1);
  liberar();
  await new Promise(r => setImmediate(r));
  assert.equal(await direccion('actas-detenido', { timeout: 20, buscar: async () => ({ address: '10.0.0.10' }) }), '10.0.0.10');
  assert.equal(await direccion('127.0.0.1'), '127.0.0.1');
});
