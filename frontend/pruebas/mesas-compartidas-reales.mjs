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


 const datos=JSON.parse(await readFile(entorno.carpeta+'/mesas-compartidas-prueba.json','utf8'));
 assert.equal(datos.proyecto,entorno.proyecto);
 const operador=JSON.parse(await readFile(entorno.carpeta+'/operador-interfaz.json','utf8'));
 async function login(c){
  await hasta("!!document.getElementById('usuario')");
  await evaluar(`(()=>{const poner=(id,v)=>{const e=document.getElementById(id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}));};poner('usuario',${JSON.stringify(c.usuario)});poner('contrasena',${JSON.stringify(c.contrasena)});return true;})()`);
  await evaluar("document.querySelector('.formulario-acceso-tuvoto button.primario').click();true");
  await hasta("!!document.querySelector('.navegacion-lateral')");
 }
 async function ir(nombre){
  await hasta(`!!Array.from(document.querySelectorAll('.item-menu-lateral')).find(b=>b.textContent.trim()===${JSON.stringify(nombre)}&&!b.disabled)`);
  await evaluar(`Array.from(document.querySelectorAll('.item-menu-lateral')).find(b=>b.textContent.trim()===${JSON.stringify(nombre)}).click();true`);
 }
 async function retirar(raiz){
  await evaluar(`(${raiz}).querySelector('.control-eliminacion>.boton').click();true`);
  await hasta(`!!(${raiz}).querySelector('.confirmar-eliminacion input')`);
  assert.equal(await evaluar(`(${raiz}).querySelector('.confirmar-retirada').disabled`),true,'Eliminar exige confirmación explícita');
  await evaluar(`(${raiz}).querySelector('.confirmar-eliminacion input').click();true`);
  await evaluar(`(${raiz}).querySelector('.confirmar-retirada').click();true`);
  await hasta("document.querySelector('.modal-confirmacion-global .confirmacion')?.textContent.includes('retirad')&&!document.querySelector('.item-menu-lateral').disabled");
 }
 async function publico(ruta,metodo='GET',entrada){
  return evaluar(`(async()=>{const csrf=document.cookie.split(';').map(v=>v.trim()).find(v=>/^(?:__Host-)?tuvoto-csrf=/.test(v))?.split('=').slice(1).join('=');const r=await fetch('/api/v1'+${JSON.stringify(ruta)},{method:${JSON.stringify(metodo)},headers:{'X-Organizacion':${JSON.stringify(datos.organizacion)},'X-CSRF-Token':csrf,...${JSON.stringify(entrada!==undefined?{'Content-Type':'application/json'}:{})}},${entrada!==undefined?'body:JSON.stringify('+JSON.stringify(entrada)+'),':''}});if(!r.ok)throw Error('Solicitud sintética rechazada');return r.status===204?'':JSON.stringify(await r.json());})()`);
 }
 await comando('browsingContext.setViewport',{context,viewport:{width:1440,height:1000}});
 await comando('browsingContext.navigate',{context,url:entorno.url+'/#panel',wait:'complete'});await login(cuenta);
 await hasta(`!!Array.from(document.querySelectorAll('[data-institucion]')).find(e=>e.dataset.institucion===${JSON.stringify(datos.organizacion)}&&!e.disabled)`);
 await evaluar(`Array.from(document.querySelectorAll('[data-institucion]')).find(e=>e.dataset.institucion===${JSON.stringify(datos.organizacion)}).click();true`);
 await hasta("!!document.querySelector('.indicadores-institucion')");await ir('Candidatos');
 await hasta(`!!document.querySelector('[data-candidatos-cargo="${datos.idsProcesos[0]}"] .gestionar-cargo-candidatos')`);
 await evaluar(`document.querySelector('[data-candidatos-cargo="${datos.idsProcesos[0]}"] .gestionar-cargo-candidatos').click();true`);
 await hasta(`!!document.querySelector('[data-candidato-foto="${datos.candidatoEliminar}"]')`);
 await retirar(`document.querySelector('[data-candidato-foto="${datos.candidatoEliminar}"]')`);
 await hasta(`!!document.querySelector('.totales-candidatos')&&!document.querySelector('[data-candidato-foto="${datos.candidatoEliminar}"]')`);
 let p=JSON.parse(await publico('/configuracion/procesos/'+datos.idsProcesos[0]));assert.equal(p.candidatos.length,2);
 await ir('Mesas');
 await hasta(`!!document.querySelector('[data-mesa-cargo="${datos.mesaEliminar}"]')`);
 await evaluar(`document.querySelector('[data-mesa-cargo="${datos.mesaEliminar}"]').closest('.grupo-mesas-facultad').querySelector('summary').click();true`);
 await evaluar(`document.querySelector('[data-mesa-cargo="${datos.mesaEliminar}"]').closest('details').querySelector('summary').click();true`);
 await retirar(`document.querySelector('[data-mesa-cargo="${datos.mesaEliminar}"]')`);
 await hasta(`!!document.querySelector('.mesas-compartidas')&&!document.querySelector('[data-mesa-cargo="${datos.mesaEliminar}"]')`);
 await ir('Elección');await abrirCargoEnGrupo(datos.cargoEliminar);
 await retirar(`document.querySelector('[data-cargo="${datos.cargoEliminar}"]').closest('li')`);
 await hasta(`!!document.querySelector('.grupos-cargos-institucion')&&!document.querySelector('[data-cargo="${datos.cargoEliminar}"]')`);
 console.log('OK: eliminar candidato, mesa y cargo desde React; confirmación requerida y datos originales conservados.');
 await ir('Mesas');await hasta("!!document.querySelector('.crear-mesa-compartida')");
 await evaluar("document.querySelector('.crear-mesa-compartida').click();true");
 await evaluar(`(()=>{const f=document.querySelector('.formulario-mesa-compartida');const poner=(e,v)=>{Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,v);e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));};poner(f.querySelector('input[placeholder="Ej.: Mesa 001"]'),${JSON.stringify(datos.codigoUi)});poner(f.querySelector('[aria-label="Unidad de la mesa"]'),${JSON.stringify(datos.unidad)});poner(Array.from(f.querySelectorAll('label')).find(l=>l.textContent.startsWith('Sector')).querySelector('select'),'estudiantes');poner(Array.from(f.querySelectorAll('label')).find(l=>l.textContent.startsWith('Operador')).querySelector('select'),${JSON.stringify(datos.usuario)});return true;})()`);
 for(const id of datos.idsProcesos)await evaluar(`(()=>{const e=document.querySelector('.cargos-mesa-compartida input[value="${id}"]');if(!e.checked)e.click();return true;})()`);
 await evaluar(`(()=>{const ids=${JSON.stringify(datos.idsProcesos)};for(const e of document.querySelectorAll('.cargos-mesa-compartida input:checked'))if(!ids.includes(e.value))e.click();return true;})()`);
 assert.equal(await evaluar("document.querySelectorAll('.cargos-mesa-compartida input:checked').length"),3);
 for(const ancho of [320,390,768,1024,1440]){await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:1000}});await evaluar("document.querySelector('.crear-mesa-compartida').scrollIntoView({block:'start'});true");assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Formulario compartido desbordado a '+ancho+'px');const c=await comando('browsingContext.captureScreenshot',{context});await writeFile('/tmp/tuvoto-mesa-compartida-'+ancho+'.png',Buffer.from(c.data,'base64'));}
 await evaluar("document.querySelector('.formulario-mesa-compartida button[type=submit]').click();true");
 await hasta("document.querySelector('.modal-confirmacion-global .confirmacion')?.textContent.includes('Mesa guardada correctamente')&&!!document.querySelector('.mesas-compartidas [data-mesa-fisica]')");
 const grupos=JSON.parse(await publico('/configuracion/mesas-compartidas'));const creada=grupos.elementos.find(g=>g.codigo===datos.codigoUi);assert.equal(creada.cargos.length,3);
 const idsAntes=creada.cargos.map(c=>c.idMesa).sort();
 // Reimportación real del mismo archivo: vincula sin duplicar mesas ni asignaciones.
 await hasta("!!document.querySelector('[data-importacion=\"mesas\"]')");
 await evaluar("document.querySelector('[data-importacion=\"mesas\"] [data-abrir-importacion]').click();true");
 await evaluar(`(()=>{const d=new DataTransfer();d.items.add(new File([Uint8Array.from(atob(${JSON.stringify(datos.archivo)}),c=>c.charCodeAt(0))],'mesas-compartidas-sinteticas.xlsx'));const e=document.querySelector('[data-importacion="mesas"] input[type=file]');e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
 await hasta("!!Array.from(document.querySelectorAll('[data-importacion=\"mesas\"] button')).find(b=>b.textContent==='Revisar archivo'&&!b.disabled)");
 await evaluar("Array.from(document.querySelectorAll('[data-importacion=\"mesas\"] button')).find(b=>b.textContent==='Revisar archivo').click();true");
 await hasta("document.querySelectorAll('[data-importacion=\"mesas\"] tbody tr').length===6&&!document.querySelector('[data-importacion=\"mesas\"] input[type=checkbox]').disabled");
 await evaluar("document.querySelector('[data-importacion=\"mesas\"] input[type=checkbox]').click();true");
 await evaluar("Array.from(document.querySelectorAll('[data-importacion=\"mesas\"] button')).find(b=>b.textContent==='Confirmar importación').click();true");
 await hasta("document.querySelector('.modal-confirmacion-global .confirmacion')?.textContent.includes('Mesas físicas y cargos importados')&&!document.querySelector('.item-menu-lateral').disabled");
 const despues=JSON.parse(await publico('/configuracion/mesas-compartidas')).elementos.find(g=>g.id===creada.id);assert.deepEqual(despues.cargos.map(c=>c.idMesa).sort(),idsAntes);
 await ir('Resumen');await hasta("!!document.querySelector('.indicadores-institucion')");
 assert.equal(await evaluar(`(async()=>{const ps=(await fetch('/api/v1/configuracion/procesos',{headers:{'X-Organizacion':${JSON.stringify(datos.organizacion)}}}).then(r=>r.json())).elementos.filter(p=>p.estado!=='archivada');return Number(document.querySelector('[data-indicador=mesas]>strong').textContent)===new Set(ps.flatMap(p=>p.mesas.map(m=>m.idMesaFisica||m.id))).size;})()`),true,'Resumen cuenta una mesa física una sola vez');
 for(const id of datos.idsProcesos)await publico('/configuracion/procesos/'+id+'/actual','POST',{confirmar:true});
 await evaluar("document.querySelector('.boton-cerrar-sesion').click();true");await login(operador);
 await hasta("!!document.querySelector('.panel-operador .grid-operador-registro')");
 const opciones=JSON.parse(await evaluar(`JSON.stringify(Array.from(document.querySelectorAll('[aria-label="Mesa asignada"] optgroup')).find(g=>g.label.includes(${JSON.stringify(datos.codigoUi)}))?.getAttributeNames()&&Array.from(Array.from(document.querySelectorAll('[aria-label="Mesa asignada"] optgroup')).find(g=>g.label.includes(${JSON.stringify(datos.codigoUi)})).querySelectorAll('option'),o=>({id:o.value,cargo:o.textContent.split(' · ')[0]})))`));
 assert.equal(opciones.length,3);assert.equal(new Set(opciones.map(o=>o.id)).size,3);
 for(const o of opciones){await evaluar(`(()=>{const s=document.querySelector('[aria-label="Mesa asignada"]');s.value=${JSON.stringify(o.id)};s.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);await hasta(`document.querySelector('.subtitulo-seccion-privada').textContent.trim().startsWith(${JSON.stringify(o.cargo+' · ')})&&!!document.querySelector('form input[type=number]')`);}
 for(const ancho of [320,390,768,1024,1440]){await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:1000}});assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Operador desbordado a '+ancho+'px');}
 await evaluar("document.querySelector('.boton-cerrar-sesion').click();true");await hasta("!!document.getElementById('usuario')");
 assert.equal(erroresJavascript.length,0,'Sin errores JavaScript no controlados');
 await comando('session.end');console.log('OK: Excel desde React, una mesa física con tres cargos en el operador, resumen correcto y cinco tamaños.');
}finally{if(ws)ws.close();navegador.kill('SIGTERM');}
