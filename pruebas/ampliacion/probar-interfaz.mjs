import { createRequire } from 'node:module';
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

 await comando('browsingContext.setViewport',{context,viewport:{width:1440,height:1000}});
 await comando('browsingContext.navigate',{context,url:entorno.url+'/#panel',wait:'complete'});
 await hasta("!!document.getElementById('usuario')");
 await evaluar(`(()=>{const poner=(id,v)=>{const el=document.getElementById(id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};poner('usuario',${JSON.stringify(cuenta.usuario)});poner('contrasena',${JSON.stringify(cuenta.contrasena)});return true;})()`);
 await evaluar("document.querySelector('.formulario-acceso-tuvoto button.primario').click();true");
 await hasta("!!document.querySelector('.navegacion-lateral')");
 assert.equal(await evaluar("document.querySelector('.control-pasos-preparacion').getAttribute('aria-pressed')"),'false','La guía comienza desactivada');
 await hasta("document.querySelectorAll('.lista-instituciones [data-institucion]').length>0 && !document.querySelector('.crear-institucion').disabled");
 assert.equal(await evaluar("!document.getElementById('evento-administrado')&&!document.getElementById('cargo-administrado')"),true);
 await evaluar("document.querySelector('.crear-institucion').click();true");
 await hasta("!!document.getElementById('nombre-nueva-institucion')");
 assert.equal(await evaluar("document.querySelector('#formulario-nueva-institucion button[type=submit]').disabled"),true);
 const institucionNueva='Institución sintética UI '+Date.now();
 await evaluar(`(()=>{const el=document.getElementById('nombre-nueva-institucion');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(institucionNueva)});el.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
 await evaluar("document.querySelector('#formulario-nueva-institucion button[type=submit]').click();true");
 await hasta("!!document.querySelector('.ficha-institucion .institucion-activa') && !document.getElementById('nombre-nueva-institucion')");
 assert.equal(await evaluar(`(async()=>{const lista=await fetch('/api/v1/organizaciones').then(r=>r.json());const id=document.querySelector('[data-institucion][aria-pressed=true]')?.dataset.institucion;return lista.elementos.some(o=>o.idOrganizacion===id&&o.nombre===${JSON.stringify(institucionNueva)});})()`),true);
 await hasta("!!document.querySelector('.ficha-institucion button') && !document.querySelector('.ficha-institucion button').disabled");
 await hasta("!!document.querySelector('.cabecera-resumen-institucion button') && !document.querySelector('.cabecera-resumen-institucion button').disabled");
 await evaluar("document.querySelector('.cabecera-resumen-institucion button').click();true");
 await hasta("!!document.querySelector('.sin-cargos-institucion') && !document.querySelector('.agregar-cargo').disabled");
 assert.equal(await evaluar("!document.querySelector('.opciones-eleccion')&&!document.querySelector('.formulario-simple')&&!document.querySelector('.preparacion-eleccion')&&document.querySelectorAll('.seleccion-administracion select').length===0"),true,'Una institución vacía abre solo el listado, sin formulario ni desplegables');
 await evaluar("document.querySelector('.agregar-cargo').click();true");
 await hasta("!!document.querySelector('.opciones-eleccion')");
 assert.equal(await evaluar("document.querySelector('.preparacion-eleccion')===null"),true);
 await evaluar("document.querySelector('.control-pasos-preparacion').click();true");
 await hasta("document.querySelectorAll('.preparacion-eleccion li').length===6");
 await evaluar("document.querySelector('.control-pasos-preparacion').click();true");
 assert.equal(await evaluar("document.querySelector('.preparacion-eleccion')===null && !!document.querySelector('.opciones-eleccion')"),true,'Desactivar pasos conserva el formulario');
 await evaluar("document.querySelector('.control-pasos-preparacion').click();true");

 await evaluar("document.querySelector('.cancelar-cargo').click();true");
 await hasta("!!document.querySelector('.sin-cargos-institucion')");
 assert.equal(await evaluar("!document.querySelector('.opciones-eleccion')"),true,'Cancelar vuelve a la lista sin crear un cargo');
 await evaluar("document.querySelector('.contexto-modulo-admin button').click();true");
 await hasta("!!document.querySelector('.ficha-institucion button') && !document.querySelector('.ficha-institucion button').disabled");

 await evaluar("Array.from(document.querySelectorAll('.ficha-institucion button')).find(b=>b.textContent.includes('Volver a elegir')).click();true");
 await hasta("!document.getElementById('evento-administrado')&&!document.getElementById('cargo-administrado')");
 await evaluar("(async()=>{const publico=await fetch('/api/v1/publico/actual').then(r=>r.json());for(const b of document.querySelectorAll('.lista-instituciones [data-institucion]')){if(b.disabled)continue;const lista=await fetch('/api/v1/configuracion/procesos',{headers:{'X-Organizacion':b.dataset.institucion}}).then(r=>r.json());if(lista.elementos?.some(p=>p.id===publico?.id)){b.click();return true;}}throw Error('No hay elección sintética pública para la revisión');})()");
 await hasta("!!document.querySelector('.indicadores-institucion') && !document.querySelector('.cabecera-resumen-institucion button').disabled");
 assert.equal(await evaluar("!document.querySelector('.seleccion-administracion')&&!document.querySelector('.opciones-eleccion')"),true);
 assert.equal(await evaluar("!!(document.querySelector('.espacio-instituciones').compareDocumentPosition(document.querySelector('.resumen-institucion')) & Node.DOCUMENT_POSITION_FOLLOWING)"),true);
 assert.equal(await evaluar("document.querySelectorAll('.indicadores-institucion article').length===3 && !document.querySelector('[data-indicador=eventos]')"),true,'El resumen muestra solo candidatos, mesas y operadores');
 const institucionActiva=await evaluar("document.querySelector('[data-institucion][aria-pressed=true]').dataset.institucion");
 assert.equal(await evaluar("(async()=>{const org=document.querySelector('[data-institucion][aria-pressed=true]').dataset.institucion;const pro=await fetch('/api/v1/configuracion/procesos',{headers:{'X-Organizacion':org}}).then(r=>r.json());const usuarios=[];for(let pagina=1;pagina<=100;pagina++){const r=await fetch('/api/v1/usuarios?pagina='+pagina+'&limite=100',{headers:{'X-Organizacion':org}}).then(r=>r.json());usuarios.push(...r.elementos);if(usuarios.length>=r.total)break;}const activos=pro.elementos.filter(p=>p.estado!=='archivada');const valores={candidatos:activos.reduce((s,p)=>s+p.candidatos.length,0),mesas:new Set(activos.flatMap(p=>p.mesas.map(m=>m.idMesaFisica||m.id))).size,operadores:new Set(usuarios.filter(u=>u.activo&&u.roles.some(r=>r.rol==='OPERADOR'&&r.idOrganizacion===org)&&!u.roles.some(r=>r.rol==='ADMINISTRADOR'&&(r.idOrganizacion===null||r.idOrganizacion===org))).map(u=>u.idUsuario)).size};return Object.entries(valores).every(([k,v])=>Number(document.querySelector('[data-indicador='+k+']>strong').textContent)===v);})()"),true);
 for(const ancho of [390,768,1440]){await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:1000}});await esperar(250);assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Resumen desbordado a '+ancho+'px');}
 await hasta("!!document.querySelector('.vista-previa-resultados .enlace-resultados-cargo')");
 assert.equal(await evaluar("document.querySelector('.enlace-resultados-cargo').getAttribute('href')==='#resultados?proceso='+document.querySelector('.vista-previa-resultados').dataset.procesoPrevia && !document.querySelector('.vista-previa-resultados input')"),true);
 const resumen=await comando('browsingContext.captureScreenshot',{context});await writeFile('/tmp/tuvoto-admin-resumen.png',Buffer.from(resumen.data,'base64'));
 await evaluar("document.querySelector('.cabecera-resumen-institucion button').click();true");

 await hasta("document.querySelectorAll('[data-cargo]').length>0 && !document.querySelector('.agregar-cargo').disabled");
 assert.equal(await evaluar("!document.getElementById('evento-administrado')&&!document.getElementById('cargo-administrado')&&!document.querySelector('.formulario-simple')&&!document.querySelector('.preparacion-eleccion')"),true,'La entrada muestra solo los cargos y el botón de agregar');
 assert.equal(await evaluar("(async()=>{const org=document.querySelector('.contexto-modulo-admin').dataset.contextoInstitucion;const lista=await fetch('/api/v1/configuracion/procesos',{headers:{'X-Organizacion':org}}).then(r=>r.json());const ids=Array.from(document.querySelectorAll('[data-cargo]'),b=>b.dataset.cargo);return ids.length===lista.elementos.length && lista.elementos.every(p=>ids.includes(p.id));})()"),true,'El listado incluye todos los cargos e históricos sin filtrarlos por nombre');

 assert.equal(await evaluar("Array.from(document.querySelectorAll('[data-grupo-cargos]')).every(g=>!g.open)"),true,'Los grupos empiezan cerrados para elegir qué consultar');
 assert.equal(await evaluar("(async()=>{const org=document.querySelector('.contexto-modulo-admin').dataset.contextoInstitucion;const ps=(await fetch('/api/v1/configuracion/procesos',{headers:{'X-Organizacion':org}}).then(r=>r.json())).elementos;const familias={rectorado:'Rector',vicerrectorado:'Vicerrector',decanos:'Decano',directores:'Director'};let total=0;for(const g of document.querySelectorAll('[data-grupo-cargos]')){const ids=Array.from(g.querySelectorAll('[data-cargo]'),b=>b.dataset.cargo),n=Number(g.querySelector('[data-cantidad]').dataset.cantidad);if(ids.length!==n)return false;total+=n;const cargo=familias[g.dataset.grupoCargos];if(cargo&&(ps.filter(p=>p.cargo===cargo).length!==n||ids.some(id=>ps.find(p=>p.id===id)?.cargo!==cargo)))return false;}return total===ps.length;})()"),true,'Cada cantidad y grupo corresponde a sus cargos reales de la API');
 const cantidadGrupos=await evaluar("document.querySelectorAll('[data-grupo-cargos]').length");
 for(let i=0;i<cantidadGrupos;i++){
  await evaluar(`document.querySelectorAll('[data-grupo-cargos]')[${i}].querySelector('summary').click();true`);
  assert.equal(await evaluar(`(()=>{const g=document.querySelectorAll('[data-grupo-cargos]')[${i}];return g.open&&g.querySelector('.lista-cargos-institucion').getBoundingClientRect().height>0&&g.querySelectorAll('[data-cargo]').length===Number(g.querySelector('[data-cantidad]').dataset.cantidad);})()`),true,'Pulsar un grupo despliega todos sus cargos');
  await evaluar(`document.querySelectorAll('[data-grupo-cargos]')[${i}].querySelector('summary').click();true`);
  assert.equal(await evaluar(`!document.querySelectorAll('[data-grupo-cargos]')[${i}].open`),true,'Pulsar otra vez cierra el grupo sin modificar registros');
 }

 for(const ancho of [390,768,1440]){await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:1000}});await evaluar("document.querySelector('.seleccion-administracion').scrollIntoView({block:'start'});true");assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Lista de cargos desbordada a '+ancho+'px');const captura=await comando('browsingContext.captureScreenshot',{context});await writeFile('/tmp/tuvoto-lista-cargos-'+ancho+'.png',Buffer.from(captura.data,'base64'));}
 const cargoActivo=await evaluar("(async()=>{const p=await fetch('/api/v1/publico/actual').then(r=>r.json());return p.id;})()");
 const cargoAlternativo=await evaluar(`Array.from(document.querySelectorAll('[data-cargo]')).find(b=>b.dataset.cargo!==${JSON.stringify(cargoActivo)})?.dataset.cargo`);
 if(cargoAlternativo){
  await abrirCargoEnGrupo(cargoAlternativo);
  await evaluar(`Array.from(document.querySelectorAll('[data-cargo]')).find(b=>b.dataset.cargo===${JSON.stringify(cargoAlternativo)}).click();true`);
  await hasta("!!document.querySelector('.detalle-configuracion-eleccion')");
  assert.equal(await evaluar("document.querySelector('.contexto-modulo-admin').dataset.contextoProceso"),cargoAlternativo);
  await evaluar("document.querySelector('.volver-cargos').click();true");
  await hasta("!!document.querySelector('.lista-cargos-institucion')");
 }
  await abrirCargoEnGrupo(cargoActivo);
 await evaluar(`Array.from(document.querySelectorAll('[data-cargo]')).find(b=>b.dataset.cargo===${JSON.stringify(cargoActivo)}).click();true`);
 await hasta("!!document.querySelector('.detalle-configuracion-eleccion')");
 for(const modulo of ['Usuarios','Mesas','Candidatos']){
  await evaluar(`Array.from(document.querySelectorAll('.item-menu-lateral')).find(b=>b.textContent.trim()===${JSON.stringify(modulo)}).click();true`);
  await hasta("!!document.querySelector('.contexto-modulo-admin')");
  assert.equal(await evaluar("!document.querySelector('.espacio-instituciones')&&!document.querySelector('.seleccion-administracion')"),true);
  assert.equal(await evaluar("document.querySelector('.contexto-modulo-admin').dataset.contextoInstitucion"),institucionActiva);
  assert.equal(await evaluar("document.querySelector('.contexto-modulo-admin').dataset.contextoProceso"),cargoActivo);
  assert.equal(await evaluar("!!document.querySelector('.elegir-cargo-existente') && !!document.querySelector('.crear-cargo-directo')"),true,'El módulo ofrece elegir uno guardado o crear un cargo nuevo');
 }
 // Crear desde Candidatos no edita el seleccionado ni guarda datos al cambiar de vista.
 const catalogoAntesElegir=await evaluar("(async()=>{const org=document.querySelector('.contexto-modulo-admin').dataset.contextoInstitucion;return JSON.stringify((await fetch('/api/v1/configuracion/procesos',{headers:{'X-Organizacion':org}}).then(r=>r.json())).elementos.sort((a,b)=>a.id.localeCompare(b.id)));})()");
 await evaluar("document.querySelector('.crear-cargo-directo').click();true");
 await hasta("!!document.querySelector('.elegir-existente-desde-formulario') && !!document.querySelector('[aria-label=\"Cargo universitario\"]')");
 assert.equal(await evaluar("document.querySelector('[aria-label=\"Cargo universitario\"]').value==='' && document.querySelector('.contexto-modulo-admin').textContent.includes('Nuevo cargo') && !document.querySelector('.detalle-configuracion-eleccion')"),true,'El formulario nuevo no reutiliza el cargo seleccionado');
 await evaluar("document.querySelector('.elegir-existente-desde-formulario').click();true");
 await hasta("!!document.querySelector('[data-grupo-cargos]') && !!document.querySelector('.agregar-cargo')");
 const cargoParaElegir=cargoAlternativo??cargoActivo;
 await abrirCargoEnGrupo(cargoParaElegir);
 await evaluar(`Array.from(document.querySelectorAll('[data-cargo]')).find(b=>b.dataset.cargo===${JSON.stringify(cargoParaElegir)}).click();true`);
 await hasta("!!document.querySelector('.detalle-configuracion-eleccion') && !!document.querySelector('.elegir-cargo-existente')");
 assert.equal(await evaluar("document.querySelector('.contexto-modulo-admin').dataset.contextoProceso"),cargoParaElegir);
 assert.equal(await evaluar("!!document.querySelector('.crear-cargo-directo')"),true,'Se puede crear otro cargo también desde el detalle');
 for(const ancho of [390,768,1440]){await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:1000}});assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Acciones de cargo desbordadas a '+ancho+'px');}
 await evaluar("document.querySelector('.elegir-cargo-existente').click();true");
 await hasta("!!document.querySelector('[data-grupo-cargos]')");
 await abrirCargoEnGrupo(cargoActivo);
 await evaluar(`Array.from(document.querySelectorAll('[data-cargo]')).find(b=>b.dataset.cargo===${JSON.stringify(cargoActivo)}).click();true`);
 await hasta("!!document.querySelector('.detalle-configuracion-eleccion')");
 assert.equal(await evaluar(`(async()=>{const org=document.querySelector('.contexto-modulo-admin').dataset.contextoInstitucion;const ps=(await fetch('/api/v1/configuracion/procesos',{headers:{'X-Organizacion':org}}).then(r=>r.json())).elementos.sort((a,b)=>a.id.localeCompare(b.id));return JSON.stringify(ps)===${JSON.stringify(catalogoAntesElegir)};})()`),true,'Crear/cancelar/elegir no modifica los cargos persistidos');
 await evaluar("document.querySelector('.contexto-modulo-admin button').click();true");
 await hasta("!!document.querySelector('.indicadores-institucion')");
 await evaluar("document.querySelector('.cabecera-resumen-institucion button').click();true");
 await hasta("!!document.querySelector('.lista-cargos-institucion')");
 assert.equal(await evaluar("document.querySelector('[data-cargo][aria-pressed=true]').dataset.cargo"),cargoActivo);
 await evaluar("document.querySelector('.contexto-modulo-admin button').click();true");
 await hasta("!!document.querySelector('.indicadores-institucion')");
 await evaluar("document.querySelector('.lista-accesos-resumen button:nth-child(2)').click();true");
 await hasta("!!document.querySelector('.contexto-modulo-admin')");
 assert.equal(await evaluar("document.querySelector('.titulo-seccion-privada h1').textContent"),'Candidatos');
 assert.equal(await evaluar("document.querySelector('.control-guia-lateral')===null"),true);
 await evaluar("Array.from(document.querySelectorAll('.menu-lateral button, .item-menu-lateral')).find(b=>b.textContent.includes('Estado y publicación')).click();true");
 await hasta("!!document.querySelector('.control-estado')");
 assert.equal(await evaluar("document.querySelector('.control-estado').innerText.includes('En recepción')"),true);
 await evaluar("Array.from(document.querySelectorAll('.control-estado button')).find(b=>b.textContent==='Terminar conteo').click();true");
 assert.equal(await evaluar("document.querySelector('.confirmacion-estado .primario').disabled"),true);
 await evaluar("Array.from(document.querySelectorAll('.confirmacion-estado button')).find(b=>b.textContent==='Cancelar').click();true");
 await evaluar("document.querySelector('.contexto-modulo-admin button').click();true");
 await hasta("!!document.querySelector('.indicadores-institucion')");
 await evaluar("document.querySelector('.cabecera-resumen-institucion button').click();true");
 await hasta("!!document.querySelector('.seleccion-administracion')");
 await evaluar("document.querySelector('.agregar-cargo').click();true");
 await hasta("!!document.querySelector('.opciones-eleccion')");
 assert.equal(await evaluar("document.querySelector('.seleccion-administracion')===null"),true,'No debe mostrar la elección anterior al crear una nueva');
 assert.equal(await evaluar("document.querySelector('.contexto-modulo-admin').textContent.includes('Nuevo cargo')"),true);
 // Detecta compresión interna y solapamientos, aunque la página no desborde.
 for(const ancho of [390,768,1440]){
  await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:1000}});
  await esperar(250);
  await evaluar("document.querySelector('.preparacion-eleccion').scrollIntoView({block:'start'});true");
  const captura=await comando('browsingContext.captureScreenshot',{context});
  await writeFile('/tmp/tuvoto-pasos-eleccion-'+ancho+'.png',Buffer.from(captura.data,'base64'));
  assert.equal(await evaluar("(()=>{const panel=document.querySelector('.preparacion-eleccion');const ancho=panel.getBoundingClientRect().width;return panel.querySelector('nav').getBoundingClientRect().width>=ancho-48;})()"),true,'La navegación de pasos está comprimida a '+ancho+'px');
  assert.equal(await evaluar("(()=>{const panel=document.querySelector('.preparacion-eleccion'),cabecera=panel.querySelector('.cabecera-pasos').getBoundingClientRect(),nav=panel.querySelector('nav').getBoundingClientRect(),acciones=panel.querySelector('.acciones-pasos').getBoundingClientRect();return nav.top>=cabecera.bottom && acciones.top>=nav.bottom;})()"),true,'Los pasos se solapan a '+ancho+'px');
  assert.equal(await evaluar("Array.from(document.querySelectorAll('.preparacion-eleccion nav button')).every(b=>b.getBoundingClientRect().width>=90&&b.scrollWidth<=b.clientWidth+1)"),true,'Los pasos no tienen espacio legible a '+ancho+'px');
 }
 await evaluar("Array.from(document.querySelectorAll('.opciones-eleccion label')).find(l=>l.textContent.includes('Separar mesas')).querySelector('input').click();true");
 await hasta("!!Array.from(document.querySelectorAll('.opciones-eleccion label')).find(l=>l.textContent.includes('Activar ponderación'))");
 await evaluar("Array.from(document.querySelectorAll('.opciones-eleccion label')).find(l=>l.textContent.includes('Activar ponderación')).querySelector('input').click();true");
 assert.equal(await evaluar("document.querySelectorAll('.fila-sector-configuracion').length"),2);
 assert.equal(await evaluar("Array.from(document.querySelectorAll('.fila-sector-configuracion input[pattern]')).every(el=>{const expresion=new RegExp('^(?:'+el.pattern+')$','v');const original=el.value;el.value='docentes_';const invalido=el.validity.patternMismatch;el.value=original;return invalido && !el.validity.patternMismatch && expresion.test('sector-1') && expresion.test('docentes') && !expresion.test('Docentes') && !expresion.test('docentes_');})"),true,'El navegador valida los códigos de sector sin errores de expresión regular');
 await evaluar("Array.from(document.querySelectorAll('.opciones-eleccion label')).find(l=>l.textContent.includes('Activar indicador')).querySelector('input').click();true");
 await hasta("document.querySelector('.opciones-eleccion').innerText.includes('Porcentaje requerido')");
 for(const ancho of [390,768,1440]){await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:1000}});await esperar(300);assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Desbordamiento a '+ancho+'px');await evaluar("document.querySelector('.opciones-eleccion').closest('form').scrollIntoView({block:'start'});true");const captura=await comando('browsingContext.captureScreenshot',{context});await writeFile('/tmp/tuvoto-admin-formulario-'+ancho+'.png',Buffer.from(captura.data,'base64'));}
 // Elección y mesas exclusivamente sintéticas: comprobar Excel real desde el navegador.
 const cargoEleccion='Decano';
 const facultadEleccion='Facultad sintética UI '+Date.now();
 const nombreInstitucion=await evaluar("document.querySelector('.contexto-modulo-admin strong').textContent");
 assert.equal(await evaluar("!Array.from(document.querySelectorAll('.formulario-simple label')).some(l=>l.textContent.includes('Nombre del evento electoral')) && !document.querySelector('select[aria-label=\"Evento al que pertenece el cargo\"]') && !document.querySelector('.formulario-simple').textContent.includes('Nombre del evento electoral')"),true,'La creación no pide un nombre ni una selección manual de evento');
 await evaluar(`(()=>{const el=document.querySelector('[aria-label="Cargo universitario"]');el.value=${JSON.stringify(cargoEleccion)};el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
 await evaluar(`(()=>{const el=document.querySelector('[aria-label="Facultad del cargo"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(facultadEleccion)});el.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
 await comando('browsingContext.setViewport',{context,viewport:{width:390,height:844}});
 await evaluar("document.querySelector('.opciones-eleccion').closest('form').querySelector('button.primario').scrollIntoView({block:'center'});true");
 await evaluar("document.querySelector('.opciones-eleccion').closest('form').querySelector('button.primario').click();true");
 await hasta("document.querySelector('.titulo-seccion-privada h1')?.textContent==='Candidatos' && !!document.querySelector('.totales-candidatos') && !Array.from(document.querySelectorAll('.item-menu-lateral')).find(b=>b.textContent.trim()==='Mesas')?.disabled");
 assert.equal(await evaluar("(()=>{const r=document.querySelector('.preparacion-eleccion').getBoundingClientRect();return r.top>=0 && r.top<innerHeight;})()"),true,'El paso siguiente debe quedar visible después de guardar');
 const procesoCreado=await evaluar("document.querySelector('.contexto-modulo-admin').dataset.contextoProceso");
 assert.equal(await evaluar(`(async()=>{const org=document.querySelector('.contexto-modulo-admin').dataset.contextoInstitucion;const p=await fetch('/api/v1/configuracion/procesos/'+${JSON.stringify(procesoCreado)},{headers:{'X-Organizacion':org}}).then(r=>r.json());return p.nombre===${JSON.stringify(nombreInstitucion.slice(0,120))}&&p.cargo===${JSON.stringify(cargoEleccion)}&&p.estado==='borrador';})()`),true,'La API persistió el nombre automático de la institución');
 assert.equal(await evaluar("document.querySelectorAll('.preparacion-eleccion li').length"),6);
 assert.equal(await evaluar("document.querySelector('.preparacion-eleccion [aria-current=step]').textContent.includes('Candidatos')"),true);
 for(const ancho of [390,768,1440]){await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:1000}});assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Pasos desbordados a '+ancho+'px');}
 await evaluar("document.querySelector('.acciones-pasos button').click();true");
 await hasta("!!document.querySelector('.detalle-configuracion-eleccion')");
 await evaluar("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Editar elección en borrador').click();true");
 await hasta("!!document.querySelector('.opciones-eleccion')");
 assert.equal(await evaluar("!Array.from(document.querySelectorAll('.formulario-simple label')).some(l=>l.textContent.includes('Nombre del evento electoral'))"),true,'La edición tampoco solicita nombre de evento');
 await evaluar("(()=>{const el=document.querySelector('[aria-label=\"Facultad del cargo\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'Ámbito sintético editado');el.dispatchEvent(new Event('input',{bubbles:true}));return true;})()");
 await evaluar("document.querySelector('.opciones-eleccion').closest('form').querySelector('button.primario').click();true");
 await hasta("document.querySelector('.titulo-seccion-privada h1')?.textContent==='Candidatos' && !document.querySelector('.item-menu-lateral').disabled");
 assert.equal(await evaluar(`(async()=>{const org=document.querySelector('.contexto-modulo-admin').dataset.contextoInstitucion;const p=await fetch('/api/v1/configuracion/procesos/'+${JSON.stringify(procesoCreado)},{headers:{'X-Organizacion':org}}).then(r=>r.json());return p.nombre===${JSON.stringify(nombreInstitucion.slice(0,120))}&&p.facultad==='Ámbito sintético editado';})()`),true,'Editar conserva el nombre y guarda las opciones');

 await evaluar("Array.from(document.querySelectorAll('.preparacion-eleccion nav button')).find(b=>b.textContent.includes('Asignar mesas')).click();true");
 await hasta("document.querySelector('.titulo-seccion-privada h1')?.textContent==='Asignar operadores'");
 assert.equal(await evaluar("!document.querySelector('.formulario-simple input[type=checkbox]')&&!document.querySelector('.formulario-simple').textContent.includes('todos los candidatos')"),true,'Asignar no exige confirmar todos los candidatos');
 assert.equal(await evaluar("document.querySelector('.preparacion-eleccion nav li:last-child button')?.textContent.includes('Datos guardados')"),false);
 await evaluar("document.querySelector('.cabecera-pasos button').click();true");
 await hasta("!!document.querySelector('.indicadores-institucion')");
 await evaluar("document.querySelector('.cabecera-resumen-institucion button').click();true");
 await hasta("!!document.querySelector('.lista-cargos-institucion')");
 assert.equal(await evaluar("!document.querySelector('.formulario-simple')"),true);
  await abrirCargoEnGrupo(procesoCreado);
 await evaluar(`Array.from(document.querySelectorAll('[data-cargo]')).find(b=>b.dataset.cargo===${JSON.stringify(procesoCreado)}).click();true`);
 await hasta("!!document.querySelector('.detalle-configuracion-eleccion')");
 assert.equal(await evaluar("document.querySelectorAll('.preparacion-eleccion li').length"),6);
 const procesoExcel=await evaluar("document.querySelector('.contexto-modulo-admin').dataset.contextoProceso");
 await evaluar("Array.from(document.querySelectorAll('.item-menu-lateral')).find(b=>b.textContent.trim()==='Mesas').click();true");
 await hasta("!!document.querySelector('[data-importacion=mesas] input[type=file]')");
 const cargarExcel=createRequire(new URL('../../microservicios/elecciones/package.json',import.meta.url));const ExcelJS=cargarExcel('exceljs');
 const plantillaMesas=await evaluar(`(async()=>{const org=document.querySelector('.contexto-modulo-admin').dataset.contextoInstitucion;const r=await fetch('/api/v1/configuracion/procesos/'+${JSON.stringify(procesoExcel)}+'/importaciones/mesas/plantilla',{headers:{'X-Organizacion':org}});if(!r.ok)throw Error('Plantilla no disponible');const a=new Uint8Array(await r.arrayBuffer());return btoa(String.fromCharCode(...a));})()`);
 const libro=new ExcelJS.Workbook();await libro.xlsx.load(Buffer.from(plantillaMesas,'base64'));const hoja=libro.worksheets[0];hoja.addRow(['TEC-UI-001','Facultad sintética de Tecnología','docentes']);hoja.addRow(['SAL-UI-001','Facultad sintética de Salud','estudiantes']);
 const archivoMesas=Buffer.from(await libro.xlsx.writeBuffer()).toString('base64');
 await evaluar(`(()=>{const contenido=Uint8Array.from(atob(${JSON.stringify(archivoMesas)}),c=>c.charCodeAt(0));const archivo=new File([contenido],'mesas-sinteticas.xlsx',{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const datos=new DataTransfer();datos.items.add(archivo);const entrada=document.querySelector('[data-importacion=mesas] input[type=file]');entrada.files=datos.files;entrada.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
 await hasta("!!Array.from(document.querySelectorAll('[data-importacion=mesas] button')).find(b=>b.textContent==='Revisar archivo'&&!b.disabled)");
 await evaluar("Array.from(document.querySelectorAll('[data-importacion=mesas] button')).find(b=>b.textContent==='Revisar archivo').click();true");
 await hasta("document.querySelectorAll('[data-importacion=mesas] tbody tr').length===2");
 await evaluar("document.querySelector('[data-importacion=mesas] input[type=checkbox]').click();true");
 await evaluar("Array.from(document.querySelectorAll('[data-importacion=mesas] button')).find(b=>b.textContent==='Confirmar importación').click();true");
 await hasta("document.querySelectorAll('.grupo-mesas-unidad').length===2");
 assert.equal(await evaluar(`(async()=>{const org=document.querySelector('.contexto-modulo-admin').dataset.contextoInstitucion;const p=await fetch('/api/v1/configuracion/procesos/'+${JSON.stringify(procesoExcel)},{headers:{'X-Organizacion':org}}).then(r=>r.json());return p.estado==='borrador'&&p.mesas.length===2&&p.mesas.some(m=>m.codigo==='TEC-UI-001'&&m.unidad==='Facultad sintética de Tecnología'&&m.sector==='docentes')&&p.mesas.some(m=>m.codigo==='SAL-UI-001'&&m.unidad==='Facultad sintética de Salud'&&m.sector==='estudiantes');})()`),true);
 // Asignar desde el formulario antes de registrar candidatos; completar el catálogo después.
 await hasta("!document.querySelector('.item-menu-lateral').disabled");
 await evaluar("Array.from(document.querySelectorAll('.item-menu-lateral')).find(b=>b.textContent.trim()==='Asignar operadores').click();true");
 await hasta("document.querySelectorAll('.formulario-simple select').length===2 && document.querySelectorAll('.formulario-simple select')[1].options.length>1");
 await evaluar("(()=>{const el=document.querySelectorAll('.formulario-simple select')[0];el.value=Array.from(el.options).find(o=>o.value).value;el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
 await evaluar("(()=>{const el=document.querySelectorAll('.formulario-simple select')[1];el.value=Array.from(el.options).find(o=>o.value).value;el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
 await hasta("!document.querySelector('.formulario-simple button.primario').disabled");
 assert.equal(await evaluar("!document.querySelector('.formulario-simple input[type=checkbox]')"),true);
 await evaluar("document.querySelector('.formulario-simple button.primario').click();true");
 await hasta("document.querySelectorAll('.formularios-preparacion-mesas ul li').length===1 && !document.querySelector('.item-menu-lateral').disabled");
 assert.equal(await evaluar(`(async()=>{const org=document.querySelector('.contexto-modulo-admin').dataset.contextoInstitucion;const p=await fetch('/api/v1/configuracion/procesos/'+${JSON.stringify(procesoCreado)},{headers:{'X-Organizacion':org}}).then(r=>r.json());const a=await fetch('/api/v1/configuracion/procesos/'+p.id+'/asignaciones',{headers:{'X-Organizacion':org}}).then(r=>r.json());return p.candidatos.length===0&&p.estado==='borrador'&&a.elementos.length===1;})()`),true,'Formulario de asignación persistió sin candidatos');
 await hasta("document.querySelectorAll('.mesas-por-operador [data-operador]').length>0");
 assert.equal(await evaluar("(async()=>{const org=document.querySelector('.contexto-modulo-admin').dataset.contextoInstitucion;const r=await fetch('/api/v1/configuracion/asignaciones',{headers:{'X-Organizacion':org}}).then(r=>r.json());return r.elementos.every(a=>{const el=Array.from(document.querySelectorAll('.mesas-por-operador [data-operador]')).find(e=>e.dataset.operador===a.idUsuario);return el&&el.textContent.includes(a.codigo)&&el.textContent.includes(a.cargo);});})()"),true,'Cada operador muestra sus mesas y cargos reales');
 for(const ancho of [390,768,1440]){await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:1000}});assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Asignaciones por operador desbordadas a '+ancho+'px');}

 await evaluar("Array.from(document.querySelectorAll('.preparacion-eleccion nav button')).find(b=>b.textContent.includes('Candidatos')).click();true");
 await hasta("!!document.querySelector('.candidatos-administracion .gestionar-candidatos') && !document.querySelector('.gestionar-candidatos').disabled");
 await evaluar("document.querySelector('.gestionar-candidatos').click();true");
 await hasta("!!document.querySelector('.grid-candidatos-fotos')");
 await evaluar("(()=>{const el=document.querySelector('.formulario-simple input:not([type=file])');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'Candidatura sintética del flujo');el.dispatchEvent(new Event('input',{bubbles:true}));return true;})()");
 await evaluar("document.querySelector('.formulario-simple button[value=continuar]').click();true");
 await hasta("document.querySelector('.titulo-seccion-privada h1')?.textContent==='Mesas de recepción' && !document.querySelector('.item-menu-lateral').disabled");
 assert.equal(await evaluar("Array.from(document.querySelectorAll('.preparacion-eleccion nav button')).find(b=>b.textContent.includes('Candidatos')).classList.contains('paso-guardado')"),true);
 await evaluar("document.querySelector('.control-pasos-preparacion').click();true");
 assert.equal(await evaluar("!document.querySelector('.preparacion-eleccion')"),true);
 await comando('browsingContext.reload',{context,wait:'complete'});
 await hasta("!!document.querySelector('.control-pasos-preparacion') && !!document.querySelector('.lista-instituciones')");
 assert.equal(await evaluar("document.querySelector('.control-pasos-preparacion').getAttribute('aria-pressed')"),'false','Preferencia recordada al recargar sin almacenar credenciales');
 await hasta(`!!Array.from(document.querySelectorAll('[data-institucion]')).find(b=>b.dataset.institucion===${JSON.stringify(institucionActiva)}&&!b.disabled)`);
 await evaluar(`Array.from(document.querySelectorAll('[data-institucion]')).find(b=>b.dataset.institucion===${JSON.stringify(institucionActiva)}).click();true`);
 await hasta("!!document.querySelector('.cabecera-resumen-institucion button') && !document.querySelector('.cabecera-resumen-institucion button').disabled");
 await evaluar("document.querySelector('.cabecera-resumen-institucion button').click();true");
 await hasta("!!document.querySelector('[data-importacion=cargos] summary')");
 await evaluar("document.querySelector('[data-importacion=cargos] summary').click();true");
 const plantillaCargos=await evaluar("(async()=>{const org=document.querySelector('.contexto-modulo-admin').dataset.contextoInstitucion;const r=await fetch('/api/v1/configuracion/importaciones/cargos/plantilla',{headers:{'X-Organizacion':org}});if(!r.ok)throw Error('Plantilla cargos no disponible');return btoa(String.fromCharCode(...new Uint8Array(await r.arrayBuffer())));})()");
 // Reproducir 34 filas con 20 errores: la tabla válida no habilita un lote incompleto.
 const libroIncompleto=new ExcelJS.Workbook();await libroIncompleto.xlsx.load(Buffer.from(plantillaCargos,'base64'));
 for(let i=1;i<=14;i++)libroIncompleto.worksheets[0].addRow(['Decano','Facultad de revisión sintética '+Date.now()+' '+i,'','']);
 for(let i=1;i<=20;i++)libroIncompleto.worksheets[0].addRow(['Director','','Grupo pendiente '+i,'']);
 const archivoIncompleto=Buffer.from(await libroIncompleto.xlsx.writeBuffer()).toString('base64');
 const cargosAntesIncompleto=await evaluar("document.querySelectorAll('[data-cargo]').length");
 await evaluar(`(()=>{const d=new DataTransfer();d.items.add(new File([Uint8Array.from(atob(${JSON.stringify(archivoIncompleto)}),c=>c.charCodeAt(0))],'cargos-incompletos-sinteticos.xlsx'));const el=document.querySelector('[data-importacion=cargos] input[type=file]');el.files=d.files;el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
 await hasta("!!Array.from(document.querySelectorAll('[data-importacion=cargos] button')).find(b=>b.textContent==='Revisar archivo'&&!b.disabled)");
 await evaluar("Array.from(document.querySelectorAll('[data-importacion=cargos] button')).find(b=>b.textContent==='Revisar archivo').click();true");
 await hasta("document.querySelector('[data-importacion=cargos] [data-estado-confirmacion=bloqueada]')?.textContent.includes('20 errores pendientes')");
 assert.equal(await evaluar("document.querySelectorAll('[data-importacion=cargos] tbody tr').length"),14);
 assert.equal(await evaluar("document.querySelector('[data-importacion=cargos] input[type=checkbox]').disabled"),true);
 assert.equal(await evaluar("Array.from(document.querySelectorAll('[data-importacion=cargos] button')).find(b=>b.textContent==='Confirmar importación').disabled"),true);
 assert.equal(await evaluar("(()=>{const e=document.querySelector('[data-importacion=cargos] input[type=checkbox]');return document.getElementById(e.getAttribute('aria-describedby')).textContent.includes('20 errores pendientes');})()"),true,'La casilla explica el bloqueo mediante aria-describedby');
 for(const ancho of [390,768,1440]){
  await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:1000}});
  await evaluar("document.querySelector('[data-importacion=cargos] .estado-confirmacion-importacion').scrollIntoView({block:'center'});true");
  assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Aviso de confirmación desbordado a '+ancho+'px');
  if(ancho===390){assert.equal(await evaluar("document.querySelector('[data-importacion=cargos] .tabla-preparacion-scroll').scrollWidth>document.querySelector('[data-importacion=cargos] .tabla-preparacion-scroll').clientWidth && document.querySelector('[data-importacion=cargos] tbody tr:last-child').getBoundingClientRect().height<160"),true,'La tabla se desplaza dentro de su cuadro sin romper los nombres letra por letra');const c=await comando('browsingContext.captureScreenshot',{context});await writeFile('/tmp/tuvoto-confirmacion-bloqueada-390.png',Buffer.from(c.data,'base64'));}
 }
 await evaluar("Array.from(document.querySelectorAll('[data-importacion=cargos] button')).find(b=>b.textContent==='Ver errores del archivo (20)').click();true");
 assert.equal(await evaluar("document.activeElement.matches('.errores-importacion')"),true,'Ver errores lleva el foco a las filas que faltan corregir');
 assert.equal(await evaluar("document.querySelectorAll('[data-cargo]').length"),cargosAntesIncompleto,'Revisar un archivo inválido no crea cargos');
 const libroCargos=new ExcelJS.Workbook();await libroCargos.xlsx.load(Buffer.from(plantillaCargos,'base64'));libroCargos.worksheets[0].addRow(['Director','Facultad UI '+Date.now(),'Grupo A','Sistemas; Civil']);libroCargos.worksheets[0].addRow(['Director','Facultad UI B '+Date.now(),'Grupo B','Química; Industrial']);
 const antesCargos=await evaluar("document.querySelectorAll('[data-cargo]').length");
 const archivoCargos=Buffer.from(await libroCargos.xlsx.writeBuffer()).toString('base64');
 await evaluar(`(()=>{const datos=new DataTransfer();datos.items.add(new File([Uint8Array.from(atob(${JSON.stringify(archivoCargos)}),c=>c.charCodeAt(0))],'cargos-sinteticos.xlsx'));const el=document.querySelector('[data-importacion=cargos] input[type=file]');el.files=datos.files;el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
 await hasta("!!Array.from(document.querySelectorAll('[data-importacion=cargos] button')).find(b=>b.textContent==='Revisar archivo'&&!b.disabled)");
 await evaluar("Array.from(document.querySelectorAll('[data-importacion=cargos] button')).find(b=>b.textContent==='Revisar archivo').click();true");
 await hasta("document.querySelectorAll('[data-importacion=cargos] tbody tr').length===2");
 assert.equal(await evaluar("!!document.querySelector('[data-importacion=cargos] [data-estado-confirmacion=lista]') && !document.querySelector('[data-importacion=cargos] input[type=checkbox]').disabled"),true,'Sustituir el archivo por uno válido permite marcar y confirmar');
 await evaluar("document.querySelector('[data-importacion=cargos] input[type=checkbox]').click();true");
 await evaluar("Array.from(document.querySelectorAll('[data-importacion=cargos] button')).find(b=>b.textContent==='Confirmar importación').click();true");
 await hasta("document.querySelectorAll('[data-cargo]').length==="+(antesCargos+2));
 assert.equal(await evaluar("(async()=>{const org=document.querySelector('.contexto-modulo-admin').dataset.contextoInstitucion;const r=await fetch('/api/v1/configuracion/procesos',{headers:{'X-Organizacion':org}}).then(r=>r.json());return r.elementos.filter(p=>p.cargo==='Director'&&p.facultad?.startsWith('Facultad UI')).length>=2;})()"),true,'Excel de cargos persistido desde React');
 // Un solo archivo de candidatos para dos cargos, con revisión explícita de una etiqueta distinta.
 const directoresUi=JSON.parse(await evaluar("(async()=>{const org=document.querySelector('.contexto-modulo-admin').dataset.contextoInstitucion;const r=await fetch('/api/v1/configuracion/procesos',{headers:{'X-Organizacion':org}}).then(r=>r.json());return JSON.stringify(r.elementos.filter(p=>p.cargo==='Director'&&p.facultad?.startsWith('Facultad UI')).slice(0,2));})()"));
 assert.equal(directoresUi.length,2);
  await abrirCargoEnGrupo(directoresUi[0].id);
 await evaluar(`Array.from(document.querySelectorAll('[data-cargo]')).find(b=>b.dataset.cargo===${JSON.stringify(directoresUi[0].id)}).click();true`);
 await hasta("!!document.querySelector('.detalle-configuracion-eleccion')");
 await evaluar("Array.from(document.querySelectorAll('.item-menu-lateral')).find(b=>b.textContent.trim()==='Candidatos').click();true");
 await hasta("!!document.querySelector('[data-importacion=candidatos-general] summary')");

 const libroGeneral=new ExcelJS.Workbook();const hojaGeneral=libroGeneral.addWorksheet('Datos');hojaGeneral.addRow(['cargo','ambito','vuelta','nombre','orden']);
 hojaGeneral.addRow(['Director',directoresUi[0].ambito,1,'Postulante UI global A',1]);hojaGeneral.addRow(['Director','Etiqueta sintética del archivo',1,'Postulante UI global B',1]);
 const archivoGeneral=Buffer.from(await libroGeneral.xlsx.writeBuffer()).toString('base64');

 // Solo queda la importación conjunta; el registro manual se elige desde su cargo.
 assert.equal(await evaluar("!document.querySelector('[data-importacion=candidatos]') && document.querySelectorAll('[data-importacion=candidatos-general]').length===1"),true,'No hay dos importaciones de candidatos con formatos distintos');
 await evaluar("document.querySelector('[data-importacion=candidatos-general]').open=true;true");

 await evaluar(`(()=>{const datos=new DataTransfer();datos.items.add(new File([Uint8Array.from(atob(${JSON.stringify(archivoGeneral)}),c=>c.charCodeAt(0))],'todos-los-candidatos.xlsx'));const el=document.querySelector('[data-importacion=candidatos-general] input[type=file]');el.files=datos.files;el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
 await hasta("!!Array.from(document.querySelectorAll('[data-importacion=candidatos-general] button')).find(b=>b.textContent==='Revisar archivo'&&!b.disabled)");
 await evaluar("Array.from(document.querySelectorAll('[data-importacion=candidatos-general] button')).find(b=>b.textContent==='Revisar archivo').click();true");
 await hasta("document.querySelectorAll('[data-importacion=candidatos-general] .destinos-importacion select').length===2");
 assert.equal(await evaluar("document.querySelector('[data-importacion=candidatos-general] input[type=checkbox]').disabled"),true,'No permite confirmar un destino sin resolver');
 await evaluar(`(()=>{const el=document.querySelectorAll('[data-importacion=candidatos-general] .destinos-importacion select')[1];el.value=${JSON.stringify(directoresUi[1].id)};el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
 await hasta("document.querySelector('[data-importacion=candidatos-general] [role=status]')?.textContent.includes('Revisar archivo')");
 assert.equal(await evaluar("document.querySelector('[data-importacion=candidatos-general] input[type=checkbox]').disabled"),true,'Elegir un UUID exige nueva vista previa');
 await evaluar("Array.from(document.querySelectorAll('[data-importacion=candidatos-general] button')).find(b=>b.textContent==='Revisar archivo').click();true");
 await hasta("document.querySelectorAll('[data-importacion=candidatos-general] tbody tr').length===2 && !document.querySelector('[data-importacion=candidatos-general] input[type=checkbox]').disabled");
 for(const ancho of [390,768,1440]){await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:1000}});assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Importador conjunto desbordado a '+ancho+'px');}
 await evaluar("document.querySelector('[data-importacion=candidatos-general] input[type=checkbox]').click();true");
 await evaluar("Array.from(document.querySelectorAll('[data-importacion=candidatos-general] button')).find(b=>b.textContent==='Confirmar importación').click();true");
 await hasta("document.querySelector('.contenido-seccion-privada [role=status]')?.textContent.includes('Archivo completo importado') && !document.querySelector('.item-menu-lateral').disabled");
 assert.equal(await evaluar(`(async()=>{const org=document.querySelector('.contexto-modulo-admin').dataset.contextoInstitucion;const ids=${JSON.stringify(directoresUi.map(p=>p.id))};const ps=await Promise.all(ids.map(id=>fetch('/api/v1/configuracion/procesos/'+id,{headers:{'X-Organizacion':org}}).then(r=>r.json())));return ps[0].candidatos.length===1&&ps[0].candidatos[0].nombre==='Postulante UI global A'&&ps[1].candidatos.length===1&&ps[1].candidatos[0].nombre==='Postulante UI global B';})()`),true,'Archivo conjunto separó y persistió ambos cargos');
 // Todos los candidatos y sus cargos provienen del catálogo autorizado, sin deduplicar personas por nombre.
 await hasta("!!document.querySelector('.totales-candidatos') && document.querySelectorAll('[data-candidato-listado]').length>0");
 assert.equal(await evaluar("(async()=>{const org=document.querySelector('.contexto-modulo-admin').dataset.contextoInstitucion;const ps=(await fetch('/api/v1/configuracion/procesos',{headers:{'X-Organizacion':org}}).then(r=>r.json())).elementos;const cargos=Array.from(document.querySelectorAll('[data-candidatos-cargo]'));return cargos.length===ps.length&&Number(document.querySelector('[data-total-candidatos]').textContent)===ps.reduce((n,p)=>n+p.candidatos.length,0)&&Number(document.querySelector('[data-total-cargos]').textContent)===ps.length&&Number(document.querySelector('[data-cargos-sin-candidatos]').textContent)===ps.filter(p=>!p.candidatos.length).length&&ps.every(p=>{const c=cargos.find(e=>e.dataset.candidatosCargo===p.id),n=Array.from(c.querySelectorAll('[data-candidato-listado]'));return n.length===p.candidatos.length&&p.candidatos.every(v=>n.some(e=>e.dataset.candidatoListado===v.id&&e.textContent.includes(v.nombre)));});})()"),true,'La lista y todos sus totales coinciden con los cargos/candidatos reales de la institución');
 await evaluar("(()=>{const e=document.querySelector('[aria-label=\"Buscar candidatos o cargos\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Postulante UI global B');e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()");
 await hasta("Array.from(document.querySelectorAll('[data-candidatos-cargo]')).length>0&&Array.from(document.querySelectorAll('[data-candidatos-cargo]')).every(e=>e.textContent.includes('Postulante UI global B'))");
 assert.equal(await evaluar(`Array.from(document.querySelectorAll('[data-candidatos-cargo]')).some(e=>e.dataset.candidatosCargo===${JSON.stringify(directoresUi[1].id)})`),true,'Buscar un candidato conserva el UUID de su cargo');
 await evaluar("(()=>{const e=document.querySelector('[aria-label=\"Buscar candidatos o cargos\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'');e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()");
 await evaluar("(()=>{const e=document.querySelector('[aria-label=\"Filtrar candidatos por tipo de cargo\"]');e.value='directores';e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
 assert.equal(await evaluar("document.querySelectorAll('[data-grupo-candidatos]').length===1&&document.querySelector('[data-grupo-candidatos]').dataset.grupoCandidatos==='directores'"),true,'Filtro por familia sin mezclar Rector, Vicerrector ni Decanos');
 for(const ancho of [390,768,1440]){await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:1000}});assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Lista de candidatos desbordada a '+ancho+'px');const c=await comando('browsingContext.captureScreenshot',{context});await writeFile('/tmp/tuvoto-candidatos-lista-'+ancho+'.png',Buffer.from(c.data,'base64'));}
 await evaluar(`Array.from(document.querySelectorAll('[data-candidatos-cargo]')).find(e=>e.dataset.candidatosCargo===${JSON.stringify(directoresUi[0].id)}).querySelector('.gestionar-cargo-candidatos').click();true`);
 await hasta("!!document.querySelector('[aria-label=\"Cargo para gestionar candidatos\"]') && !!document.querySelector('.grid-candidatos-fotos')");
 assert.equal(await evaluar(`document.querySelector('[data-editor-candidatos]').dataset.editorCandidatos===${JSON.stringify(directoresUi[0].id)}`),true,'Gestionar un grupo abre la edición del cargo exacto sin salir del módulo');
 await evaluar(`(()=>{const e=document.querySelector('[aria-label="Cargo para gestionar candidatos"]');e.value=${JSON.stringify(directoresUi[1].id)};e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
 await hasta(`document.querySelector('[data-editor-candidatos]')?.dataset.editorCandidatos===${JSON.stringify(directoresUi[1].id)}`);
 const pngPrueba='iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAeklEQVR4nO3PUQkAIBTAwFfGZMa3hCH8OITBAtxm7fN1wwUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWPHYBmGYxWlLxJbIAAAAASUVORK5CYII=';
 await evaluar(`(()=>{const d=new DataTransfer();d.items.add(new File([Uint8Array.from(atob(${JSON.stringify(pngPrueba)}),c=>c.charCodeAt(0))],'foto-sintetica.png',{type:'image/png'}));const e=document.querySelector('[data-candidato-foto] input[type=file]');e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
 await hasta("document.querySelector('.contenido-seccion-privada>.confirmacion')?.textContent.includes('Fotografía guardada') && !!document.querySelector('[data-candidato-foto] small') && !document.querySelector('.gestionar-candidatos').disabled");
 assert.equal(await evaluar(`(async()=>{const org=document.querySelector('.contexto-modulo-admin').dataset.contextoInstitucion;const ps=await Promise.all(${JSON.stringify(directoresUi.map(p=>p.id))}.map(id=>fetch('/api/v1/configuracion/procesos/'+id,{headers:{'X-Organizacion':org}}).then(r=>r.json())));return !ps[0].candidatos[0].tieneFoto&&ps[1].candidatos[0].tieneFoto&&ps[1].candidatos.length===1&&(await fetch(ps[1].candidatos[0].foto)).status===404;})()`),true,'Fotografía persistida solo en el cargo elegido; el borrador no se expone al público');
 await hasta("document.querySelector('[data-candidato-foto] img')?.naturalWidth>0");
 assert.equal(await evaluar("document.querySelector('[data-candidato-foto] small').textContent==='Fotografía cargada'&&document.querySelector('[data-candidato-foto] img').src.startsWith('blob:')&&document.querySelector('.nota-fotos-candidatos').textContent.includes('Se mostrarán en Resultados')"),true,'Los borradores muestran la fotografía mediante lectura privada, sin exponerla al público');
 for(const ancho of [390,768,1440]){await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:1000}});assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Editor de candidatos desbordado a '+ancho+'px');const c=await comando('browsingContext.captureScreenshot',{context});await writeFile('/tmp/tuvoto-candidatos-editor-'+ancho+'.png',Buffer.from(c.data,'base64'));}
 await evaluar("document.querySelector('.ver-todos-candidatos').click();true");
 await hasta("!!document.querySelector('[data-grupo-candidatos]') && !document.querySelector('[data-editor-candidatos]')");
 assert.equal(await evaluar("document.querySelector('[aria-label=\"Filtrar candidatos por tipo de cargo\"]').value"),'directores','Volver a todos conserva la búsqueda y el filtro');
 await evaluar("(()=>{const e=document.querySelector('[aria-label=\"Filtrar candidatos por tipo de cargo\"]');e.value='';e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
 const cerrado=await evaluar("Array.from(document.querySelectorAll('[data-candidatos-cargo]')).find(c=>!c.querySelector('.etiqueta-estado').classList.contains('estado-borrador'))?.dataset.candidatosCargo");
 assert.ok(cerrado,'La prueba requiere un cargo sintético que ya haya salido de borrador');
 await evaluar(`Array.from(document.querySelectorAll('[data-candidatos-cargo]')).find(e=>e.dataset.candidatosCargo===${JSON.stringify(cerrado)}).querySelector('.gestionar-cargo-candidatos').click();true`);
 await hasta(`document.querySelector('[data-editor-candidatos]')?.dataset.editorCandidatos===${JSON.stringify(cerrado)}`);
 assert.equal(await evaluar("!document.querySelector('.editor-candidatos form')&&!document.querySelector('.editor-candidatos input[type=file]')&&document.querySelector('.editor-candidatos').textContent.includes('bloqueados')"),true,'No se habilitan escrituras de candidatos ni fotos después de iniciar el conteo');
 // Reimportar cargos: mantener por defecto y reemplazar uno tras una nueva revisión explícita.
 const antesReimportar=JSON.parse(await evaluar(`(async()=>{const org=document.querySelector('.contexto-modulo-admin').dataset.contextoInstitucion;const ps=await Promise.all(${JSON.stringify(directoresUi.map(p=>p.id))}.map(id=>fetch('/api/v1/configuracion/procesos/'+id,{headers:{'X-Organizacion':org}}).then(r=>r.json())));return JSON.stringify(ps);})()`));
 await evaluar("Array.from(document.querySelectorAll('.item-menu-lateral')).find(b=>b.textContent.trim()==='Elección').click();true");
 await hasta("!!document.querySelector('[data-importacion=cargos] summary')");
 await evaluar("document.querySelector('[data-importacion=cargos]').open=true;true");
 libroCargos.worksheets[0].getCell('D2').value='Sistemas; Civil; Nueva carrera UI';
 const archivoReimportar=Buffer.from(await libroCargos.xlsx.writeBuffer()).toString('base64');
 async function cargarRepetidos(){
  await evaluar(`(()=>{const d=new DataTransfer();d.items.add(new File([Uint8Array.from(atob(${JSON.stringify(archivoReimportar)}),c=>c.charCodeAt(0))],'cargos-con-cambio.xlsx'));const el=document.querySelector('[data-importacion=cargos] input[type=file]');el.files=d.files;el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
  await hasta("!!Array.from(document.querySelectorAll('[data-importacion=cargos] button')).find(b=>b.textContent==='Revisar archivo'&&!b.disabled)");
  await evaluar("Array.from(document.querySelectorAll('[data-importacion=cargos] button')).find(b=>b.textContent==='Revisar archivo').click();true");
  await hasta("document.querySelectorAll('[data-conflictos-cargos] select').length===2 && !document.querySelector('[data-importacion=cargos] input[type=checkbox]').disabled");
 }
 await cargarRepetidos();
 assert.equal(await evaluar("Array.from(document.querySelectorAll('[data-conflictos-cargos] select')).every(s=>s.value==='mantener')"),true,'Mantener es la decisión inicial para cada cargo');
 await evaluar("document.querySelector('[data-importacion=cargos] input[type=checkbox]').click();true");
 await evaluar("Array.from(document.querySelectorAll('[data-importacion=cargos] button')).find(b=>b.textContent==='Confirmar importación').click();true");
 await hasta("document.querySelector('.contenido-seccion-privada [role=status]')?.textContent.includes('Archivo de cargos procesado') && !document.querySelector('.item-menu-lateral').disabled && !document.querySelector('[data-conflictos-cargos]')");
 assert.equal(await evaluar(`(async()=>{const org=document.querySelector('.contexto-modulo-admin').dataset.contextoInstitucion;const antes=${JSON.stringify(antesReimportar)};for(const p of antes){const actual=await fetch('/api/v1/configuracion/procesos/'+p.id,{headers:{'X-Organizacion':org}}).then(r=>r.json());if(JSON.stringify(actual)!==JSON.stringify(p))return false;}return true;})()`),true,'Mantener no cambia carreras ni relaciones existentes');
 await cargarRepetidos();
 await evaluar("(()=>{const s=document.querySelector('[data-conflictos-cargos] select');s.value='reemplazar';s.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
 await hasta("document.querySelector('[data-conflictos-cargos] [role=status]')?.textContent.includes('Revisar archivo')");
 assert.equal(await evaluar("document.querySelector('[data-importacion=cargos] input[type=checkbox]').disabled"),true,'Cambiar la acción invalida la confirmación anterior');
 await evaluar("Array.from(document.querySelectorAll('[data-importacion=cargos] button')).find(b=>b.textContent==='Revisar archivo').click();true");
 await hasta("!document.querySelector('[data-importacion=cargos] input[type=checkbox]').disabled && document.querySelector('[data-importacion=cargos]').textContent.includes('1 por actualizar')");
 for(const ancho of [390,768,1440]){await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:1000}});assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Decisiones de importación desbordadas a '+ancho+'px');}
 await evaluar("document.querySelector('[data-importacion=cargos] input[type=checkbox]').click();true");
 await evaluar("Array.from(document.querySelectorAll('[data-importacion=cargos] button')).find(b=>b.textContent==='Confirmar importación').click();true");
 await hasta("!document.querySelector('[data-conflictos-cargos]') && !document.querySelector('.item-menu-lateral').disabled");
 assert.equal(await evaluar(`(async()=>{const org=document.querySelector('.contexto-modulo-admin').dataset.contextoInstitucion;const antes=${JSON.stringify(antesReimportar)};let actualizados=0;for(const p of antes){const actual=await fetch('/api/v1/configuracion/procesos/'+p.id,{headers:{'X-Organizacion':org}}).then(r=>r.json());if(actual.carreras.includes('Nueva carrera UI'))actualizados++;for(const campo of ['id','nombre','cargo','ambito','estado','candidatos','mesas','sectores','ponderacion'])if(JSON.stringify(actual[campo])!==JSON.stringify(p[campo]))return false;}return actualizados===1;})()`),true,'Reemplazo selectivo persiste sin cambiar IDs, candidatos o mesas');
 // Nuevo tipo de cargo dentro del mismo formulario; no navega ni borra las demás opciones.
 await hasta("!!document.querySelector('.agregar-cargo') && !document.querySelector('.agregar-cargo').disabled");
 await evaluar("document.querySelector('.agregar-cargo').click();true");
 await hasta("!!document.querySelector('[aria-label=\"Cargo universitario\"]') && !!document.querySelector('.opciones-eleccion')");
 assert.equal(await evaluar("document.querySelector('[aria-label=\"Cargo universitario\"]').options[0].textContent"),'Nuevo cargo…','Nuevo está al principio del selector');
 await evaluar("(()=>{const f=document.querySelector('.opciones-eleccion').closest('form');window.formularioCargoPrueba=f;const el=Array.from(document.querySelectorAll('.opciones-eleccion label')).find(l=>l.textContent.startsWith('Ámbito o grupo participante')).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'Facultad sintética de Tecnología');el.dispatchEvent(new Event('input',{bubbles:true}));return true;})()");
 await evaluar("Array.from(document.querySelectorAll('.opciones-eleccion label')).find(l=>l.textContent.includes('Separar mesas')).querySelector('input').click();true");
 await evaluar("(()=>{const s=document.querySelector('[aria-label=\"Cargo universitario\"]');s.value='__nuevo__';s.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
 await hasta("!!document.querySelector('[aria-label=\"Nombre del nuevo cargo\"]')");
 assert.equal(await evaluar("window.formularioCargoPrueba===document.querySelector('.opciones-eleccion').closest('form') && document.querySelector('[aria-label=\"Nombre del nuevo cargo\"]').validity.valueMissing && document.querySelectorAll('.fila-sector-configuracion').length===2 && Array.from(document.querySelectorAll('.opciones-eleccion label')).find(l=>l.textContent.startsWith('Ámbito o grupo participante')).querySelector('input').value==='Facultad sintética de Tecnología'"),true,'Se pide el nombre sin salir del formulario ni cambiar ámbito o sectores');
 const cargoPersonalizado='Centro de Estudiantes de Tecnología sintético '+Date.now();
 await evaluar(`(()=>{const el=document.querySelector('[aria-label="Nombre del nuevo cargo"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(cargoPersonalizado)});el.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
 for(const ancho of [390,768,1440]){await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:1000}});assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Nombre de cargo desbordado a '+ancho+'px');}
 await evaluar("document.querySelector('.opciones-eleccion').closest('form').querySelector('button.primario').click();true");
 await hasta("document.querySelector('.titulo-seccion-privada h1')?.textContent==='Candidatos' && !!document.querySelector('.crear-cargo-directo') && !document.querySelector('.crear-cargo-directo').disabled");
 assert.equal(await evaluar(`(async()=>{const el=document.querySelector('.contexto-modulo-admin'),org=el.dataset.contextoInstitucion;const p=await fetch('/api/v1/configuracion/procesos/'+el.dataset.contextoProceso,{headers:{'X-Organizacion':org}}).then(r=>r.json());return p.cargo===${JSON.stringify(cargoPersonalizado)}&&p.tipo==='universidad'&&p.ambito==='Facultad sintética de Tecnología'&&p.sectores.length===2&&p.estado==='borrador';})()`),true,'El nombre personalizado se guarda por REST en PostgreSQL con la configuración conservada');
 await evaluar("document.querySelector('.crear-cargo-directo').click();true");
 await hasta(`!!Array.from(document.querySelector('[aria-label="Cargo universitario"]').options).find(o=>o.value===${JSON.stringify(cargoPersonalizado)})`);
 await evaluar(`(()=>{const el=document.querySelector('[aria-label="Cargo universitario"]');el.value=${JSON.stringify(cargoPersonalizado)};el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
 assert.equal(await evaluar(`document.querySelector('[aria-label="Cargo universitario"]').value===${JSON.stringify(cargoPersonalizado)} && !document.querySelector('[aria-label="Nombre del nuevo cargo"]') && !!document.querySelector('.opciones-eleccion')`),true,'El nuevo nombre ya puede seleccionarse entre los existentes sin otro formulario');
 await evaluar("document.querySelector('.cancelar-cargo').click();true");
 await hasta("!!document.querySelector('.grupos-cargos-institucion')");
 // Verificar el panel del operador con una cuenta sintética creada por la prueba HTTP.
 const operadorInterfaz=JSON.parse(await readFile(entorno.carpeta+'/operador-interfaz.json','utf8'));
 await evaluar("document.querySelector('.boton-cerrar-sesion').click();true");
 await hasta("!!document.getElementById('usuario')");
 await evaluar(`(()=>{const poner=(id,v)=>{const el=document.getElementById(id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};poner('usuario',${JSON.stringify(operadorInterfaz.usuario)});poner('contrasena',${JSON.stringify(operadorInterfaz.contrasena)});return true;})()`);
 await evaluar("document.querySelector('.formulario-acceso-tuvoto button.primario').click();true");
 await hasta("!!document.querySelector('[aria-label=\"Mesa asignada\"]') && !!document.querySelector('form input[type=number]')");
 assert.equal(await evaluar("(async()=>{const r=await fetch('/api/v1/mis-mesas').then(r=>r.json());const opciones=Array.from(document.querySelector('[aria-label=\"Mesa asignada\"]').options);return r.elementos.length===opciones.length&&r.elementos.every(m=>opciones.find(o=>o.value===m.id)?.textContent.includes(m.cargo));})()"),true,'Las mesas del operador indican su cargo');
 for(const ancho of [320,390,768,1024,1440]){
  await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:1000}});
  assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Panel del operador desbordado a '+ancho+'px');
  if(ancho<=1080)assert.equal(await evaluar("getComputedStyle(document.querySelector('.grid-operador-registro')).gridTemplateColumns.split(' ').length"),1,'El operador apila fotografía y transcripción en móvil y tablet');
 }
 await evaluar("(()=>{const el=document.querySelector('[aria-label=\"Mesa asignada\"]');if(el.options.length>1){el.value=el.options[el.options.length-1].value;el.dispatchEvent(new Event('change',{bubbles:true}));}return true;})()");
 await hasta("!!document.querySelector('input[type=file]')");
 await evaluar("document.querySelector('.boton-cerrar-sesion').click();true");
 await hasta("!!document.getElementById('usuario')");
 await comando('browsingContext.navigate',{context,url:entorno.url,wait:'complete'});await hasta("!!document.querySelector('.selector-evento select')");
 await hasta("!!document.querySelector('.tarjeta-candidatura') && !!document.querySelector('.resultados-sectores')");
 for(const ancho of [390,768,1440]){await comando('browsingContext.setViewport',{context,viewport:{width:ancho,height:1000}});await esperar(300);assert.equal(await evaluar('document.documentElement.scrollWidth<=innerWidth'),true,'Desbordamiento público a '+ancho+'px');}
 const captura=await comando('browsingContext.captureScreenshot',{context});await writeFile('/tmp/tuvoto-integracion-publico.png',Buffer.from(captura.data,'base64'));
 assert.equal(await evaluar("document.querySelector('.selector-evento select').options.length>1"),true);
 const alternativo=await evaluar("(async()=>{const actual=await fetch('/api/v1/publico/actual').then(r=>r.json());const catalogo=await fetch('/api/v1/publico/eventos').then(r=>r.json());for(const evento of catalogo.elementos){const p=evento.procesos.find(p=>p.id!==actual.id);if(p)return JSON.stringify({evento:evento.id,proceso:p.id});}return '';})()");
 assert.ok(alternativo,'Debe existir un cargo sintético publicado distinto del destacado');
 const destino=JSON.parse(alternativo);
 await comando('browsingContext.navigate',{context,url:entorno.url+'/#resultados?proceso='+destino.proceso,wait:'complete'});
 await hasta("document.querySelector('.observatorio-publico')?.dataset.procesoPublico==="+JSON.stringify(destino.proceso)+" && !!document.querySelector('.tarjeta-candidatura')");
 assert.equal(await evaluar("document.querySelector('.selector-evento select').value"),destino.evento);
 await comando('browsingContext.navigate',{context,url:entorno.url+'/#resultados?proceso=00000000-0000-4000-8000-000000000000',wait:'complete'});
 await hasta("Array.from(document.querySelectorAll('h2')).some(h=>h.textContent==='Este cargo ya no está publicado')");
 assert.equal(await evaluar("document.querySelectorAll('.tarjeta-candidatura').length"),0);
 if(erroresJavascript.length)for(const e of erroresJavascript){const texto=String(e.text??'');console.error(/contrasen|password|cookie|csrf|session|token|authorization/i.test(texto)?'Error JavaScript: detalle sensible omitido':texto.replace(/[A-Za-z0-9_-]{20,}/g,'[omitido]').slice(0,250));}
 assert.equal(erroresJavascript.length,0,'Sin errores JavaScript no controlados en la página');
 await writeFile('pruebas/ampliacion/interfaz.json',JSON.stringify({estado:'OK',fecha:new Date().toISOString(),erroresJavascript:erroresJavascript.length,navegador:'Firefox existente, perfil temporal',entorno:entorno.proyecto,comprobaciones:['Nuevo tipo en el mismo formulario: primera opción Nuevo, nombre requerido, ámbito/sectores conservados, persistencia REST/PostgreSQL y nombre reutilizable; tres tamaños','Elegir o crear cargo: accesos directos desde módulos y detalle, formulario vacío, vuelta a existentes y selección por UUID sin modificar registros; tres tamaños','Cargos agrupados: cantidades comparadas con API, apertura/cierre de cada grupo, selección de UUID y tres tamaños','Candidatos por cargo: todos los nombres y totales contra API, búsqueda y filtros, edición por UUID, foto persistida solo en su cargo, borradores privados, catálogo iniciado bloqueado y Excel único general; tres tamaños','Confirmación: 34 filas/20 errores reproducidos; motivo junto a la casilla, enlace a errores con foco, bloqueo seguro y archivo corregido habilitado; tres tamaños','Cargos repetidos desde React: mantener sin cambios y reemplazar una fila tras nueva revisión, persistencia y tres tamaños','Excel conjunto real de candidatos: dos cargos, selección explícita de destino, nueva revisión obligatoria, persistencia y tres tamaños','Login real con cuenta sintética','Excel de cargos desde React: plantilla, vista previa y dos Directores persistidos','Mesas y cargos agrupados por operador, comprobados contra API y sin desbordamiento','Operador: login y formulario de actas sin error de inicialización; mesas identificadas por cargo','Asignación individual real desde React sin candidatos; persistencia comprobada; candidato añadido después; guía no determina permisos','Institución vacía: lista sin formulario automático, botón Agregar cargo y cancelación sin crear datos','Recorrido separado de estilos antiguos: ancho legible y sin solapamientos a 390, 768 y 1440 px','Crear nueva elección no muestra el selector ni el nombre del cargo anterior','Crear sin campo de nombre de evento: nombre automático de institución persistido y edición comprobada por API','Códigos de sector validados por HTML con expresiones compatibles con el modo v del navegador','Guardar desde el final del formulario móvil deja visible el siguiente paso','Guía opcional de 6 pasos: desactivada inicialmente, activación y desactivación sin alterar formularios; preferencia recordada al recargar','Espacio de trabajo antes del resumen; indicadores y candidatos debajo tras elegir institución','Resumen con totales de institución comprobados por API y accesos que navegan al módulo correspondiente','Excel real en Mesas: dos facultades y sectores distintos persistidos y agrupados por unidad','Vista previa de candidatos sin edición y enlace al cargo público exacto; cargo retirado no muestra resultados ajenos','Cargos, sectores y ponderación en Elección; formularios fuera de Resumen','Institución y cargo conservados al navegar por Usuarios, Mesas y Candidatos','Lista de instituciones sin desplegable, ficha seleccionada y eventos ocultos hasta elegir','Creación real de institución sintética desde el formulario, persistencia consultada por API','Lista única de todos los cargos verificada contra la API; selección por UUID, cancelación y recuperación de borrador','Formulario con sectores, ponderación y regla opcionales','Estado real y confirmación obligatoria de cierre sin ejecutar cambios','Sin desbordamiento: 390, 768 y 1440 px','Catálogo público real de eventos y cargos, con resultados por sector y ponderación','Portada sin desbordamiento en 390, 768 y 1440 px'],sinCrearActas:true,institucionCreadaSoloEnEntornoSintetico:true,eleccionYMesasCreadasSoloEnEntornoSintetico:true},null,2)+'\n');
 console.log('OK: navegador real, login sintético, pasos, opciones y tres tamaños; sin modificar el entorno principal ni crear actas.');
 await comando('session.end');
}finally{if(ws)ws.close();navegador.kill('SIGTERM');}
