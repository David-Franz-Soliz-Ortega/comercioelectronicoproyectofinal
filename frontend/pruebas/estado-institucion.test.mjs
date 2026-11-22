import test from 'node:test';
import assert from 'node:assert/strict';
import {resumirInstitucion} from '../src/api/estadoInstitucion.js';

test('el estado institucional suma todos los cargos sin duplicar mesas físicas compartidas',()=>{
 const cargos=[{id:'r',cargo:'Rector',estado:'recepcion',candidatos:[{},{}],mesas:[{id:'mr',codigo:'1',idMesaFisica:'fisica'}]},{id:'v',cargo:'Vicerrector',estado:'recepcion',candidatos:[{}],mesas:[{id:'mv',codigo:'1',idMesaFisica:'fisica'}]},{id:'viejo',estado:'archivada',candidatos:[{}],mesas:[{id:'historial',codigo:'2'}]}];
 const r=resumirInstitucion(cargos,[{idMesa:'mr',idUsuario:'operador'},{idMesa:'mr',idUsuario:'segundo'},{idMesa:'mv',idUsuario:'operador'},{idMesa:'historial',idUsuario:'antiguo'}]);
 assert.equal(r.cargos.length,2);assert.equal(r.candidaturas,3);assert.equal(r.mesasFisicas,1);assert.equal(r.actasEsperadas,2);assert.equal(r.operadores,2);assert.equal(r.mesasSinOperador,0);assert.equal(r.estado,'En recepción');
 const parcial=resumirInstitucion([{...cargos[0],estado:'borrador'},cargos[1]],[{idMesa:'mr',idUsuario:'operador'}]);
 assert.equal(parcial.estado,'Estados mixtos');assert.equal(parcial.mesasSinOperador,1);
});
test('no presenta cero operadores mientras la consulta de asignaciones no esté disponible',()=>{
 const r=resumirInstitucion([]);assert.equal(r.operadores,null);assert.equal(r.mesasSinOperador,null);assert.equal(r.estado,'Sin cargos');
});
