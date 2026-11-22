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
