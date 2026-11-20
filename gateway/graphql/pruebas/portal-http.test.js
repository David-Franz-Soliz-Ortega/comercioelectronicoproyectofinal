import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
const idA='11111111-1111-4111-8111-111111111111', idB='22222222-2222-4222-8222-222222222222';

test('el gateway compone cargos publicados y separa su caché por proceso y unidad', async () => {
 const llamadas=[];
 const doble=http.createServer((req,res)=>{
  llamadas.push(req.url);res.setHeader('Content-Type','application/json');
  if(req.url==='/api/v1/publico/eventos') return res.end(JSON.stringify({elementos:[{id:'evento',nombre:'Evento sintético',tipo:'universidad',destacado:true,procesos:[{id:idA,nombre:'Evento sintético',cargo:'Rectorado'},{id:idB,nombre:'Evento sintético',cargo:'Vicerrectorado'}]}]}));
  if(req.url==='/api/v1/publico/actual'||req.url.startsWith('/api/v1/publico/procesos/')) {
   const id=req.url.endsWith('actual')?idA:req.url.split('/').at(-1);
   if(![idA,idB].includes(id)){res.statusCode=404;return res.end('{}');}
   return res.end(JSON.stringify({id,nombre:'Evento sintético',cargo:id===idA?'Rectorado':'Vicerrectorado',tipo:'universidad',unidad:'Facultad',candidatos:[],mesas:[{id:'mesa',codigo:'01',unidad:'Unidad sintética'}]}));
  }
  if(req.url.includes('/resultados/')) return res.end(JSON.stringify({total:req.url.includes(idA)?11:22}));
  if(req.url.includes('/actas/')) return res.end(JSON.stringify({idProceso:req.url.includes(idA)?idA:idB,mesasConActa:1,versiones:2}));
  res.statusCode=404;res.end('{}');
 });
 doble.listen(0,'127.0.0.1');await once(doble,'listening');
 const origen=`http://127.0.0.1:${doble.address().port}`;
 const reserva=http.createServer();reserva.listen(0,'127.0.0.1');await once(reserva,'listening');const puerto=reserva.address().port;await new Promise(r=>reserva.close(r));
 const contrato=process.env.CONTRATO_GRAPHQL ?? fileURLToPath(new URL('../../../compartido/contratos/graphql/tuvoto.graphql',import.meta.url));
 const hijo=spawn(process.execPath,[fileURLToPath(new URL('../src/servidor.js',import.meta.url))],{env:{...process.env,PORT:String(puerto),ELECCIONES_URL:origen,RESULTADOS_URL:origen,ACTAS_URL:origen,CONTRATO_GRAPHQL:contrato},stdio:'ignore'});
 const pedir=async(query,variables={})=>{const r=await fetch(`http://127.0.0.1:${puerto}/graphql`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(3000)});return r.json();};
 try {
  let listo=false;for(let i=0;i<60;i++){try{await pedir('{ __typename }');listo=true;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert.ok(listo,'Arranque del gateway');
  const catalogo=await pedir('{ eventos { id nombre destacado procesos { id cargo } } }');
  assert.equal(catalogo.data.eventos[0].procesos.length,2);
  const consulta='query($id:ID,$unidad:String){portal(idProceso:$id,unidad:$unidad){proceso{id cargo unidades}resultados{total}recepcion{versiones}}}';
  const a=await pedir(consulta,{id:idA}),b=await pedir(consulta,{id:idB});
  assert.equal(a.data.portal.resultados.total,11);assert.equal(b.data.portal.resultados.total,22);
  assert.equal(a.data.portal.recepcion.versiones,2);
  await pedir(consulta,{id:idA,unidad:'Unidad sintética'});
  assert.ok(llamadas.some(r=>r.includes('?unidad=Unidad%20sint%C3%A9tica')));
  const antes=llamadas.length;await pedir(consulta,{id:idA});assert.equal(llamadas.length,antes);
  const privado=await pedir(consulta,{id:'33333333-3333-4333-8333-333333333333'});
  assert.equal(privado.data.portal,null);assert.ok(privado.errors.length);
  const invalido=await pedir(consulta,{id:'../privado'});assert.ok(invalido.errors.length);
  const anterior=await pedir(consulta);assert.equal(anterior.data.portal.proceso.id,idA);
 } finally { if(hijo.exitCode===null){hijo.kill();await once(hijo,'exit');}await new Promise(r=>doble.close(r)); }
});
