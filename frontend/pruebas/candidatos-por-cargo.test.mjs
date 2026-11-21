import test from 'node:test';
import assert from 'node:assert/strict';
import { candidatosPorCargo } from '../src/api/candidatosPorCargo.js';

const procesos = [
  { id: 'd1', cargo: 'Decano', ambito: 'Tecnología', estado: 'borrador', candidatos: [{ id: 'a', nombre: 'Persona sintética', tieneFoto: true }, { id: 'b', nombre: 'Otra persona' }] },
  { id: 'd2', cargo: 'Decano', ambito: 'Medicina', estado: 'archivada', vuelta: 2, candidatos: [{ id: 'c', nombre: 'Persona sintética' }] },
  { id: 'director', cargo: 'Director', grupoCarreras: 'Grupo A', carreras: ['Informática'], candidatos: [] },
];
test('el listado conserva candidatos de cargos y vueltas distintos, incluso con el mismo nombre', () => {
  const copia = structuredClone(procesos), r = candidatosPorCargo(procesos);
  assert.equal(r.totalCandidatos, 3); assert.equal(r.totalCargos, 3); assert.equal(r.sinCandidatos, 1);
  assert.equal(r.conFotografia, 1); assert.equal(r.sinFotografia, 2);
  assert.deepEqual(r.grupos[0].procesos.map(p => p.id), ['d1', 'd2']);
  assert.equal(r.grupos[0].procesos[1].estado, 'archivada');
  assert.deepEqual(procesos, copia);
});
test('buscar un candidato muestra su cargo completo sin mezclar ni ocultar a sus otros candidatos', () => {
  const r = candidatosPorCargo(procesos, { busqueda: 'SINTETICA' });
  assert.equal(r.cargosVisibles, 2); assert.equal(r.grupos[0].procesos[0].candidatos.length, 2);
  assert.equal(r.totalCandidatos, 3); assert.equal(r.totalCargos, 3);
});
test('filtrar familia y facultad o carrera se combina sin alterar los totales de la institución', () => {
  assert.deepEqual(candidatosPorCargo(procesos, { familia: 'decanos', busqueda: 'TECNOLOGIA' }).grupos[0].procesos.map(p => p.id), ['d1']);
  assert.deepEqual(candidatosPorCargo(procesos, { familia: 'directores', busqueda: 'INFORMATICA' }).grupos[0].procesos.map(p => p.id), ['director']);
  assert.equal(candidatosPorCargo(procesos, { familia: 'directores', busqueda: 'Medicina' }).cargosVisibles, 0);
  assert.equal(candidatosPorCargo([], {}).totalCandidatos, 0);
});
