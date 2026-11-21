// Firefox ya instalado y WebDriver BiDi: cuenta sintética del entorno de pruebas, nunca credenciales del usuario.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import assert from 'node:assert/strict';
const entorno=JSON.parse(await readFile('/tmp/tuvoto-ampliacion-entorno.json','utf8'));
assert.ok(entorno.proyecto.startsWith('tuvoto-prueba-sectores-'));assert.equal(entorno.url,'http://127.0.0.1:18891');
const cuenta=JSON.parse(await readFile(entorno.carpeta+'/cuenta-prueba.json','utf8'));
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
 const abrirCargoEnGrupo=async id=>{
  assert.equal(await evaluar(`(()=>{const b=Array.from(document.querySelectorAll('[data-cargo]')).find(b=>b.dataset.cargo===${JSON.stringify(id)});const grupo=b?.closest('[data-grupo-cargos]');if(!grupo)return false;if(!grupo.open)grupo.querySelector('summary').click();return grupo.open&&b.getBoundingClientRect().height>0;})()`),true,'El cargo se abre desde su grupo visible');
 };


 const datos=JSON.parse(await readFile(entorno.carpeta+'/fotografias-prueba.json','utf8'));
 assert.equal(datos.proyecto,entorno.proyecto);
 const selectorCargo=`[data-candidatos-cargo="${datos.idProceso}"]`;
 const selectorFoto=`[data-candidato-foto="${datos.idConFoto}"]`;
 const fotoLista=selectorCargo+' [data-candidato-listado="'+datos.idConFoto+'"] img';
 async function elegirInstitucion(){
  await hasta("document.querySelectorAll('[data-institucion]').length>0&&!document.querySelector('[data-institucion]').disabled");
  await evaluar(`Array.from(document.querySelectorAll('[data-institucion]')).find(e=>e.dataset.institucion===${JSON.stringify(datos.idOrganizacion)}).click();true`);
  await hasta("!!document.querySelector('.indicadores-institucion')");
 }
 async function abrirListado(){
  await evaluar("Array.from(document.querySelectorAll('.item-menu-lateral')).find(b=>b.textContent.trim()==='Candidatos').click();true");
  await hasta(`!!document.querySelector(${JSON.stringify(fotoLista)})?.naturalWidth`);
 }
 async function gestionar(){
  await evaluar(`document.querySelector(${JSON.stringify(selectorCargo)}).querySelector('.gestionar-cargo-candidatos').click();true`);
  await hasta(`document.querySelector(${JSON.stringify(selectorFoto+' img')})?.naturalWidth>0`);
 }
 await comando('browsingContext.setViewport',{context,viewport:{width:1440,height:1000}});
 await comando('browsingContext.navigate',{context,url:entorno.url+'/#panel',wait:'complete'});
 await hasta("!!document.getElementById('usuario')");
 await evaluar(`(()=>{const poner=(id,v)=>{const e=document.getElementById(id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}));};poner('usuario',${JSON.stringify(cuenta.usuario)});poner('contrasena',${JSON.stringify(cuenta.contrasena)});return true;})()`);
 await evaluar("document.querySelector('.formulario-acceso-tuvoto button.primario').click();true");
 await elegirInstitucion();await abrirListado();
 assert.equal(await evaluar(`document.querySelector(${JSON.stringify(selectorCargo+' [data-candidato-listado="'+datos.idSinFoto+'"] .avatar-letra')}).textContent.trim().length>0`),true,'Las iniciales identifican al candidato sin foto');
 assert.equal(await evaluar(`document.querySelector(${JSON.stringify(fotoLista)}).src.startsWith('blob:')`),true,'Los borradores se leen por la API privada, sin enlaces públicos');
 assert.equal(await evaluar("Number(document.querySelector('[data-candidatos-con-foto]').textContent)+Number(document.querySelector('[data-candidatos-sin-foto]').textContent)===Number(document.querySelector('[data-total-candidatos]').textContent)"),true,'Contadores de fotografías coherentes con los registros');
 for(const ancho of [320,390,768,1024,1440]){
  await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:1000}});
  await evaluar(`document.querySelector(${JSON.stringify(selectorCargo)}).scrollIntoView({block:'center'});true`);
  assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Fotos sin desbordamiento a '+ancho+'px');
  const captura=await comando('browsingContext.captureScreenshot',{context});await writeFile('/tmp/tuvoto-fotografias-'+ancho+'.png',Buffer.from(captura.data,'base64'));
 }
 await gestionar();
 const anterior=await evaluar(`document.querySelector(${JSON.stringify(selectorFoto+' img')}).src`);
 await evaluar(`(()=>{const f=new File([Uint8Array.from(atob(${JSON.stringify(datos.fotoActualizada)}),c=>c.charCodeAt(0))],'fotografia-sintetica-actualizada.png',{type:'image/png'});const d=new DataTransfer();d.items.add(f);const e=document.querySelector(${JSON.stringify(selectorFoto+' input[type=file]')});e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
 await hasta(`document.querySelector('.contenido-seccion-privada>.confirmacion')?.textContent.includes('Fotografía guardada')&&document.querySelector(${JSON.stringify(selectorFoto+' img')})?.naturalWidth>0&&!document.querySelector('.gestionar-candidatos').disabled`);
 assert.equal(await evaluar(`fetch(${JSON.stringify(anterior)}).then(()=>false,()=>true)`),true,'La imagen privada anterior se libera al actualizarla');
 await comando('browsingContext.reload',{context,wait:'complete'});
 await elegirInstitucion();await abrirListado();await gestionar();
 await evaluar("Array.from(document.querySelectorAll('.item-menu-lateral')).find(b=>b.textContent.trim()==='Resumen').click();true");
 await hasta(`document.querySelector('.vista-previa-resultados')?.dataset.procesoPrevia===${JSON.stringify(datos.idProceso)}&&document.querySelector('.vista-previa-resultados img')?.naturalWidth>0`);
 assert.equal(await evaluar("!!document.querySelector('.vista-previa-resultados .iniciales-candidato-resumen')"),true,'Resumen: imagen guardada y candidato sin foto con iniciales');
 console.log('OK: fotos de borradores visibles en lista, editor y resumen; actualización persistida tras recarga.');
 // Publicación exclusivamente sintética para comprobar la imagen que recibirá Resultados.
 await evaluar(`(async()=>{const csrf=document.cookie.split(';').map(v=>v.trim()).find(v=>/^(?:__Host-)?tuvoto-csrf=/.test(v))?.split('=').slice(1).join('=');const r=await fetch('/api/v1/configuracion/procesos/'+${JSON.stringify(datos.idProceso)}+'/actual',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf,'X-Organizacion':${JSON.stringify(datos.idOrganizacion)}},body:JSON.stringify({confirmar:true})});if(!r.ok)throw Error('Publicación sintética no completada');return true;})()`);
 await evaluar("document.querySelector('.boton-cerrar-sesion').click();true");
 await hasta("!!document.getElementById('usuario')");
 await comando('browsingContext.navigate',{context,url:entorno.url+'/#resultados?proceso='+datos.idProceso,wait:'complete'});
 await hasta(`document.querySelector('.observatorio-publico')?.dataset.procesoPublico===${JSON.stringify(datos.idProceso)}&&document.querySelectorAll('.tarjeta-candidatura').length===2&&document.querySelector('.retrato-candidatura img')?.naturalWidth>0`);
 assert.equal(await evaluar("document.querySelectorAll('.retrato-candidatura img').length===1&&document.querySelectorAll('.retrato-pendiente').length===1"),true,'Resultados públicos: foto real guardada e iniciales solo para quien no la tiene');
 assert.equal(await evaluar("document.querySelector('.retrato-candidatura img').getAttribute('src').startsWith('/api/v1/publico/candidatos/')"),true,'Resultados públicos conserva la ruta pública de fotografías');
 assert.equal(erroresJavascript.length,0,'Sin errores JavaScript no controlados');
 await comando('session.end');
 console.log('OK: fotografía publicada visible en Resultados sin login; ninguna acta creada.');
}finally{if(ws)ws.close();navegador.kill('SIGTERM');}
