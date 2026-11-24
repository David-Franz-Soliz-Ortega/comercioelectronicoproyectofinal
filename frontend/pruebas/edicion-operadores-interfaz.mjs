// Navegador con catálogo y escrituras en memoria, sin API ni almacenamiento reales.
import {build} from 'esbuild';
import {chromium} from 'playwright';
import http from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const frontend=fileURLToPath(new URL('..',import.meta.url));
const salida=await build({entryPoints:[resolve(frontend,'pruebas/fixtures/edicion-operadores.jsx')],bundle:true,write:false,define:{'process.env.NODE_ENV':'"production"'}});
const css=(await readdir(resolve(frontend,'dist/assets'))).filter(p=>p.endsWith('.css')).map(p=>'<link rel="stylesheet" href="/assets/'+p+'">').join('');
const servidor=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+css+'<div id="raiz"></div><script src="/fixture.js"></script></html>');return;}
 if(url.pathname==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(salida.outputFiles[0].contents);return;}
 const ruta=resolve(frontend,'dist','.'+url.pathname);
 if(!ruta.startsWith(resolve(frontend,'dist')+'/')){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',extname(ruta)==='.css'?'text/css':'font/ttf');res.end(await readFile(ruta));}catch{res.writeHead(404).end();}
});
await new Promise(r=>servidor.listen(0,'127.0.0.1',r));
const origen='http://127.0.0.1:'+servidor.address().port;
const navegador=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EJECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});
const pagina=await navegador.newPage({viewport:{width:1440,height:1200}}),errores=[];
pagina.on('pageerror',e=>errores.push(e.message));
await pagina.route('**/*',ruta=>ruta.request().url().startsWith(origen+'/')?ruta.continue():ruta.abort());
const mesa=n=>pagina.getByRole('checkbox',{name:'Mesa A-00'+n+' · general',exact:true});
const guardar=()=>pagina.getByRole('button',{name:'Guardar asignaciones',exact:true}).click();
const escrituras=()=>pagina.evaluate(()=>window.solicitudes.filter(s=>s.metodo!=='GET'));
try{
 await pagina.goto(origen);await mesa(1).waitFor();
 assert.ok(await mesa(1).isChecked());assert.ok(await mesa(1).isEnabled());
 assert.ok(await mesa(2).isDisabled());assert.ok(!(await mesa(2).isChecked()));
 assert.ok(await mesa(3).isChecked());assert.ok(await mesa(4).isEnabled());
 const grupo=pagina.getByRole('checkbox',{name:/Seleccionar mesas disponibles de Facultad/});
 for(const ancho of [390,768,1440,2560]){
  await pagina.setViewportSize({width:ancho,height:1200});
  await pagina.locator('details').evaluateAll(nodos=>nodos.forEach(n=>n.open=true));
  assert.ok(await pagina.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await pagina.getByRole('dialog').evaluate(n=>n.scrollWidth<=n.clientWidth+1));
  assert.ok(await mesa(1).locator('..').locator('span').evaluate(n=>n.getBoundingClientRect().width>150),'Nombre de mesa legible');
  if([390,1440].includes(ancho))await pagina.screenshot({path:'/tmp/tuvoto-edicion-ocupadas-'+ancho+'.png',fullPage:true,animations:'disabled'});
 }
 await grupo.check();assert.ok(await mesa(4).isChecked());assert.ok(!(await mesa(2).isChecked()));
 assert.ok(await pagina.getByRole('checkbox',{name:'Seleccionar mesas disponibles de Otra facultad'}).isDisabled());
 await guardar();await pagina.getByRole('button',{name:'Entendido'}).waitFor();
 assert.deepEqual((await escrituras()).map(s=>s.ruta.split('/').at(-2)),['a3v','a4r','a4v']);
 // Desmarcar una propia conserva la confirmación y solo elimina sus vínculos.
 await pagina.goto(origen);await mesa(1).uncheck();await guardar();
 await pagina.getByRole('button',{name:'Quitar mesas',exact:true}).click();
 await pagina.getByRole('button',{name:'Entendido'}).waitFor();
 assert.deepEqual((await escrituras()).map(s=>[s.metodo,s.ruta.split('/').at(-2)]),[['DELETE','a1r'],['DELETE','a1v']]);
 // Un cambio ajeno posterior a la apertura bloquea el guardado sin escrituras.
 await pagina.goto(origen);await mesa(4).check();await pagina.evaluate(()=>window.ocuparMesa());await guardar();
 await pagina.getByRole('alert').filter({hasText:'Cambió la disponibilidad'}).waitFor();
 assert.ok(await mesa(4).isDisabled());assert.ok(!(await mesa(4).isChecked()));assert.equal((await escrituras()).length,0);
 // Crear, fallar parcialmente y reintentar conserva la cuenta y el primer vínculo confirmado.
 await pagina.goto(origen+'/?nuevo');await pagina.getByRole('dialog').waitFor();
 await pagina.locator('details').evaluateAll(nodos=>nodos.forEach(n=>n.open=true));await mesa(4).waitFor();
 assert.ok(await mesa(1).isDisabled());assert.ok(await mesa(3).isDisabled());
 await pagina.getByLabel('Nombre de usuario',{exact:true}).fill('nuevo.sintetico');
 await pagina.locator('input[autocomplete="new-password"]').fill('Clave-Sintetica-2026');
 await mesa(4).check();await pagina.evaluate(()=>{window.fallarMesa='a4v';});
 await pagina.getByRole('button',{name:'Crear operador',exact:true}).click();
 await pagina.getByRole('alert').filter({hasText:'La cuenta ya fue creada'}).waitFor();
 await guardar();await pagina.getByRole('button',{name:'Entendido'}).waitFor();
 const realizadas=await escrituras();assert.equal(realizadas.filter(s=>s.ruta.endsWith('/usuarios')).length,1);
 assert.deepEqual(realizadas.filter(s=>s.ruta.endsWith('/asignar')).map(s=>s.ruta.split('/').at(-2)),['a4r','a4v','a4v']);
 assert.deepEqual(errores,[]);
 console.log('OK: ocupadas bloqueadas, propias editables, grupos, parcial, cambio concurrente detectado, confirmación de retiro y reintento sin duplicados; cuatro anchos. Datos en memoria.');
}finally{await navegador.close();servidor.closeAllConnections();await new Promise(r=>servidor.close(r));}
