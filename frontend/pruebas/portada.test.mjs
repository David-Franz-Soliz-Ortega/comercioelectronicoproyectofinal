import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { comprobarEventos } from '../src/api/datosPortal.js';

test('portada muestra los cargos guardados y sus candidatos; no depende del cargo que se esté editando', async()=>{
 const vite=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,ws:false,hmr:false,watch:null},appType:'custom'});
 try{
  const {default:Administracion}=await vite.ssrLoadModule('/src/componentes/PortadaAdministracion.jsx');
  const {default:Publico}=await vite.ssrLoadModule('/src/componentes/CargosDestacados.jsx');
  const procesos=[
   {id:'rector',cargo:'Rector',nombre:'Proceso sintético',estado:'recepcion',publicado:true,destacadoPortada:true,candidatos:[{id:'r',nombre:'Postulante rector sintético',foto:'/foto-prueba.png'}]},
   {id:'vice',cargo:'Vicerrector',nombre:'Proceso sintético',estado:'recepcion',publicado:true,destacadoPortada:true,candidatos:[{id:'v',nombre:'Postulante vice sintético',foto:null}]},
   {id:'decano',cargo:'Decano',nombre:'Proceso sintético',estado:'borrador',destacadoPortada:false,candidatos:[{id:'d',nombre:'Postulante privado sintético'}]},
  ];
  const admin=renderToStaticMarkup(React.createElement(Administracion,{procesos,organizacion:'org'}));
  assert.ok(!admin.includes('type="checkbox"'),'El selector permanece oculto hasta pulsar Agregar destacados');
  assert.equal((admin.match(/class="panel-admin vista-previa-destacados"/g)??[]).length,1);
  assert.equal((admin.match(/grupo-vista-previa/g)??[]).length,2);
  assert.equal((admin.match(/Quitar de destacados<\/button>/g)??[]).length,2);
  assert.ok(admin.indexOf('Postulante vice sintético') < admin.indexOf('+ Agregar destacados'),'El botón está debajo de la vista previa');
  assert.ok(admin.includes('Postulante rector sintético')&&admin.includes('Postulante vice sintético'));
  assert.ok(!admin.includes('Postulante privado sintético'),'La vista previa no cambia al cargo no destacado');
  assert.ok(!admin.includes('Iniciar conteo'),'La portada no abre recepción');
  const publico=renderToStaticMarkup(React.createElement(Publico,{cargos:procesos}));
  assert.ok(publico.includes('Postulante rector sintético')&&publico.includes('Postulante vice sintético'));
  assert.ok(publico.includes('/foto-prueba.png')&&publico.includes('Sin fotografía de Postulante vice sintético'));
  assert.ok(!publico.includes('Postulante privado sintético'));
  const recargado=renderToStaticMarkup(React.createElement(Administracion,{procesos:structuredClone(procesos),organizacion:'org'}));
  assert.equal(admin,recargado,'La selección se reconstruye con la respuesta persistida');
  assert.equal(renderToStaticMarkup(React.createElement(Publico,{cargos:procesos.map(p=>({...p,destacadoPortada:false}))})), '');
 }finally{await vite.close();}
});

test('el catálogo público rechaza destacados incompletos o repetidos en lugar de inventar candidatos',()=>{
 const evento={id:'e',nombre:'Prueba',destacado:false,procesos:[{id:'p',nombre:'Prueba',cargo:'Alcalde',destacadoPortada:true,candidatos:[{id:'c',nombre:'Persona sintética',foto:null}]}]};
 assert.deepEqual(comprobarEventos([evento]),[evento]);
 assert.throws(()=>comprobarEventos([{...evento,procesos:[{...evento.procesos[0],candidatos:null}]}]));
 assert.throws(()=>comprobarEventos([{...evento,procesos:[{...evento.procesos[0],candidatos:[evento.procesos[0].candidatos[0],evento.procesos[0].candidatos[0]]}]}]));
});
