import test from 'node:test';
import assert from 'node:assert/strict';
import { agruparEventos } from '../dist/catalogo-publico.js';
const base = { idOrganizacion: 'organizacion-a', nombre: 'Evento de prueba', tipo: 'universidad', actual: false, publicado: true, archivado: false };
test('el catálogo reúne cargos por organización y evento, prioriza Rectorado y excluye borradores', () => {
 const eventos = agruparEventos([
  { ...base, id: 'vice', cargo: 'Vicerrectorado', actual: true },
  { ...base, id: 'rector', cargo: 'Rectorado' },
  { ...base, id: 'decano', cargo: 'Decanato' },
  { ...base, id: 'director', cargo: 'Dirección de carrera' },
  { ...base, id: 'borrador', cargo: 'Borrador privado', publicado: false },
  { ...base, id: 'archivado', cargo: 'Archivado', archivado: true },
  { ...base, id: 'otra-institucion', cargo: 'Presidencia', idOrganizacion: 'organizacion-b' },
 ]);
 assert.equal(eventos.length, 2);
 assert.equal(eventos[0].destacado, true);
 assert.deepEqual(eventos[0].procesos.map(p => p.id), ['rector', 'vice', 'decano', 'director']);
 assert.equal(eventos[1].procesos[0].id, 'otra-institucion');
 assert.ok(!JSON.stringify(eventos).includes('idOrganizacion'));
 assert.notEqual(eventos[0].id, eventos[1].id);
});
test('el evento destacado precede al alfabético y su identificador no cambia con el orden de filas', () => {
 const filas = [{ ...base, id: '1', cargo: 'Rector', nombre: 'Z evento', actual: true }, { ...base, id: '2', cargo: 'Presidente', nombre: 'A evento' }];
 assert.deepEqual(agruparEventos(filas), agruparEventos([...filas].reverse()));
 assert.equal(agruparEventos(filas)[0].nombre, 'Z evento');
 assert.deepEqual(agruparEventos([{ ...base, id: 'b', cargo: 'Privado', publicado: false }]), []);
});
