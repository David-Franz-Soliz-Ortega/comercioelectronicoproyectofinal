import test from 'node:test';
import assert from 'node:assert/strict';
import { pasosDeEleccion } from '../src/api/pasosEleccion.js';
test('borrador nuevo no inventa progreso ni inicia el conteo',()=>{
 const pasos=pasosDeEleccion({});assert.deepEqual(pasos.map(p=>p.destino),['configuracion','candidatos','mesas','usuarios','asignaciones','publicacion']);assert.ok(pasos.every(p=>!p.listo));
});
test('al retomar reconstruye progreso con todas las asignaciones persistidas',()=>{
 const proceso={estado:'borrador',candidatos:[{id:'c1'}],mesas:[{id:'m1'},{id:'m2'}]};
 const argumentos={proceso,operadores:[{idUsuario:'op'}],asignaciones:[{idMesa:'m1'}]};
 assert.equal(pasosDeEleccion(argumentos)[4].listo,false);
 argumentos.asignaciones.push({idMesa:'m2'});
 assert.deepEqual(pasosDeEleccion(argumentos).map(p=>p.listo),[true,true,true,true,true,false]);
 assert.equal(proceso.estado,'borrador');
});
test('ninguna asignación ajena o duplicada completa mesas pendientes',()=>{
 const pasos=pasosDeEleccion({proceso:{mesas:[{id:'m1'},{id:'m2'}]},asignaciones:[{idMesa:'m1'},{idMesa:'m1'},{idMesa:'ajena'}]});assert.equal(pasos[4].listo,false);
});
