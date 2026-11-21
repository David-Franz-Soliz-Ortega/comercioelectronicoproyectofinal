import test from 'node:test';
import assert from 'node:assert/strict';
import {resumirInstitucion} from '../src/api/resumenInstitucion.js';
test('el resumen suma todos los cargos de la institución, separando los archivados',()=>{
 const p=[{nombre:'Evento A',estado:'recepcion',candidatos:[{},{}],mesas:[{},{}]},{nombre:'Evento A',estado:'borrador',candidatos:[{}],mesas:[{}]},{nombre:'Evento B',estado:'cerrada',candidatos:[{},{}],mesas:[]},{nombre:'Histórico',estado:'archivada',candidatos:[{}],mesas:[{}]}];
 const c=[{idUsuario:'uno',activo:true,roles:[{rol:'OPERADOR',idOrganizacion:'org'}]},{idUsuario:'uno',activo:true,roles:[{rol:'OPERADOR',idOrganizacion:'org'}]},{idUsuario:'otro',activo:true,roles:[{rol:'OPERADOR',idOrganizacion:'ajena'}]},{idUsuario:'admin',activo:true,roles:[{rol:'OPERADOR',idOrganizacion:'org'},{rol:'ADMINISTRADOR',idOrganizacion:null}]},{idUsuario:'inactivo',activo:false,roles:[{rol:'OPERADOR',idOrganizacion:'org'}]}];
 assert.deepEqual(resumirInstitucion(p,c,'org'),{eventos:2,cargos:3,candidatos:5,mesas:3,actasEsperadas:3,operadores:1,archivados:1});assert.equal(p[3].estado,'archivada');
});
test('una institución consultada sin registros tiene totales cero',()=>{assert.deepEqual(resumirInstitucion([],[],'org'),{eventos:0,cargos:0,candidatos:0,mesas:0,actasEsperadas:0,operadores:0,archivados:0});});
