import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
async function componente(nombre){
 const r=await build({entryPoints:[fileURLToPath(new URL('../src/componentes/'+nombre+'.jsx',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'react-compartido',setup(b){b.onResolve({filter:/^react$/},()=>({path:pathToFileURL(require.resolve('react')).href,external:true}));}}]});
 return (await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'))).default;
}
const Conteo=await componente('ConteoInstitucion'),Destacados=await componente('CargosDestacados');
const proceso=estado=>({id:'prueba',cargo:'Rector',nombre:'Demostración sintética',estado,candidatos:[],mesas:[]});
const vista=estado=>renderToStaticMarkup(React.createElement(Conteo,{organizacion:'prueba',nombre:'Prueba',procesos:[proceso(estado)]}));
test('antes de iniciar no aparece Terminar; después del cierre ofrece otro conteo sin vaciar históricos',()=>{
 assert.ok(!vista('borrador').includes('Terminar conteo'));
 assert.ok(vista('recepcion').includes('Terminar conteo'));
 const cerrada=vista('cerrada');
 assert.ok(!cerrada.includes('Terminar conteo'));assert.ok(cerrada.includes('Preparar nuevo conteo de la institución'));
 assert.match(cerrada,/class="boton primario boton-iniciar-conteo-publicacion" disabled/);
});
test('la portada pública muestra únicamente cargos seleccionados como destacados',()=>{
 const cargos=[{...proceso('recepcion'),destacadoPortada:true},{...proceso('recepcion'),id:'no-elegido',cargo:'Director',destacadoPortada:false}];
 const html=renderToStaticMarkup(React.createElement(Destacados,{cargos}));
 assert.ok(html.includes('data-cargo-destacado="prueba"'));assert.ok(!html.includes('data-cargo-destacado="no-elegido"'));
 assert.equal(renderToStaticMarkup(React.createElement(Destacados,{cargos:[]})),'');
});
