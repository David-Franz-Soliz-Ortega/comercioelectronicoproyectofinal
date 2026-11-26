import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describirSolicitud, servicioDeRuta } from '../src/rutas.mjs';
import { interpretarLinea } from '../src/entrada.mjs';
import { NODOS, existeArista, recorrido } from '../publico/disposicion.js';

const nginx = readFileSync(new URL('../../tuvoto/nginx.conf', import.meta.url), 'utf8');

test('el enrutamiento coincide con cada location de NGINX', () => {
  const destinos = { 'identidad:3000': 'identidad', 'elecciones:3000': 'elecciones', 'actas:8000': 'actas', 'resultados:8000': 'resultados', 'gateway-graphql:4000': 'gateway', 'frontend:3000': 'frontend' };
  const reglas = [...nginx.matchAll(/location (?:\^~|=) (\/[^ ]+) \{ set \$destino ([a-z-]+:\d+);/g)];
  assert.ok(reglas.length > 15);
  for (const [, prefijo, destino] of reglas) {
    if (prefijo.includes('documentacion') || prefijo.includes('esquemas')) continue;
    assert.equal(servicioDeRuta(prefijo === '/graphql' ? prefijo : prefijo + '/x'), destinos[destino], prefijo);
  }
  assert.equal(servicioDeRuta('/api/v1/interno/autorizar'), 'entrada');
  assert.equal(servicioDeRuta('/'), 'frontend');
});

test('describe el flujo del operador y clasifica rechazos', () => {
  const lectura = describirSolicitud({ metodo: 'POST', uri: '/api/v1/actas/lectura', estado: 200 });
  assert.deepEqual([lectura.servicio, lectura.accion, lectura.resultado, lectura.origen], ['actas', 'Lectura OCR del acta', 'ok', 'operadores']);
  const motivo = estado => describirSolicitud({ metodo: 'POST', uri: '/api/v1/actas/lectura', estado }).motivo;
  assert.notEqual(motivo(400), motivo(422));
  assert.equal(motivo(499), 'El cliente cerró la conexión');
  assert.deepEqual(lectura.ramas, ['identidad', 'elecciones']);

  const parte = describirSolicitud({ metodo: 'PUT', uri: '/api/v1/actas/cargas/5b9f6d55-6a3a-4a1f-9a0e-3a3a3a3a3a3a', estado: 204 });
  assert.deepEqual([parte.servicio, parte.accion, parte.resultado, parte.menor], ['actas', 'Carga de fotografía por partes', 'ok', true]);

  const correccion = describirSolicitud({ metodo: 'PUT', uri: '/api/v1/actas/mesas/5b9f6d55-6a3a-4a1f-9a0e-3a3a3a3a3a3a', estado: 200 });
  assert.equal(correccion.accion, 'Corrección de acta');

  const denegado = describirSolicitud({ metodo: 'POST', uri: '/api/v1/actas', estado: 401 });
  assert.equal(denegado.resultado, 'denegado');
  assert.equal(denegado.rechazoEn, 'identidad');

  const interno = describirSolicitud({ metodo: 'POST', uri: '/api/v1/interno/autorizar', estado: 403 });
  assert.equal(interno.rechazoEn, 'entrada');

  const caido = describirSolicitud({ metodo: 'POST', uri: '/api/v1/actas', estado: 502 });
  assert.equal(caido.resultado, 'caido');
  assert.equal(caido.rechazoEn, 'actas');

  const publico = describirSolicitud({ metodo: 'POST', uri: '/graphql', estado: 200 });
  assert.equal(publico.origen, 'publico');

  assert.equal(describirSolicitud({ metodo: 'GET', uri: '/assets/app-1.js', estado: 200 }).estatico, true);
});

test('cada llamada interna dibujada tiene una conexión en el mapa', () => {
  const rutas = [
    ['POST', '/api/v1/autenticacion/login'], ['POST', '/api/v1/actas/lectura'], ['POST', '/api/v1/actas'],
    ['PUT', '/api/v1/actas/mesas/x'], ['DELETE', '/api/v1/actas/mesas/x'], ['GET', '/api/v1/actas'],
    ['GET', '/api/v1/publico/actas/x/avance'], ['GET', '/api/v1/mis-mesas'], ['GET', '/api/v1/mesas/x/contexto'],
    ['GET', '/api/v1/configuracion/procesos'], ['GET', '/api/v1/publico/eventos'], ['POST', '/graphql'],
    ['GET', '/api/v1/publico/resultados/x'], ['GET', '/api/v1/informes/x'], ['GET', '/api/v1/usuarios'],
  ];
  for (const [metodo, uri] of rutas) {
    const d = describirSolicitud({ metodo, uri, estado: 200 });
    assert.ok(NODOS[d.servicio], uri);
    const camino = recorrido(d.origen, d.servicio);
    for (let i = 0; i < camino.length - 1; i += 1) assert.ok(existeArista(camino[i], camino[i + 1]), `${uri}: ${camino[i]}→${camino[i + 1]}`);
    for (const rama of d.ramas) assert.ok(existeArista(d.servicio, rama), `${uri}: ${d.servicio}→${rama}`);
  }
});

test('interpreta el syslog de NGINX y descarta líneas ajenas', () => {
  const linea = '<190>Nov 24 22:10:01 tuvoto: {"m":"POST","u":"/api/v1/actas","s":"201","t":"0.084","c":"192.168.1.20","p":""}';
  assert.deepEqual(interpretarLinea(linea), { metodo: 'POST', uri: '/api/v1/actas', estado: 201, ms: 84, cliente: '192.168.1.20', prueba: '' });
  assert.equal(interpretarLinea('<190>Nov 24 tuvoto: texto libre'), null);
  assert.equal(interpretarLinea('<190>tuvoto: {"m":"GET","u":"/","s":"x"}'), null);
});
