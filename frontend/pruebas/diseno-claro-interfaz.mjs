// Interfaz sintética: archivos compilados y catálogo vacío, sin contactar microservicios.
import http from 'node:http';
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readdir } from 'node:fs/promises';
const frontend=fileURLToPath(new URL('..',import.meta.url));
const carpeta=resolve(frontend,'dist');
await build({entryPoints:[resolve(frontend,'pruebas/fixtures/diseno-claro.jsx')],bundle:true,outfile:'/tmp/tuvoto-diseno-claro-fixture.js',define:{'process.env.NODE_ENV':'"production"'}});
const css=(await readdir(resolve(carpeta,'assets'))).filter(s=>s.endsWith('.css')).map(s=>'<link rel="stylesheet" href="/assets/'+s+'">').join('');
await writeFile('/tmp/tuvoto-diseno-claro-fixture.html','<!doctype html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+css+'<div id="root"></div><script src="/diseno-claro-fixture.js"></script>');
const servidor=http.createServer(async(req,res)=>{
 if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(await readFile('/tmp/tuvoto-diseno-claro-fixture.html'));return;}
 if(req.url==='/diseno-claro-fixture.js'){res.setHeader('Content-Type','application/javascript');res.end(await readFile('/tmp/tuvoto-diseno-claro-fixture.js'));return;}
 if(req.url==='/graphql'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:{eventos:[]}}));return;}
 const ruta=resolve(carpeta,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));
 if(!ruta.startsWith(carpeta+'/')){res.writeHead(403).end();return;}
 try{const archivo=await readFile(ruta);res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png'})[extname(ruta)]??'application/octet-stream');res.end(archivo);}catch{res.writeHead(404).end();}
});
await new Promise(r=>servidor.listen(0,'127.0.0.1',r));
const origen='http://127.0.0.1:'+servidor.address().port;
const navegador=await chromium.launch({headless:true,...(process.env.CHROMIUM_EJECUTABLE?{executablePath:process.env.CHROMIUM_EJECUTABLE}:{}),args:['--no-sandbox']});
const pagina=await navegador.newPage({viewport:{width:1440,height:1100}});
const erroresJavascript=[];
pagina.on('pageerror',e=>erroresJavascript.push(e.message));
const evaluar=expression=>pagina.evaluate(expression);
const hasta=expresion=>pagina.waitForFunction(expresion, null, {timeout:15000});
try {
 await pagina.goto(origen);
 const pulsar=async(texto)=>{
  const selector=`Array.from((document.querySelector('dialog[open]')??document).querySelectorAll('button')).find(b=>!b.disabled&&((b.querySelector('strong')?.textContent.trim()??b.textContent.trim())===${JSON.stringify(texto)} || (${JSON.stringify(texto)}==='Cerrar'&& (/^Cerrar/.test(b.getAttribute('aria-label')??'') || b.textContent.trim()==='Cancelar'))))`;
  await hasta(selector);await evaluar(selector+'.click();true');
 };
 const llenar=async(selector,valor)=>evaluar(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(valor)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));return true;})()`);
 if(process.argv.includes('--pendientes-inicio')){
  await hasta("!!document.querySelector('.item-menu-lateral')&&!document.querySelector('.item-menu-lateral').disabled");
  await pulsar('Conteo y publicación');
  await hasta("document.querySelectorAll('[data-pendiente-inicio]').length>0");
  const pendientes=await evaluar("document.querySelectorAll('[data-pendiente-inicio]').length");
  assert.equal(await evaluar("document.querySelector('.boton-iniciar-conteo-publicacion').disabled"),true,'No inicia con asignaciones incompletas');
  assert.equal(await evaluar("document.querySelector('[data-pendiente-inicio] button').disabled"),true,'Seleccionar operador es obligatorio');
  const id=await evaluar("document.querySelector('[data-pendiente-inicio]').dataset.pendienteInicio");
  const selector='[data-pendiente-inicio="'+id+'"] select';
  await llenar(selector,'operador-1');
  await evaluar("window.fallarAsignacion=true;true");
  await evaluar("document.querySelector('[data-pendiente-inicio] button').click();true");
  await hasta("!!document.querySelector('.seccion-estado-publicacion>[role=alert]')");
  assert.equal(await evaluar("document.querySelectorAll('[data-pendiente-inicio]').length"),pendientes,'El fallo no simula una asignación');
  await evaluar("document.querySelector('[data-pendiente-inicio] button').click();true");
  await hasta("!!document.querySelector('.modal-confirmacion-global[open]')");
  await pulsar('Entendido');
  await hasta("document.querySelectorAll('[data-pendiente-inicio]').length==="+(pendientes-1));
  assert.equal(await evaluar('!!document.querySelector('+JSON.stringify('[data-pendiente-inicio="'+id+'"]')+')'),false);
  await pulsar('Ver mesas pendientes ↓');
  for(const ancho of [390,768,1440]){
   await pagina.setViewportSize({width:ancho,height:1100});
   assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Pendientes adaptables sin desbordamiento global');
  }
  assert.equal(await evaluar("window.solicitudes.filter(s=>s.metodo==='POST'&&s.ruta.includes('/institucion/')).length"),0,'No inicia ni termina un conteo');
  await pulsar('Ir a Operadores →');
  await hasta("!!document.querySelector('.directorio-operadores-recepcion')");
  console.log('OK: pendientes exactos, selección obligatoria, fallo/reintento, recarga tras asignación sintética, enlace a operadores y tres tamaños; sin escrituras reales.');
 }else{
 await hasta("!!document.querySelector('.indicadores-institucion')&&!document.querySelector('.item-menu-lateral').disabled");
 await pulsar('Elección');
 await hasta("document.querySelectorAll('[data-cargo]').length===34");
 assert.equal(await evaluar("document.querySelectorAll('.metricas-familias-cargos article').length"),4);
 assert.equal(await evaluar("getComputedStyle(document.querySelector('.barra-lateral-privada')).backgroundColor"),'rgb(255, 255, 255)');
 for(const ancho of [390,768,1440]){
  await pagina.setViewportSize({width:ancho,height:1100});
  assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Sin desbordamiento global');
  const captura={data:await pagina.screenshot({animations:'disabled'}).then(b=>b.toString('base64'))};await writeFile('/tmp/tuvoto-diseno-claro-'+ancho+'.png',Buffer.from(captura.data,'base64'));
 }
 await pulsar('Ver los 12 cargos →');
 await hasta("document.querySelectorAll('[data-grupo-cargos=decanos] tbody tr:not([hidden])').length===12");
 await pulsar('Mostrar menos');
 await hasta("document.querySelectorAll('[data-grupo-cargos=decanos] tbody tr:not([hidden])').length===3");
 await llenar('[aria-label="Buscar cargo o facultad"]','demostracion 10');
 await hasta("document.querySelectorAll('[data-cargo]').length===1");
 await llenar('[aria-label="Buscar cargo o facultad"]','');
 await evaluar("Array.from(document.querySelectorAll('.pestanas-familias-cargos button')).find(b=>b.textContent.includes('Directores')).click();true");
 await hasta("document.querySelectorAll('[data-cargo]').length===20");
 await evaluar("document.querySelector('.pestanas-familias-cargos button').click();true");
 await evaluar("document.querySelector('.mostrar-archivados-cargos input').click();true");
 await hasta("document.querySelectorAll('[data-cargo]').length===35");
 await llenar('[aria-label="Estado de los cargos"]','archivada');
 await hasta("document.querySelectorAll('[data-cargo]').length===1");
 await llenar('[aria-label="Estado de los cargos"]','');
 await evaluar("document.querySelector('[data-cargo=cargo0]').click();true");
 await hasta("!!document.querySelector('dialog[open]')");
 assert.equal(await evaluar("document.querySelector('dialog[open]').textContent.includes('Rector')"),true);
 await pulsar('Editar cargo');
 await hasta("!!document.querySelector('dialog[open] form')");
 await pulsar('Cancelar');await hasta("!document.querySelector('dialog[open]')");
 await pulsar('Importar Excel');await hasta("!!document.querySelector('[data-importacion=cargos] dialog[open] input[type=file]')");
 await pulsar('Cerrar');
 await pulsar('＋ Crear cargo');
 await hasta("!!document.querySelector('dialog[open] .opciones-eleccion')");
 assert.equal(await evaluar("!!document.querySelector('.catalogo-claro')"),true,'Catálogo conservado tras abrir alta de cargo');
 await pulsar('Cancelar');
 await pulsar('Equipo');await pulsar('Administradores');
 await pulsar('+ Crear administrador');
 await hasta("!!document.querySelector('dialog[open] #titulo-administracion')");
 await pulsar('Cerrar');
 await pulsar('Elección');await pulsar('Mesas de la elección');
 await hasta("document.querySelectorAll('[data-facultad-mesas]').length===33");
 assert.equal(await evaluar("document.querySelector('.cantidad-total-mesas').textContent"),'34 mesas','Cuenta mesas físicas sin archivadas');
 assert.equal(await evaluar("document.querySelectorAll('[data-mesa-listado]').length"),2,'Solo mesas de la unidad activa');
 assert.equal(await evaluar("!!document.querySelector('.cabecera-mesas-clara .crear-mesa-compartida')&&!!document.querySelector('.cabecera-mesas-clara [data-abrir-importacion]')"),true,'Acciones juntas en cabecera');
 await llenar('[aria-label="Buscar mesa"]','M12');
 await hasta("document.querySelectorAll('[data-mesa-listado]').length===1");
 await llenar('[aria-label="Buscar mesa"]','inexistente-sintetica');
 await hasta("document.querySelector('.listado-mesas-admin').textContent.includes('No hay mesas que coincidan')");
 await llenar('[aria-label="Buscar mesa"]','');
 await llenar('[aria-label="Buscar facultad o unidad"]','Facultad de demostración 12');
 await hasta("document.querySelectorAll('[data-facultad-mesas]').length===1&&document.querySelectorAll('[data-mesa-listado]').length===1");
 await llenar('[aria-label="Buscar facultad o unidad"]','');
 await llenar('[aria-label="Sector de las mesas"]','general');
 await evaluar("document.querySelectorAll('[data-facultad-mesas]')[2].click();true");
 await hasta("document.querySelectorAll('[data-mesa-listado]').length===1");
 await evaluar("document.querySelector('.acciones-fila-mesa>button').click();true");
 await hasta("!!document.querySelector('#detalle-cargos-mesa [data-mesa-cargo]')");
 assert.equal(await evaluar("document.querySelector('#detalle-cargos-mesa').textContent.includes('Decano')"),true);
 for(const ancho of [390,768,1440,2560]){
  await pagina.setViewportSize({width:ancho,height:1100});
  assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Mesas sin desbordamiento global');
  assert.equal(await evaluar("getComputedStyle(document.querySelector('.distribucion-mesas-recepcion')).gridTemplateColumns.split(' ').length"),ancho>1100?2:1,'Dos paneles en escritorio y apilados en móvil');
  const captura={data:await pagina.screenshot({animations:'disabled'}).then(b=>b.toString('base64'))};await writeFile('/tmp/tuvoto-mesas-referencia-'+ancho+'.png',Buffer.from(captura.data,'base64'));
 }
 await evaluar("document.querySelector('.menu-mesa-recepcion summary').click();true");
 await hasta("!!document.querySelector('.menu-mesa-recepcion[open] .control-eliminacion')");
 await evaluar("document.querySelector('.menu-mesa-recepcion[open] .control-eliminacion>button').click();true");
 assert.equal(await evaluar("document.querySelector('.confirmar-retirada').disabled"),true,'Eliminar sigue exigiendo confirmación');
 await pulsar('Cancelar');
 await evaluar("document.querySelector('.menu-mesa-recepcion[open]').open=false;true");
 await evaluar("document.querySelector('[aria-label=\"Cerrar cargos de la mesa\"]').click();true");
 await hasta("!document.querySelector('#detalle-cargos-mesa')");
 await pulsar('Crear mesa');
 await hasta("!!document.querySelector('dialog[open] .formulario-mesa-compartida')");
 await pulsar('Cerrar');
 await evaluar("document.querySelector('.acciones-mesas-clara [data-abrir-importacion]').click();true");
 await hasta("!!document.querySelector('[data-importacion=mesas] dialog[open] input[type=file]')");
 await pulsar('Cerrar');
 await pulsar('Equipo');
 await hasta("document.querySelectorAll('[data-operador]').length===10");
 assert.equal(await evaluar("document.querySelector('.paginacion-operadores [role=status]').textContent"),'1–10 de 12');
 await pulsar('Siguiente ›');
 await hasta("document.querySelectorAll('[data-operador]').length===2");
 await pulsar('‹ Anterior');
 await llenar('[aria-label="Filas por página"]','25');
 await hasta("document.querySelectorAll('[data-operador]').length===12");
 assert.equal(await evaluar("document.querySelector('[data-operador=operador-11] .acciones-fila-operador>button').disabled"),true,'Cuenta inactiva no puede asignarse');
 await evaluar("document.querySelector('.filtro-sin-mesa input').click();true");
 await hasta("document.querySelectorAll('[data-operador]').length===2");
 await evaluar("document.querySelector('.filtro-sin-mesa input').click();true");
 await llenar('[aria-label="Buscar operador o mesa"]','inexistente-sintetico');
 await hasta("document.querySelector('.directorio-operadores-recepcion').textContent.includes('No hay operadores que coincidan')");
 await llenar('[aria-label="Buscar operador o mesa"]','');
 await llenar('[aria-label="Filtrar operador"]','operador-1');
 await hasta("document.querySelectorAll('[data-operador]').length===1");
 assert.equal(await evaluar("document.querySelector('.cantidad-mesas-operador').textContent"),'2 mesas');
 await evaluar("document.querySelector('.desplegar-mesas-operador').click();true");
 await hasta("document.querySelectorAll('[data-asignacion-mesa-fisica]').length===2");
 for(const ancho of [390,768,1440,2560]){
  await pagina.setViewportSize({width:ancho,height:1100});
  assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Operadores sin desbordamiento global');
  const captura={data:await pagina.screenshot({animations:'disabled'}).then(b=>b.toString('base64'))};await writeFile('/tmp/tuvoto-operadores-referencia-'+ancho+'.png',Buffer.from(captura.data,'base64'));
 }
 await pulsar('Editar mesas');
 await hasta("!!document.querySelector('dialog[open] .formulario-operador')");
 assert.equal(await evaluar("document.querySelectorAll('dialog[open] input[type=checkbox]:checked').length"),2,'Muestra seleccionadas las asignaciones existentes');
 await pulsar('Cerrar');
 await pulsar('＋ Crear operador');
 await hasta("!!document.querySelector('dialog[open] .formulario-operador input[type=password]')");
 await pulsar('Cerrar');
 await evaluar("document.querySelector('.menu-importar-operadores summary').click();true");
 await pulsar('Operadores y mesas');
 await hasta("!!document.querySelector('[data-importacion=operadores] dialog[open] input[type=file]')");
 await pulsar('Cerrar');
 await pulsar('Asignaciones existentes');
 await hasta("!!document.querySelector('[data-importacion=asignaciones-general] dialog[open] input[type=file]')");
 await pulsar('Cerrar');
 await evaluar("document.querySelector('.menu-importar-operadores').open=false;true");
 await llenar('[aria-label="Filtrar operador"]','');
 await llenar('[aria-label="Filas por página"]','10');
 await pagina.setViewportSize({width:1440,height:1100});
 const operadoresCaptura={data:await pagina.screenshot({animations:'disabled'}).then(b=>b.toString('base64'))};await writeFile('/tmp/tuvoto-operadores-referencia-lista.png',Buffer.from(operadoresCaptura.data,'base64'));
 await pulsar('Resumen');
 await evaluar("window.fallarAsignaciones=true;true");
 await pulsar('Equipo');
 await hasta("!!document.querySelector('.directorio-operadores-recepcion [role=alert]')");
 await evaluar("window.fallarAsignaciones=false;true");
 await pulsar('Reintentar');
 await hasta("document.querySelectorAll('[data-operador]').length===10");
 assert.equal(await evaluar("window.solicitudes.every(s=>s.metodo==='GET')"),true,'Ninguna escritura para revisar el diseño');
 }
 assert.equal(erroresJavascript.length,0,'Sin errores JavaScript');

 if(!process.argv.includes('--pendientes-inicio'))console.log('OK: panel claro, 34 cargos sintéticos, filtros de grupo/estado/búsqueda/archivados, detalle/edición/creación/Excel y mesas con facultades laterales, tabla y detalle, búsqueda, sector, eliminación confirmada, alta/Excel y operadores con paginación, pendientes, filtros, mesas desplegadas, edición/alta/importaciones y cuatro tamaños; sin escrituras ni API real.');
}catch(e){await pagina.screenshot({path:'/tmp/tuvoto-panel-fallo.png',fullPage:true});console.error(e);throw e;}finally{await navegador.close();servidor.closeAllConnections();await new Promise(r=>servidor.close(r));}
