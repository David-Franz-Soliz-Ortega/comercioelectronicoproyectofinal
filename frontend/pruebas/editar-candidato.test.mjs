import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('Editar se ofrece en candidatos de borradores; cargos iniciados solo permiten consulta', async()=>{
 const vite=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,ws:false,hmr:false,watch:null},appType:'custom'});
 try{
  const {default:Listado}=await vite.ssrLoadModule('/src/componentes/CandidatosAdministracion.jsx');
  const base={nombre:'Elección sintética',cargo:'Rector',candidatos:[{id:'c',nombre:'Persona sintética'}],mesas:[]};
  const propiedades={organizacion:'org',disponible:true,alActualizar:()=>{}};
  for(const estado of ['borrador','recepcion','cerrada','archivada']){
   const html=renderToStaticMarkup(React.createElement(Listado,{...propiedades,procesos:[{...base,id:estado,estado}]}));
   assert.equal(html.includes('>Editar</button>'),estado==='borrador');
   assert.ok(html.includes('Persona sintética'));
  }
  for(const marca of ['actual','publicado']) {
   const html=renderToStaticMarkup(React.createElement(Listado,{...propiedades,procesos:[{...base,id:marca,estado:'borrador',[marca]:true}]}));
   assert.ok(!html.includes('>Editar</button>'));
  }
 } finally {await vite.close();}
});

const {guardarEdicionCandidato}=await import('../src/api/editarCandidato.js');
test('edición conjunta reutiliza las APIs reales y reintenta solo la foto tras un fallo parcial',async()=>{
 const llamadas=[];let confirmado='Anterior',fallar=true;
 const pedir=async(r,op)=>{llamadas.push({r,op});if(r.endsWith('/foto')&&fallar){fallar=false;throw Error('Fallo sintético');}};
 const datos={id:'c',organizacion:'org',nombreActual:confirmado,nombre:' Nuevo ',foto:'data:image/png;base64,SINTETICO',pedir,alNombreGuardado:n=>{confirmado=n;}};
 await assert.rejects(guardarEdicionCandidato(datos),/Fallo sintético/);assert.equal(confirmado,'Nuevo');
 await guardarEdicionCandidato({...datos,nombreActual:confirmado});
 assert.deepEqual(llamadas.map(l=>l.r),['/configuracion/candidatos/c','/configuracion/candidatos/c/foto','/configuracion/candidatos/c/foto']);
 assert.ok(llamadas.every(l=>l.op.organizacion==='org'));assert.deepEqual(llamadas[0].op.datos,{nombre:'Nuevo'});
});
test('un rechazo del nombre impide enviar la fotografía y conserva el avance sin confirmar',async()=>{
 let llamadas=0,confirmado=false;
 await assert.rejects(guardarEdicionCandidato({id:'c',organizacion:'org',nombreActual:'A',nombre:'B',foto:'foto',pedir:async()=>{llamadas++;throw Error('Sin permiso');},alNombreGuardado:()=>{confirmado=true;}}),/Sin permiso/);
 assert.equal(llamadas,1);assert.equal(confirmado,false);
});
