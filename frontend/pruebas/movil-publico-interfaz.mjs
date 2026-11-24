// Navegador sobre la compilación local. Toda API se intercepta con datos sintéticos.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const carpeta=fileURLToPath(new URL('../dist',import.meta.url));
const servidor=http.createServer(async(req,res)=>{
 const ruta=resolve(carpeta,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));
 if(!ruta.startsWith(carpeta+'/')){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.ttf':'font/ttf'})[extname(ruta)]??'application/octet-stream');res.end(await readFile(ruta));}catch{res.writeHead(404).end();}
});
await new Promise(r=>servidor.listen(0,'127.0.0.1',r));
const origen='http://127.0.0.1:'+servidor.address().port;
const navegador=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EJECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});
const pagina=await navegador.newPage({viewport:{width:390,height:844},locale:'es-BO',reducedMotion:'reduce'});
pagina.setDefaultTimeout(10000);
const errores=[],consultas=[];
pagina.on('pageerror',e=>errores.push(e.message));
const cargos=['Rectorado','Vicerrectorado',...Array(5).fill('Decano')].map((cargo,i)=>({id:'11111111-1111-4111-8111-'+String(i).padStart(12,'0'),nombre:'Elección académica de demostración',cargo,ambito:i<2?'Toda la universidad':'Facultad de Ciencias y Tecnología de demostración '+i,estado:'recepcion',destacadoPortada:i===0}));
const eventos=[{id:'evento-sintetico',nombre:'Elecciones universitarias de demostración 2026',tipo:'universidad',destacado:true,procesos:cargos}];
const unidades=[{unidad:'Facultad de Ciencias y Tecnología de demostración',esperadas:2,contabilizadas:1,pendientes:1},{unidad:'Facultad de Ciencias de la Salud de demostración',esperadas:1,contabilizadas:1,pendientes:0}];
const candidatos=[{id:'a',nombre:'Candidatura de demostración Aurora del Valle',foto:'/foto-sintetica.svg',votos:120,porcentaje:60},{id:'b',nombre:'Candidatura de demostración Bernardo Montes',foto:null,votos:80,porcentaje:40}];
for(const p of cargos)p.candidatos=candidatos;
let modo='datos';
function portal(id,unidad){
 const us=unidades.filter(u=>!unidad||u.unidad===unidad),esperadas=us.reduce((n,u)=>n+u.esperadas,0),contabilizadas=modo==='cero'?0:us.reduce((n,u)=>n+u.contabilizadas,0);
 const cs=candidatos.map(c=>({...c,votos:modo==='cero'?0:c.votos,porcentaje:modo==='cero'?0:c.porcentaje}));
 const r={esperadas,contabilizadas,pendientes:esperadas-contabilizadas,observadas:0,requierenRevision:0,avance:Math.round(contabilizadas/esperadas*10000)/100,total:modo==='cero'?0:205,validos:modo==='cero'?0:200,blancos:modo==='cero'?0:3,nulos:modo==='cero'?0:2,actualizadoEn:modo==='cero'?null:'2026-11-24T12:00:00Z',candidatos:cs,unidades:us.map(u=>({...u,contabilizadas:modo==='cero'?0:u.contabilizadas,pendientes:modo==='cero'?u.esperadas:u.pendientes})),sectores:[]};
 const sectores=modo==='sectores'?[{codigo:'docentes',nombre:'Docentes de demostración'},{codigo:'estudiantes',nombre:'Estudiantes de demostración'}]:[];
 r.sectores=sectores.map((s,i)=>({...s,esperadas:i===0?2:1,contabilizadas:1,pendientes:i===0?1:0,validos:100,blancos:i===0?2:1,nulos:1,total:i===0?103:102,candidatos:cs.map(c=>({...c,votos:c.votos/2}))}));
 return {proceso:{...cargos.find(p=>p.id===id),tipo:'universidad',unidad:'Facultad',unidades:unidades.map(u=>u.unidad),candidatos:cs,sectores},resultados:r};
}
await pagina.route('**/graphql',ruta=>{
 const d=ruta.request().postDataJSON();consultas.push(d);
 if(modo==='error')return ruta.fulfill({status:503,body:'Fallo de prueba'});
 if(d.query.includes('query Eventos'))return ruta.fulfill({json:{data:{eventos:modo==='vacio'?[]:eventos}}});
 if(d.query.includes('query ResumenCargos'))return ruta.fulfill({json:{data:Object.fromEntries(Object.entries(d.variables).map(([k,id])=>['cargo'+k.slice(2),portal(id)]))}});
 return ruta.fulfill({json:{data:{portal:portal(d.variables.idProceso,d.variables.unidad)}}});
});
await pagina.route('**/api/**',ruta=>ruta.fulfill({status:401,json:{detalle:'Sin sesión sintética'}}));
await pagina.route('**/foto-sintetica.svg',ruta=>ruta.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140"><rect width="100" height="140" fill="#d6e5ff"/><circle cx="50" cy="45" r="22" fill="#7d96bd"/><path d="M10 140V110a40 40 0 0 1 80 0v30" fill="#7d96bd"/></svg>'}));
async function sinDesbordes(){
 assert.ok(await pagina.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Página sin desbordamiento');
}
try{
 await pagina.goto(origen);await pagina.getByRole('region',{name:'Votos por candidatura'}).waitFor();
 for(const ancho of [320,360,390,430,768,1440,2560]){
  await pagina.setViewportSize({width:ancho,height:1000});await sinDesbordes();
  if(ancho<=600){
   assert.ok(await pagina.locator('.tabla-unidades-scroll').evaluate(n=>n.scrollWidth<=n.clientWidth+1),'Unidades legibles sin arrastre lateral');
   assert.ok(await pagina.locator('.identidad-candidatura').first().evaluate(n=>n.getBoundingClientRect().width>=140),'Nombres de candidatura con ancho legible');
   const boton=await pagina.getByRole('button',{name:/Ver votos de Facultad/}).first().boundingBox();assert.ok(boton.height>=44);
  }
  assert.ok(await pagina.locator('.saltar-contenido').evaluate(n=>n.getBoundingClientRect().bottom<=0),'El acceso de teclado no tapa el contenido sin foco');
  if([390,1440].includes(ancho)){await pagina.evaluate(()=>scrollTo(0,0));await pagina.screenshot({path:'/tmp/tuvoto-publico-movil-'+ancho+'.png',fullPage:true,animations:'disabled'});}
  await pagina.getByRole('button',{name:/^Decano \(5\)/}).click();await pagina.getByRole('region',{name:'Cargos de Decano'}).waitFor();await sinDesbordes();
  assert.ok(await pagina.locator('.rejilla-facultades-cargos').evaluate(n=>n.scrollWidth<=n.clientWidth+1),'Grupo abierto sin desbordamiento');
  assert.ok(await pagina.locator('.nombre-facultad-item').first().evaluate(n=>n.getBoundingClientRect().width>150),'Facultades legibles');
  await pagina.getByRole('button',{name:'Cerrar opciones',exact:true}).click();
 }
 await pagina.setViewportSize({width:390,height:844});
 await pagina.getByRole('button',{name:'Ver todos los cargos',exact:true}).click();
 await pagina.locator('.rejilla-resumen-resultados article').first().waitFor();await sinDesbordes();
 await pagina.getByRole('button',{name:/Volver al cómputo individual/}).click();
 await pagina.getByRole('button',{name:'Ver votos de '+unidades[0].unidad,exact:true}).click();
 await pagina.waitForFunction(()=>document.querySelector('[aria-label="Filtrar por facultad"]')?.value.includes('Tecnología'));
 assert.equal(consultas.at(-1).variables.unidad,unidades[0].unidad);await sinDesbordes();
 modo='cero';await pagina.reload();await pagina.getByText('Esperando la primera acta',{exact:true}).waitFor();
 assert.equal(await pagina.getByText('Lidera el conteo',{exact:true}).count(),0);
 modo='vacio';await pagina.reload();await pagina.getByRole('heading',{name:'Todavía no hay un evento publicado'}).waitFor();await sinDesbordes();
 modo='error';await pagina.reload();await pagina.getByRole('heading',{name:'No se pudieron cargar los resultados'}).waitFor();await sinDesbordes();
 modo='datos';await pagina.getByRole('button',{name:'Reintentar conexión'}).click();await pagina.getByRole('region',{name:'Votos por candidatura'}).waitFor();
 modo='sectores';await pagina.reload();await pagina.getByRole('heading',{name:'Resultados por sector'}).waitFor();
 for(const ancho of [320,390,768,1440,2560]){
  await pagina.setViewportSize({width:ancho,height:1000});await sinDesbordes();
  if(ancho<=600)assert.ok(await pagina.locator('.resultados-sectores tbody td').first().evaluate(n=>n.getBoundingClientRect().width>=180),'Nombres por sector legibles');
  if([390,1440].includes(ancho))await pagina.locator('.resultados-sectores').screenshot({path:'/tmp/tuvoto-publico-sectores-'+ancho+'.png',animations:'disabled'});
 }
 await pagina.setViewportSize({width:390,height:844});
 await pagina.getByRole('link',{name:'Acceso al personal',exact:true}).click();await pagina.getByLabel('Usuario',{exact:true}).waitFor();await sinDesbordes();
 assert.deepEqual(errores,[]);
 console.log('OK: página pública en siete anchos, nombres largos, grupos desplegados, unidades y sectores legibles, resultados agrupados, filtros, cero datos, errores y acceso. APIs sintéticas.');
}catch(e){await pagina.screenshot({path:'/tmp/tuvoto-publico-movil-fallo.png',fullPage:true,animations:'disabled'});throw e;}
finally{await navegador.close();servidor.closeAllConnections();await new Promise(r=>servidor.close(r));}
