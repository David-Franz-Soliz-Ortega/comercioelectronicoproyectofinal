import test from 'node:test';
import assert from 'node:assert/strict';
import { agruparMesasFisicas, listarMesasInstitucion, agruparMesasPorFacultad } from '../src/api/mesasCompartidas.js';
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

test('la lista institucional incluye mesas individuales y compartidas sin unir códigos iguales ni duplicar cargos', () => {
 const procesos = [
  {id:'r',cargo:'Rector',estado:'borrador',mesas:[{id:'mr',codigo:'Mesa 10',idMesaFisica:'fisica',sector:'estudiantes',recinto:'Recinto sintético'}, {id:'antigua',codigo:'Mesa 10',sector:'docentes'}]},
  {id:'v',cargo:'Vicerrector',estado:'recepcion',mesas:[{id:'mv',codigo:'Mesa 10',idMesaFisica:'fisica',sector:'estudiantes',recinto:'Recinto sintético'}]},
  {id:'d',cargo:'Director',estado:'borrador',mesas:[{id:'individual',codigo:'Mesa 2',sector:'general'}]},
  {id:'archivado',cargo:'Rector',estado:'archivada',mesas:[{id:'histórica',codigo:'Mesa 1'}]},
 ];
 const copia=structuredClone(procesos),mesas=listarMesasInstitucion(procesos);
 assert.equal(mesas.length,3);assert.equal(mesas[0].codigo,'Mesa 2');
 const compartida=mesas.find(m=>m.id==='fisica');assert.deepEqual(compartida.cargos.map(c=>c.idMesa),['mr','mv']);assert.equal(compartida.recinto,'Recinto sintético');
 assert.equal(mesas.find(m=>m.id==='antigua').sector,'docentes');assert.equal(compartida.cargos[1].estado,'recepcion');
 assert.deepEqual(procesos,copia);
});

test('la facultad cuenta cada mesa física una vez aunque tenga varios cargos y mantiene sectores separados', () => {
 const mesas=[{id:'est',idMesaFisica:'est',codigo:'01',unidad:'Tecnología · Grupo A',sector:'estudiantes'},{id:'doc',idMesaFisica:'doc',codigo:'02',unidad:'Tecnología · Grupo B',sector:'docentes'}];
 const procesos=[{id:'r',cargo:'Rector',estado:'borrador',mesas},{id:'v',cargo:'Vicerrector',estado:'borrador',mesas:mesas.map(m=>({...m,id:'vice-'+m.id}))},{id:'d',cargo:'Director',facultad:'Tecnología',estado:'borrador',mesas:mesas.map(m=>({...m,id:'dir-'+m.id}))},{id:'a',cargo:'Alcalde',estado:'borrador',mesas:[{id:'otra',codigo:'01',unidad:'Distrito sintético'}]}];
 procesos.push({id:'dec',cargo:'Decano',facultad:'TECNOLOGÍA',estado:'borrador',mesas:mesas.map(m=>({...m,id:'dec-'+m.id}))});
 const copia=structuredClone(procesos),lista=listarMesasInstitucion(procesos),grupos=agruparMesasPorFacultad(lista);
 assert.equal(lista.length,3);
 assert.equal(grupos.find(g=>g.nombre==='Tecnología').mesas.length,2);
 assert.deepEqual(grupos.find(g=>g.nombre==='Tecnología').mesas.map(m=>m.sector),['estudiantes','docentes']);
 assert.equal(grupos.find(g=>g.nombre==='Distrito sintético').mesas.length,1);
 assert.deepEqual(procesos,copia);
});
