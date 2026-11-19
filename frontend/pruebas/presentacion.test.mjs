import test from 'node:test';
import assert from 'node:assert/strict';
import { crearIdentificador } from '../src/api/identificadores.js';
import { comprobarPortal } from '../src/api/datosPortal.js';

test('HTTP local sin randomUUID genera un UUID v4 mediante getRandomValues', () => {
  let indice = 0;
  const fuente = { getRandomValues(bytes) { bytes.fill(++indice); return bytes; } };
  const primero = crearIdentificador(fuente), segundo = crearIdentificador(fuente);
  assert.match(primero, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.notEqual(primero, segundo);
  assert.throws(() => crearIdentificador({}), /identificador seguro/);
});
test('el portal distingue ausencia de elección y resultados incompletos sin inventar cifras', () => {
  assert.equal(comprobarPortal(null), null);
  assert.throws(() => comprobarPortal({ proceso: {}, resultados: null }), /incompleta/);
  const portal = { proceso: { nombre: 'Proceso sintético de prueba', unidad: 'Distrito', unidades: [] }, resultados: { candidatos: [], unidades: [], contabilizadas: 0, esperadas: 0, pendientes: 0, observadas: 0, total: 0, avance: 0, blancos: 0, nulos: 0 } };
  assert.equal(comprobarPortal(portal), portal);
  assert.throws(() => comprobarPortal({ ...portal, resultados: { ...portal.resultados, avance: NaN } }), /incompleta/);
});
