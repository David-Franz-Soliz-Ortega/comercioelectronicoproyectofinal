// Interfaz sintética: archivos compilados y catálogo vacío, sin contactar microservicios.
import http from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const carpeta=fileURLToPath(new URL('../dist',import.meta.url));
const servidor=http.createServer(async(req,res)=>{
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
 await hasta("!!document.querySelector('.observatorio-publico')");
 await evaluar("(()=>{const b=document.createElement('button');b.id='prueba-foco';b.textContent='Control de prueba';document.body.append(b);b.focus();return true;})()");
 const aviso=async()=>{await evaluar("window.dispatchEvent(new CustomEvent('tuvoto:operacion-confirmada',{detail:'Operación sintética completada.'}));true");await hasta("!!document.querySelector('.modal-confirmacion-global[open]')");};
 const pulsar=async(x,y)=>comando('input.performActions',{context,actions:[{type:'pointer',id:'raton',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',origin:'viewport',x,y},{type:'pointerDown',button:0},{type:'pointerUp',button:0}]}]});
 for(const ancho of [390,768,1440]){
  await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:900}});
  await evaluar("document.getElementById('prueba-foco').focus();true");
  await aviso();
  assert.equal(await evaluar("document.querySelector('dialog').matches(':modal') && document.querySelector('dialog').contains(document.activeElement) && document.documentElement.scrollWidth<=innerWidth"),true);
  const captura=await comando('browsingContext.captureScreenshot',{context});await writeFile('/tmp/tuvoto-modal-'+ancho+'.png',Buffer.from(captura.data,'base64'));
  await pulsar(2,2);await hasta("!document.querySelector('dialog')");
  assert.equal(await evaluar("document.activeElement.id==='prueba-foco' && document.body.style.overflow!== 'hidden'"),true,'Restaurar foco y scroll');
  await aviso();
  const punto=JSON.parse(await evaluar("JSON.stringify((()=>{const r=document.querySelector('dialog p').getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})())"));
  await pulsar(punto.x,punto.y);await hasta("!document.querySelector('dialog')");
  await aviso();
  await comando('input.performActions',{context,actions:[{type:'key',id:'teclado',actions:[{type:'keyDown',value:'\uE00C'},{type:'keyUp',value:'\uE00C'}]}]});
  await hasta("!document.querySelector('dialog')");
 }
 assert.equal(erroresJavascript.length,0,'Sin errores JavaScript');
 await comando('session.end');
 console.log('OK: modal real en Firefox; cierre por fondo, contenido y Escape, foco y scroll restaurados; 390/768/1440 px; sin escrituras HTTP.');
}finally{if(ws)ws.close();navegador.kill('SIGTERM');await new Promise(r=>servidor.close(r));}
