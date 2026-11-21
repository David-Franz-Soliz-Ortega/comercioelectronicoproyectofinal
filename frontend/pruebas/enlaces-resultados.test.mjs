import test from 'node:test';
import assert from 'node:assert/strict';
import {enlaceResultados,procesoDesdeEnlace} from '../src/api/enlacesResultados.js';
const id='11111111-1111-4111-8111-111111111111';
test('enlace al cargo publicado exacto; cerrar no equivale a ocultar',()=>{const p={id,publicado:true,estado:'cerrada'};assert.equal(procesoDesdeEnlace(enlaceResultados(p)),id);assert.equal(enlaceResultados({...p,estado:'archivada'}),null);assert.equal(enlaceResultados({id,estado:'borrador'}),null);});
test('los enlaces no aceptan rutas ni interpretan otras secciones como cargos',()=>{assert.equal(procesoDesdeEnlace('#panel'),'');assert.equal(procesoDesdeEnlace('#resultados?proceso=../privado'),'');assert.equal(enlaceResultados({id:'../privado',publicado:true}),null);});
