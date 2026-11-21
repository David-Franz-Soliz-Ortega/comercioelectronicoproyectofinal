import test from 'node:test';
import assert from 'node:assert/strict';
import {cargosParaReferencia,mensajeImportacion,motivoBloqueoImportacion,presentacionImportacion} from '../src/api/importacionGeneral.js';
test('opciones para revisar Excel: conserva ámbito visible, limita cargo y vuelta y excluye recepción/cierre',()=>{
 const cargos=[{id:'a',cargo:'Decano',ambito:'Tecnología',estado:'borrador',vuelta:1},{id:'b',cargo:'Decano',ambito:'Medicina',estado:'borrador',vuelta:1},{id:'c',cargo:'Decano',estado:'recepcion',vuelta:1},{id:'d',cargo:'Decano',estado:'borrador',vuelta:2},{id:'e',cargo:'Rector',estado:'borrador',vuelta:1}];
 assert.deepEqual(cargosParaReferencia(cargos,{cargo:' decano ',vuelta:1}).map(p=>p.id),['a','b']);
 assert.deepEqual(cargosParaReferencia(cargos,{cargo:'Rector',vuelta:2}),[]);
 assert.equal(cargos[0].ambito,'Tecnología');
});

test('las plantillas conjunta e individual tienen nombres distintos y explican dónde importar',()=>{
 const individual=presentacionImportacion({titulo:'candidatos',ruta:'/configuracion/procesos/proceso-sintetico/importaciones/candidatos'});
 const general=presentacionImportacion({titulo:'candidatos',ruta:'/configuracion/importaciones-generales/candidatos',general:true});
 assert.match(individual.encabezado,/solo para este cargo/);assert.match(general.encabezado,/de todos los cargos/);
 assert.notEqual(individual.nombreArchivo,general.nombreArchivo);assert.equal(general.nombreArchivo,'candidatos-todos-los-cargos.xlsx');
 assert.equal(presentacionImportacion({titulo:'cargos',ruta:'/configuracion/importaciones/cargos'}).nombreArchivo,'cargos.xlsx');
});

test('confirmación: explica los errores aunque la tabla contenga filas válidas; solo habilita un archivo revisado sin errores',()=>{
 const vista={total:34,filas:Array(14).fill({cargo:'Decano'}),errores:Array(20).fill({fila:16,mensaje:'Indica la facultad del cargo'})};
 assert.match(motivoBloqueoImportacion({vista}),/20 errores pendientes/);
 assert.match(motivoBloqueoImportacion({vista}),/tabla muestra las filas válidas/);
 assert.match(motivoBloqueoImportacion({vista:{errores:[]},revisar:true}),/Cambiaste una decisión/);
 assert.match(motivoBloqueoImportacion({vista,ocupado:true}),/Espera/);
 assert.match(motivoBloqueoImportacion({vista:null}),/Primero selecciona/);
 assert.equal(motivoBloqueoImportacion({vista:{errores:[]}}),null);
});

test('el resultado de cargos distingue mantener de crear o reemplazar sin anunciar inserciones falsas',()=>{
 assert.equal(mensajeImportacion({importados:0,creados:0,actualizados:0,mantenidos:5}),'0 cargos creados · 0 actualizados · 5 mantenidos sin cambios.');
 assert.equal(mensajeImportacion({importados:3}),'3 registros importados correctamente.');
});
