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
  const portal = { proceso: { id: 'p', cargo: 'Rectorado', nombre: 'Proceso sintético de prueba', unidad: 'Distrito', unidades: [] }, resultados: { candidatos: [], unidades: [], contabilizadas: 0, esperadas: 0, pendientes: 0, observadas: 0, total: 0, validos: 0, avance: 0, blancos: 0, nulos: 0 } };
  assert.equal(comprobarPortal(portal), portal);
  assert.throws(() => comprobarPortal({ ...portal, resultados: { ...portal.resultados, avance: NaN } }), /incompleta/);
});

test('porcentajes y totales inconsistentes se rechazan antes de mostrarlos', () => {
 const portal = { proceso: { id: 'p', nombre: 'Prueba', cargo: 'Rectorado', unidad: 'Facultad', unidades: [] }, resultados: { candidatos: [{ id: 'c', nombre: 'Candidatura', foto: null, votos: 10, porcentaje: 100 }], unidades: [], contabilizadas: 1, esperadas: 2, pendientes: 1, observadas: 0, total: 10, validos: 10, avance: 50, blancos: 0, nulos: 0, actualizadoEn: null } };
 assert.equal(comprobarPortal(portal), portal);
 for (const cambio of [{ avance: 100 }, { total: 99 }, { actualizadoEn: 'fecha inválida' }, { candidatos: [{ ...portal.resultados.candidatos[0], porcentaje: 150 }] }, { candidatos: [{ ...portal.resultados.candidatos[0], porcentaje: 1 }] }]) {
  assert.throws(() => comprobarPortal({ ...portal, resultados: { ...portal.resultados, ...cambio } }), /incompleta/);
 }
});
