import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const {resolverDestinos,columnasGenerales}=await import(pathToFileURL(resolve(process.env.TUVOTO_COMPILACION_ELECCIONES,'importaciones-generales.js')));
const proceso=(id,ambito,otros={})=>({id,cargo:'Decano',estado:'borrador',configuracion:{ambito,vuelta:1},...otros});
const fila=(fila,ambito,otros={})=>({fila,datos:{cargo:'Decano',ambito,vuelta:'1',nombre:'Candidatura sintética '+fila,...otros}});
test('Excel general: separa cada ámbito y no infiere un cargo si falta o es ambiguo',()=>{
 const procesos=[proceso('a','Tecnología'),proceso('b','Medicina')];
 let r=resolverDestinos([fila(2,' tecnología '),fila(3,'Medicina')],procesos);
 assert.deepEqual([...r.grupos.keys()],['a','b']);assert.deepEqual(r.errores,[]);
 r=resolverDestinos([fila(2,'Otra')],procesos);assert.equal(r.errores.length,1);assert.equal(r.grupos.size,0);
 r=resolverDestinos([fila(2,'Medicina')],[...procesos,proceso('c','Medicina')]);assert.equal(r.errores.length,1);assert.equal(r.referencias[0].idProceso,null);
});
test('asociaciones explícitas solo a cargos propios de la misma clase y vuelta; respeta bloqueo',()=>{
 const filas=[fila(2,'Etiqueta del archivo')],procesos=[proceso('a','Tecnología'),proceso('vice','', {cargo:'Vicerrector'}),proceso('dos','',{configuracion:{vuelta:2}})];
 const referencia=resolverDestinos(filas,procesos).referencias[0].referencia;
 assert.equal(resolverDestinos(filas,procesos,{[referencia]:'a'}).grupos.size,1);
 for(const id of ['ajeno','vice','dos'])assert.equal(resolverDestinos(filas,procesos,{[referencia]:id}).grupos.size,0);
 assert.equal(resolverDestinos(filas,[proceso('a','Tecnología',{estado:'recepcion'})],{[referencia]:'a'}).grupos.size,0);
});
test('agrupa referencias distintas dirigidas al mismo ID para detectar duplicados en todo el lote',()=>{
 const filas=[fila(2,'A'),fila(3,'B')],procesos=[proceso('a','Tecnología')];
 const referencias=resolverDestinos(filas,procesos).referencias;
 const r=resolverDestinos(filas,procesos,Object.fromEntries(referencias.map(r=>[r.referencia,'a'])));
 assert.equal(r.grupos.size,1);assert.equal(r.grupos.get('a').length,2);
 assert.deepEqual(columnasGenerales('candidatos'),['cargo','ambito','vuelta','nombre','orden']);
 assert.equal(resolverDestinos([fila(2,'A',{vuelta:'3'})],procesos).errores.length,1);
});
