import test from 'node:test';
import assert from 'node:assert/strict';
import {consultaResumenCargos,comprobarResumenCargos} from '../src/api/resumenCargos.js';

test('el resumen usa consultas por cargo limitadas a seis y mantiene votos independientes',()=>{
 const q=consultaResumenCargos(Array.from({length:34},(_,i)=>({id:'id'+i})));
 assert.equal(Object.keys(q.variables).length,6);assert.equal((q.query.match(/:portal\(/g)??[]).length,6);
 const cargo=(id,v)=>({proceso:{id},resultados:{total:v+2,validos:v,blancos:1,nulos:1,contabilizadas:1,esperadas:2,candidatos:[{id:id+'c',nombre:'Nombre',votos:v}]}});
 const r=comprobarResumenCargos({cargo0:cargo('rector',8),cargo1:cargo('vice',3)});
 assert.equal(r[0].resultados.candidatos[0].votos,8);assert.equal(r[1].resultados.candidatos[0].votos,3);
 const invalido=cargo('rector',8);invalido.resultados.candidatos[0].votos=10;
 assert.throws(()=>comprobarResumenCargos({cargo0:invalido}),/verificar/);
 assert.throws(()=>comprobarResumenCargos({cargo0:null}),/verificar/);
});
