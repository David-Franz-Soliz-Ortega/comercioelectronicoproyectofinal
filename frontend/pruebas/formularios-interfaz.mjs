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
await build({entryPoints:[resolve(frontend,'pruebas/fixtures/formularios.jsx')],bundle:true,outfile:'/tmp/tuvoto-formularios-fixture.js',define:{'process.env.NODE_ENV':'"production"'}});
const css=(await readdir(resolve(carpeta,'assets'))).filter(s=>s.endsWith('.css')).map(s=>'<link rel="stylesheet" href="/assets/'+s+'">').join('');
await writeFile('/tmp/tuvoto-formularios-fixture.html','<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">'+css+'<div id="root"></div><script src="/formularios-fixture.js"></script>');
const servidor=http.createServer(async(req,res)=>{
 if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(await readFile('/tmp/tuvoto-formularios-fixture.html'));return;}
 if(req.url==='/formularios-fixture.js'){res.setHeader('Content-Type','application/javascript');res.end(await readFile('/tmp/tuvoto-formularios-fixture.js'));return;}
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
 const pulsar=async(texto)=>{await hasta(`Array.from((document.querySelector('dialog[open]')??document).querySelectorAll('button')).some(b=>b.textContent===${JSON.stringify(texto)}&&!b.disabled)`);await evaluar(`Array.from((document.querySelector('dialog[open]')??document).querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(texto)}&&!b.disabled).click();true`);};
 const cerrarExito=async()=>{await hasta("!!document.querySelector('.modal-confirmacion-global[open]')");await evaluar("document.querySelector('.modal-confirmacion-global button').click();true");await hasta("!document.querySelector('dialog[open]')");};
 const llenar=async(selector,valor)=>evaluar(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(valor)});e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
 await hasta("document.querySelector('.grupos-mesas-operador')?.textContent.includes('Pendiente de asignación')");
 assert.equal(await evaluar("document.querySelectorAll('dialog[open]').length"),0);
 await pulsar('Crear operador');
 await hasta("!!document.querySelector('.formulario-operador')");
 assert.equal(await evaluar("document.querySelectorAll('.formulario-operador select').length"),0,'Institución fija');
 await llenar('.formulario-operador input[autoComplete=off]','nuevo.sintetico');
 await llenar('.formulario-operador input[type=password]','Clave-Sintetica-2026');
 await evaluar("document.querySelector('.opciones-mesas-operador input').click();window.fallarAsignacion=true;true");
 await pulsar('Crear operador');
 await hasta("document.querySelector('.formulario-operador [role=alert]')?.textContent.includes('La cuenta ya fue creada')");
 assert.equal(await evaluar("document.querySelectorAll('.formulario-operador input[type=password]').length"),0,'La clave desaparece tras crear');
 await pulsar('Guardar asignaciones');await cerrarExito();
 assert.equal(await evaluar("window.solicitudes.filter(s=>s.ruta.endsWith('/usuarios')).length"),1,'Reintento sin duplicar cuenta');
 assert.equal(await evaluar("window.solicitudes.find(s=>s.ruta.endsWith('/usuarios')).datos.idOrganizacion"),'org');
 await hasta("document.querySelector('[data-operador=op2]')?.textContent.includes('001')");
 await evaluar("document.querySelector('[data-operador=op1] button').click();true");
 await hasta("!!document.querySelector('.formulario-operador')");
 assert.equal(await evaluar("document.querySelectorAll('.formulario-operador input[type=password]').length"),0);
 await pulsar('Cerrar');
 await pulsar('Crear operador');
 await hasta("!!document.querySelector('.formulario-operador')");
 await llenar('.formulario-operador input[autoComplete=off]','pendiente.sintetico');
 await llenar('.formulario-operador input[type=password]','Clave-Sintetica-2026');
 const asignacionesAntes=await evaluar("window.solicitudes.filter(s=>s.ruta.endsWith('/asignar')).length");
 await pulsar('Crear operador');await cerrarExito();
 await hasta("document.querySelector('[data-operador=op3]')?.textContent.includes('Pendiente de asignación')");
 assert.equal(await evaluar("window.solicitudes.filter(s=>s.ruta.endsWith('/asignar')).length"),asignacionesAntes,'Crear sin mesa no asigna nada');
 await pulsar('Crear mesa');await hasta("!!document.querySelector('.formulario-mesa-compartida')");
 await llenar('input[placeholder="Ej.: Mesa 001"]','002');await llenar('[aria-label="Unidad de la mesa"]','Facultad sintética');
 await pulsar('Guardar mesa');await hasta("!document.querySelector('dialog[open]')");
 assert.equal(await evaluar("window.solicitudes.filter(s=>s.ruta.endsWith('/mesas-compartidas')).length"),1);
 const entrada='[data-importacion=operadores]';
 await evaluar(`document.querySelector('${entrada} [data-abrir-importacion]').focus();document.querySelector('${entrada} [data-abrir-importacion]').click();true`);
 await hasta("!!document.querySelector('[data-importacion=operadores] dialog[open]')");
 await evaluar(`(()=>{const d=new DataTransfer();d.items.add(new File(['sintético'],'operadores.xlsx'));const e=document.querySelector('${entrada} input[type=file]');e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
 await pulsar('Revisar archivo');
 await hasta("!!document.querySelector('[data-importacion=operadores] tbody tr')");
 for(const ancho of [390,768,1440]){
  await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:1100}});
  assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Sin desbordamiento de página');
  assert.equal(await evaluar('(()=>{const d=document.querySelector("dialog[open]");return d.scrollWidth<=d.clientWidth+1;})()'),true,'Sin desbordamiento del modal');
  const captura=await comando('browsingContext.captureScreenshot',{context});await writeFile('/tmp/tuvoto-formularios-'+ancho+'.png',Buffer.from(captura.data,'base64'));
 }
 await pulsar('Cerrar');
 await evaluar(`document.querySelector('${entrada} [data-abrir-importacion]').focus();document.querySelector('${entrada} [data-abrir-importacion]').click();true`);
 await hasta("!!document.querySelector('[data-importacion=operadores] dialog[open]')");
 assert.equal(await evaluar("document.querySelector('[data-importacion=operadores] input[type=file]').files.length"),0,'Cancelar elimina el archivo privado');
 assert.equal(await evaluar("document.querySelectorAll('[data-importacion=operadores] tbody tr').length"),0);
 await pulsar('Cerrar');
 assert.equal(await evaluar("document.activeElement.hasAttribute('data-abrir-importacion')"),true,'Foco restaurado');
 await evaluar(`document.querySelector('${entrada} [data-abrir-importacion]').click();true`);
 await hasta("!!document.querySelector('[data-importacion=operadores] dialog[open]')");
 await evaluar(`(()=>{const d=new DataTransfer();d.items.add(new File(['sintético'],'operadores.xlsx'));const e=document.querySelector('${entrada} input[type=file]');e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
 await pulsar('Revisar archivo');await hasta("!!document.querySelector('[data-importacion=operadores] tbody tr')");
 await evaluar("document.querySelector('[data-importacion=operadores] .confirmacion-preparacion input').click();true");
 await pulsar('Confirmar importación');
 await hasta("!!document.querySelector('.modal-confirmacion-global[open]')");
 await evaluar("document.querySelector('.modal-confirmacion-global button').click();true");
 await hasta("document.querySelectorAll('.resultado-importacion-operadores tbody tr').length===3");
 assert.equal(await evaluar("document.querySelector('.resultado-importacion-operadores').textContent.includes('Mesa no encontrada: NO-EXISTE')"),true);
 await pulsar('Ver operadores');await hasta("!document.querySelector('dialog[open]')");
 await hasta("document.querySelector('[data-operador=op6]')?.textContent.includes('Pendiente de asignación')");
 assert.equal(await evaluar("document.querySelector('[data-operador=op4]').textContent.includes('001')"),true);
 await evaluar("document.querySelector('.filtro-pendientes-operador input').click();true");
 await hasta("!document.querySelector('[data-operador=op4]')");
 assert.equal(await evaluar("!!document.querySelector('[data-operador=op6]')"),true);

 assert.equal(await evaluar("window.solicitudes.filter(s=>s.ruta.endsWith('/confirmar')).length"),1,'Confirma una sola vez y cierra el formulario');
 assert.equal(erroresJavascript.length,0,'Sin errores JavaScript');
 await comando('session.end');
 console.log('OK: modales, creación con fallo parcial y reintento sin duplicados, edición de asignaciones, creación de mesa, Excel y borrado al cancelar; 390/768/1440 sin desbordamientos. API sintética, sin persistencia real.');
}finally{if(ws)ws.close();navegador.kill('SIGTERM');await new Promise(r=>servidor.close(r));}
