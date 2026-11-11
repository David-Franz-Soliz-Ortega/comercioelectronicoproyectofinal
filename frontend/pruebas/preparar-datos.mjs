import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const meta = JSON.parse(await readFile(process.env.MANIFIESTO_FRONTEND, 'utf8'));
const base = process.env.URL_BASE;
assert.equal(meta.base, base);
assert.ok(meta.proyecto.startsWith('sigape-cierre-p1-'));
assert.equal(new URL(base).hostname, '127.0.0.1');
assert.notEqual(new URL(base).port, '8080');
async function pedir(ruta, cuerpo) {
  const respuesta = await fetch(base + '/api/v1/' + ruta, { method: cuerpo ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  assert.equal(respuesta.status, cuerpo ? 201 : 200);
  return respuesta.json();
}
for (const recurso of ['elecciones', 'candidaturas', 'inscripciones']) assert.equal((await pedir(recurso)).total, 0, 'Exige bases nuevas y aisladas');
const elecciones = [];
for (let indice = 1; indice <= 12; indice++) elecciones.push(await pedir('elecciones', { nombre: `Prueba explícita frontend azul ${indice}`, estado: indice % 2 ? 'borrador' : 'programada' }));
await pedir('candidaturas', { idEleccion: elecciones[0].idEleccion, nombre: 'Prueba explícita candidatura azul', tipo: 'individual', estado: 'borrador' });
for (const elegible of [true, false]) await pedir('inscripciones', { idEleccion: elecciones[0].idEleccion, elegible });
await writeFile(process.env.EVIDENCIA_FRONTEND + '/datos-prueba.json', JSON.stringify({ eleccionAsociada: elecciones[0].idEleccion, elecciones: 12, candidaturas: 1, inscripciones: 2, alcance: 'Datos sintéticos identificados; bases aisladas nuevas' }, null, 2));
console.log('OK: doce elecciones, candidatura y dos inscripciones reales en bases nuevas');
