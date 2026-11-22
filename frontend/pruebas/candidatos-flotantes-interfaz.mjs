// Interfaz sintética: archivos compilados y catálogo vacío, sin contactar microservicios.
import http from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
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
const perfil=await mkdtemp('/tmp/tuvoto-firefox-bidi-');
const navegador=spawn('firefox',['--headless','--no-remote','--profile',perfil,'--remote-debugging-port','0','about:blank'],{stdio:['ignore','pipe','pipe']});
const erroresJavascript=[];
let ws;let identificador=0;const pendientes=new Map();
const esperar=ms=>new Promise(r=>setTimeout(r,ms));
try{
 const direccion=await new Promise((ok,no)=>{let salida='';const reloj=setTimeout(()=>no(Error('Firefox no inició BiDi')),20000);const leer=b=>{salida+=b.toString();const m=salida.match(/WebDriver BiDi listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(reloj);ok(m[1]);}};navegador.stderr.on('data',leer);navegador.stdout.on('data',leer);navegador.once('error',no);});
 ws=new WebSocket(direccion.replace(/\/$/,'')+'/session');await new Promise((ok,no)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',no,{once:true});});
 ws.addEventListener('message',e=>{const d=JSON.parse(String(e.data));if(d.method==='log.entryAdded'&&d.params.type==='javascript'&&d.params.level==='error')erroresJavascript.push(d.params);if(d.id&&pendientes.has(d.id)){const {ok,no,reloj}=pendientes.get(d.id);clearTimeout(reloj);pendientes.delete(d.id);if(d.type==='error')no(Error('BiDi: '+d.error));else ok(d.result);}});
 const comando=(method,params={})=>new Promise((ok,no)=>{const id=++identificador;const reloj=setTimeout(()=>{pendientes.delete(id);no(Error('Timeout '+method));},20000);pendientes.set(id,{ok,no,reloj});ws.send(JSON.stringify({id,method,params}));});
 await comando('session.new',{capabilities:{alwaysMatch:{}}});
 await comando('session.subscribe',{events:['log.entryAdded']});
 const {context}=await comando('browsingContext.create',{type:'tab'});
 const evaluar=async expression=>{const r=await comando('script.evaluate',{expression,target:{context},awaitPromise:true});if(r.type==='exception')throw Error('Error JavaScript en la página');return r.result?.value;};
 const hasta=async expresion=>{for(let i=0;i<60;i++){if(await evaluar(expresion))return;await esperar(250);}throw Error('No apareció el estado esperado de la interfaz');};

 await comando('browsingContext.navigate',{context,url:origen,wait:'complete'});
 const pulsar=async(texto)=>{await hasta(`Array.from((document.querySelector('dialog[open]')??document).querySelectorAll('button')).some(b=>b.textContent.trim()===${JSON.stringify(texto)}&&!b.disabled)`);await evaluar(`Array.from((document.querySelector('dialog[open]')??document).querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(texto)}&&!b.disabled).click();true`);};
 const llenar=async(selector,valor)=>evaluar(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(valor)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));return true;})()`);
 await hasta("!!document.querySelector('.indicadores-institucion')&&!document.querySelector('.item-menu-lateral').disabled");
 await pulsar('Candidatos');
 await hasta("document.querySelectorAll('[data-candidato-listado]').length>0");
 assert.equal(await evaluar("!!document.querySelector('.pie-administrador-claro .perfil-lateral-sesion') && !!document.querySelector('.pie-administrador-claro .institucion-lateral-clara')"),true);
 assert.equal(await evaluar("!!document.querySelector('.cabecera-superior-privada .perfil-usuario-privado')||!!document.querySelector('.institucion-cabecera-clara')"),false,'Sin perfil ni selector arriba');
 await hasta("Array.from(document.querySelectorAll('[data-grupo-candidatos=rectorado] img')).every(i=>i.complete&&i.naturalWidth>0)&&document.querySelectorAll('[data-grupo-candidatos=rectorado] img').length===2");
 assert.equal(await evaluar("getComputedStyle(document.querySelector('.nombres-candidatos-cargo>li')).flexDirection"),'row');
 assert.equal(await evaluar("getComputedStyle(document.querySelector('.acciones-candidato-flotante')).flexDirection"),'row');
 await evaluar("document.querySelector('[data-grupo-candidatos=decanos]').open=true;true");
 for(const ancho of [390,768,1440,2560]){
  await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:1100}});
  assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Sin desbordamiento global');
  assert.equal(await evaluar("getComputedStyle(document.querySelector('.pie-administrador-claro')).display!=='none'"),true,'Cuenta accesible en móvil');
  assert.equal(await evaluar(`(()=>{const grupo=document.querySelector('[data-grupo-candidatos=decanos]');const cargos=[...grupo.querySelectorAll('.cargo-con-candidatos')];return cargos.length>=12&&cargos.every(c=>c.getBoundingClientRect().width>=grupo.getBoundingClientRect().width-80)&&[...grupo.querySelectorAll('.datos-candidato-flotante')].every(e=>e.getBoundingClientRect().width>=100);})()`),true,'Cargos apilados y nombres legibles, incluso con varios candidatos por decanato');
  const captura=await comando('browsingContext.captureScreenshot' ,{context});await writeFile('/tmp/tuvoto-candidatos-flotantes-'+ancho+'.png',Buffer.from(captura.data,'base64'));
 }
 await evaluar("document.querySelector('.filtro-candidatos-sin-foto input').click();true");
 await hasta("document.querySelectorAll('.nombres-candidatos-cargo .foto-disponible').length===0");
 await evaluar("document.querySelector('.filtro-candidatos-sin-foto input').click();true");
 await hasta("document.querySelector('[data-grupo-candidatos=rectorado] .editar-candidato')!==null");
 await evaluar("document.querySelector('[data-grupo-candidatos=rectorado] .editar-candidato').click();true");
 await hasta("!!document.querySelector('.formulario-editar-candidato input[type=file]')");
 await llenar('.formulario-editar-candidato input:not([type=file])','Nombre actualizado de prueba');
 await evaluar(`(()=>{const png='iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGNwa//6H4QZYAwAXgQLBS5SOIIAAAAASUVORK5CYII=';const d=new DataTransfer();d.items.add(new File([Uint8Array.from(atob(png),c=>c.charCodeAt(0))],'foto.png',{type:'image/png'}));const e=document.querySelector('.formulario-editar-candidato input[type=file]');e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));window.fallarFoto=true;return true;})()`);
 await hasta("document.querySelector('.vista-foto-edicion img')?.getAttribute('alt')==='Vista previa de la nueva fotografía'");
 await pulsar('Guardar cambios');
 await hasta("document.querySelector('.formulario-editar-candidato [role=alert]')?.textContent.includes('Nombre guardado')");
 await pulsar('Guardar cambios');
 await hasta("!!document.querySelector('.modal-confirmacion-global[open]')");
 await pulsar('Entendido');
 await hasta("!document.querySelector('dialog[open]')&&document.querySelector('[data-grupo-candidatos=rectorado]').textContent.includes('Nombre actualizado de prueba')");
 assert.equal(await evaluar("window.solicitudes.filter(s=>s.metodo==='PUT'&&!s.ruta.endsWith('/foto')).length"),1,'No repite nombre tras fallo de foto');
 assert.equal(await evaluar("window.solicitudes.filter(s=>s.metodo==='PUT'&&s.ruta.endsWith('/foto')).length"),2);
 await evaluar("document.querySelector('.menu-candidato summary').click();true");
 assert.equal(await evaluar("document.querySelector('.menu-candidato[open] .control-eliminacion button').textContent"),'Eliminar');
 await evaluar("document.querySelector('.menu-candidato[open] .control-eliminacion button').click();true");
 assert.equal(await evaluar("document.querySelector('.confirmar-retirada').disabled"),true,'Mantiene confirmación de retirada');
 await evaluar("document.querySelector('.menu-candidato[open] .confirmar-eliminacion button.secundario').click();document.querySelector('.menu-candidato[open]').open=false;true");
 await pulsar('＋ Agregar candidato');
 await hasta("!!document.querySelector('dialog[open] .editor-candidatos form input[type=file]')");
 await pulsar('Cerrar');
 await pulsar('Importar Excel');await hasta("!!document.querySelector('[data-importacion=candidatos-general] dialog[open] input[type=file]')");
 await pulsar('Cerrar');
 await evaluar("document.querySelector('.perfil-lateral-sesion summary').click();true");
 await pulsar('Cerrar sesión');
 await hasta("!!document.querySelector('.formulario-acceso-tuvoto')");
 assert.equal(await evaluar("window.solicitudes.filter(s=>s.metodo==='DELETE').length"),0,'No elimina datos para verificar el menú');
 assert.equal(erroresJavascript.length,0,'Sin errores JavaScript');
 await comando('session.end');
 console.log('OK: perfil/organización lateral, fotos decodificadas, edición unificada con fallo parcial y reintento, menú Eliminar con confirmación, alta/Excel, logout y cuatro tamaños, incluidos decanos desplegados; API sintética sin datos reales.');
}finally{if(ws)ws.close();navegador.kill('SIGTERM');await new Promise(r=>servidor.close(r));}
