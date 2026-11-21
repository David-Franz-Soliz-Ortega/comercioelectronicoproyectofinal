import test from 'node:test';
import assert from 'node:assert/strict';
import { ordenarCandidaturas,puntuacionCandidatura } from '../src/api/presentacionResultados.js';
test('la portada ordena por ponderación solo cuando está activada, sin cambiar votos',()=>{
 const candidatos=[{id:'a',nombre:'A',votos:600,porcentaje:60,porcentajePonderado:30},{id:'b',nombre:'B',votos:400,porcentaje:40,porcentajePonderado:70}];
 assert.equal(ordenarCandidaturas({candidatos,ponderacionAplicada:false})[0].id,'a');
 assert.equal(ordenarCandidaturas({candidatos,ponderacionAplicada:true})[0].id,'b');
 assert.equal(candidatos[0].votos,600);
 assert.equal(puntuacionCandidatura({...candidatos[0],porcentajePonderado:null},{ponderacionAplicada:true}),null);
});
