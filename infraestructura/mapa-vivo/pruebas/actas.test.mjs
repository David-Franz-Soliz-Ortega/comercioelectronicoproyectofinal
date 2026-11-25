import test from 'node:test';
import assert from 'node:assert/strict';
import { crearMemoriaActas, eventoValido } from '../src/actas.mjs';
import { crearEstadisticas } from '../src/estadisticas.mjs';
import { resumirResultados, crearCatalogo } from '../src/publico.mjs';

const PROCESO = '11111111-1111-4111-8111-111111111111';
const MESA = '22222222-2222-4222-8222-222222222222';
const ALFA = '33333333-3333-4333-8333-333333333333';
const BETA = '44444444-4444-4444-8444-444444444444';
const proceso = { id: PROCESO, cargo: 'Decano', nombre: 'Simulacro', candidatos: [{ id: ALFA, nombre: 'Candidatura Alfa' }, { id: BETA, nombre: 'Candidatura Beta' }], mesas: [{ id: MESA, codigo: 'PRUEBA-01' }] };

function evento(version, conteo, observada = false) {
  return { idEvento: `evento-${version}`, tipo: 'acta.actualizada.v1', version: 1,
    datos: { idProceso: PROCESO, idMesa: MESA, idOrganizacion: PROCESO, versionActa: version, unidad: 'Unidad de prueba', sector: 'general', conteo, observada } };
}
const conteo = (alfa, beta) => ({ votos: [{ idCandidato: ALFA, cantidad: alfa }, { idCandidato: BETA, cantidad: beta }], blancos: 3, nulos: 2, total: alfa + beta + 5 });

test('una corrección reemplaza a la versión anterior y explica el cambio', () => {
  const memoria = crearMemoriaActas();
  const primera = memoria.procesar(evento(1, conteo(120, 80)), proceso);
  assert.equal(primera.tipo, 'nueva');
  assert.equal(primera.mesa, 'PRUEBA-01');
  assert.equal(primera.total, 205);

  const segunda = memoria.procesar(evento(2, conteo(118, 80)), proceso);
  assert.equal(segunda.tipo, 'correccion');
  assert.deepEqual(segunda.cambios, [{ nombre: 'Candidatura Alfa', antes: 120, despues: 118 }]);

  // Una reentrega de la misma versión no vuelve a contarse.
  assert.equal(memoria.procesar(evento(2, conteo(118, 80)), proceso), null);
});

test('distingue actas observadas y anulaciones', () => {
  const memoria = crearMemoriaActas();
  memoria.procesar(evento(1, conteo(10, 5)), proceso);
  assert.equal(memoria.procesar(evento(2, conteo(10, 5), true), proceso).tipo, 'observada');
  assert.equal(memoria.procesar(evento(3, null), proceso).tipo, 'anulacion');
});

test('rechaza eventos fuera de contrato y no agrega datos del operador', () => {
  assert.equal(eventoValido({ tipo: 'otro' }), false);
  assert.equal(eventoValido(evento(0, conteo(1, 1))), false);
  const memoria = crearMemoriaActas();
  const acta = memoria.procesar({ ...evento(1, conteo(1, 1)), datos: { ...evento(1, conteo(1, 1)).datos, idOperador: 'x' } }, null);
  assert.equal(JSON.stringify(acta).includes('Operador'), false);
  assert.equal(acta.cargo, null);
});

test('las estadísticas cuentan dispositivos sin conservar direcciones', () => {
  let t = 0;
  const e = crearEstadisticas({ ahora: () => t });
  e.registrar({ servicio: 'actas', ms: 40, cliente: '192.168.1.20' });
  e.registrar({ servicio: 'actas', ms: 60, cliente: '192.168.1.21' });
  e.registrar({ servicio: 'gateway', ms: 10, cliente: '192.168.1.99', prueba: 'rafaga' });
  const resumen = e.resumen();
  assert.equal(resumen.dispositivos, 2);
  assert.equal(resumen.solicitudesMinuto, 3);
  assert.equal(resumen.p95Ms, 60);
  assert.equal(JSON.stringify(resumen).includes('192.168'), false);
  t = 200_000;
  assert.deepEqual([e.resumen().dispositivos, e.resumen().solicitudesMinuto], [0, 0]);
});

test('el catálogo usa solo endpoints públicos y devuelve null sin publicación', async () => {
  const pedidas = [];
  const catalogo = crearCatalogo({
    eleccionesUrl: 'http://elecciones:3000', resultadosUrl: 'http://resultados:8000',
    pedir: async url => {
      pedidas.push(url);
      if (url.includes('/procesos/no-publicado')) throw Object.assign(new Error('404'), { estado: 404 });
      if (url.includes('/publico/procesos/')) return proceso;
      return { esperadas: 4, contabilizadas: 1, observadas: 0, avance: 25, validos: 200, blancos: 3, nulos: 2, total: 205, ponderacionAplicada: false, candidatos: [{ id: ALFA, nombre: 'Candidatura Alfa', votos: 120, porcentaje: 60, foto: '/x' }] };
    },
  });
  const r = await catalogo.resultados(PROCESO);
  assert.equal(r.cargo, 'Decano');
  assert.deepEqual(r.candidatos, [{ id: ALFA, nombre: 'Candidatura Alfa', votos: 120, porcentaje: 60 }]);
  assert.equal(await catalogo.resultados('no-publicado'), null);
  assert.ok(pedidas.every(url => url.includes('/api/v1/publico/')));
  assert.equal(resumirResultados(proceso, null), null);
});
