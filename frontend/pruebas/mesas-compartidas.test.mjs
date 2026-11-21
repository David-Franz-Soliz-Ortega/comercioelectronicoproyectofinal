import test from 'node:test';
import assert from 'node:assert/strict';
import { agruparMesasFisicas } from '../src/api/mesasCompartidas.js';
import { resumirInstitucion } from '../src/api/resumenInstitucion.js';

test('una mesa física agrupa actas de tres cargos sin mezclar docentes con estudiantes ni otras mesas', () => {
 const filas=[{id:'r',idMesaFisica:'fisica-a',codigo:'A',cargo:'Rector'},{id:'v',idMesaFisica:'fisica-a',codigo:'A',cargo:'Vicerrector'},{id:'d',idMesaFisica:'fisica-a',codigo:'A',cargo:'Director'},{id:'doc',idMesaFisica:'fisica-doc',codigo:'DOC'},{id:'antigua',codigo:'A'}];
 const copia=structuredClone(filas),g=agruparMesasFisicas(filas);
 assert.equal(g.length,3);assert.deepEqual(g[0].cargos.map(c=>c.id),['r','v','d']);assert.deepEqual(filas,copia);
});
test('el resumen distingue una mesa física de sus tres actas esperadas; no deduce vínculos por nombres', () => {
 const ps=['r','v','d'].map(id=>({id,nombre:'Prueba',estado:'borrador',candidatos:[],mesas:[{id,idMesaFisica:'fisica'}]}));
 const r=resumirInstitucion(ps,[],'org');assert.equal(r.mesas,1);assert.equal(r.actasEsperadas,3);
 delete ps[2].mesas[0].idMesaFisica;assert.equal(resumirInstitucion(ps,[],'org').mesas,2);
});
