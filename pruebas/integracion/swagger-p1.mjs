import { chromium } from '../../frontend/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const argumentos=Object.fromEntries(process.argv.slice(2).reduce((lista,valor,indice,todos)=>indice%2===0?[...lista,[valor.replace('--',''),todos[indice+1]]]:lista,[]));
const base=argumentos.base??'http://localhost:8080';
const navegador=await chromium.launch({headless:true,args:['--no-sandbox']});
const contexto=await navegador.newContext();const pagina=await contexto.newPage();
const resultados=[];
try {
 for(const [servicio,recurso] of [['identidad','identidades'],['elecciones','elecciones'],['candidaturas','candidaturas'],['padron-electoral','inscripciones']]){
  const errores=[];pagina.removeAllListeners('pageerror');pagina.on('pageerror',e=>errores.push(e.message));
  await pagina.goto(base+'/documentacion/'+servicio,{waitUntil:'networkidle',timeout:60000});
  await pagina.locator('.swagger-ui .opblock').first().waitFor({timeout:45000});
  const bloques=await pagina.locator('.swagger-ui .opblock').count();assert.ok(bloques>=6);
  assert.equal(errores.length,0,errores.join('\n'));
  // Ejecutar una consulta GET real desde el propio Swagger (sin alterar datos).
  const operacion=pagina.locator('.opblock-get').filter({has:pagina.locator(`.opblock-summary-path[data-path="/${recurso}"]`)});
  await operacion.locator('.opblock-summary-control').click();
  await operacion.getByRole('button',{name:'Try it out',exact:true}).click();
  const respuesta=pagina.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/'+recurso&&r.request().method()==='GET');
  await operacion.getByRole('button',{name:'Execute',exact:true}).click();
  const recibido=await respuesta;assert.equal(recibido.status(),200);assert.ok(Array.isArray((await recibido.json()).elementos));
  const especificacion=await contexto.request.get(base+'/api/v1/'+recurso+'/openapi.yaml');assert.equal(especificacion.status(),200);
  if(servicio!=='candidaturas'){
   assert.ok(new URL(pagina.url()).pathname==='/documentacion/'+servicio+'/');
   for(const [archivo,mime] of [['swagger-ui.css','text/css'],['swagger-ui-bundle.js','javascript'],['swagger-ui-init.js','javascript']]){
    const r=await contexto.request.get(base+'/documentacion/'+servicio+'/'+archivo);assert.equal(r.status(),200);assert.ok(r.headers()['content-type'].includes(mime));
   }
  }
  resultados.push({servicio,url:pagina.url(),operaciones:bloques,erroresJavascript:errores,getEjecutado:recibido.url(),http:recibido.status(),correcto:true});
  console.log('OK: Swagger interactivo, OpenAPI y GET real:',servicio);
 }
 await writeFile(argumentos.evidencia??'/tmp/sigape-swagger-p1.json',JSON.stringify({base,fecha:new Date().toISOString(),resultados},null,2));
} catch(error){await writeFile(argumentos.evidencia??'/tmp/sigape-swagger-p1.json',JSON.stringify({base,resultados,correcto:false,error:String(error)},null,2));throw error;}
finally{await navegador.close();}
