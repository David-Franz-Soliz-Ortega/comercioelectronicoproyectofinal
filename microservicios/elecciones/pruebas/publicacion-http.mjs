// PostgreSQL efímero propio, sin volúmenes ni escrituras en proyectos existentes.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
const nombre = 'tuvoto-prueba-catalogo-' + randomUUID().slice(0, 8);
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const raiz = fileURLToPath(new URL('../../../', import.meta.url));
const org = randomUUID(), otraOrg = randomUUID();
let contenedor, hijo, identidad;
const pausa = ms => new Promise(r => setTimeout(r, ms));
async function puertoLibre() { const s=http.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(r=>s.close(r));return p; }
try {
 contenedor=docker('run','--detach','--rm','--pull=never','--name',nombre,'--label','tuvoto.prueba=efimera','--memory','256m','--tmpfs','/var/lib/postgresql/data:rw,size=128m','--publish','127.0.0.1::5432','--env','POSTGRES_HOST_AUTH_METHOD=trust','--env','POSTGRES_DB=tuvoto_pruebas','postgres:17-alpine');
 const inspeccion=JSON.parse(docker('inspect',contenedor))[0];
 assert.ok(inspeccion.Mounts.every(m=>m.Type!=='volume'));
 const enlace=inspeccion.NetworkSettings.Ports['5432/tcp'][0];assert.equal(enlace.HostIp,'127.0.0.1');
 let listo=false;for(let i=0;i<80;i++){try{docker('exec',contenedor,'pg_isready','-h','127.0.0.1','-U','postgres');listo=true;break;}catch{await pausa(150);}}assert.ok(listo);
 identidad=http.createServer((req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.headers.cookie!=='sesion=administrador-sintetico'){res.statusCode=403;return res.end('{}');}
  res.end(JSON.stringify({idOrganizacion:req.headers['x-organizacion'],administradorGlobal:true}));
 });identidad.listen(0,'127.0.0.1');await once(identidad,'listening');
 const puerto=await puertoLibre();const puertoGrpc=await puertoLibre();
 hijo=spawn(process.execPath,[raiz+'microservicios/elecciones/dist/servidor.js'],{env:{...process.env,DB_HOST:'127.0.0.1',DB_PORT:enlace.HostPort,DB_NAME:'tuvoto_pruebas',DB_USER:'postgres',DB_PASSWORD:'',PORT:String(puerto),PUERTO_GRPC:String(puertoGrpc),IDENTIDAD_URL:`http://127.0.0.1:${identidad.address().port}`,CONTRATO_OPENAPI:raiz+'compartido/contratos/openapi/elecciones.openapi.json',CONTRATO_GRPC:raiz+'compartido/contratos/grpc/mesa-v1.proto'},stdio:'ignore'});
 const origen=`http://127.0.0.1:${puerto}`;
 const pedir=async(ruta,metodo='GET',datos,organizacion=org,autorizado=true)=>{
  const r=await fetch(origen+'/api/v1'+ruta,{method:metodo,headers:{'Content-Type':'application/json','X-Organizacion':organizacion,...(autorizado?{Cookie:'sesion=administrador-sintetico'}:{})},body:datos?JSON.stringify(datos):undefined,signal:AbortSignal.timeout(5000)});
  return {estado:r.status,datos:r.headers.get('content-type')?.includes('json')?await r.json():null};
 };
 listo=false;for(let i=0;i<100;i++){try{if((await pedir('/salud')).estado===200){listo=true;break;}}catch{}await pausa(100);}assert.ok(listo,'Elecciones inicia con su migración');
 const crear=async(nombre,cargo,organizacion=org)=>{const r=await pedir('/configuracion/procesos','POST',{nombre,cargo,tipo:'universidad',unidad:'Facultad'},organizacion);assert.equal(r.estado,201);return r.datos.id;};
 const rector=await crear('Evento universitario de prueba','Rectorado');
 const vice=await crear('Evento universitario de prueba','Vicerrectorado');
 const borrador=await crear('Evento universitario de prueba','Decanato privado');
 assert.equal((await pedir('/publico/eventos')).datos.elementos.length,0);
 assert.equal((await pedir(`/publico/procesos/${borrador}`)).estado,404);
 assert.equal((await pedir(`/configuracion/procesos/${rector}/publicacion`,'PUT',{publicado:true},org,false)).estado,403);
 assert.equal((await pedir(`/configuracion/procesos/${rector}/publicacion`,'PUT',{publicado:true},otraOrg)).estado,404);
 assert.equal((await pedir(`/configuracion/procesos/${rector}/actual`,'POST')).estado,200);
 assert.equal((await pedir(`/configuracion/procesos/${vice}/publicacion`,'PUT',{publicado:true})).estado,200);
 let eventos=(await pedir('/publico/eventos')).datos.elementos;
 assert.equal(eventos.length,1);assert.deepEqual(eventos[0].procesos.map(p=>p.id),[rector,vice]);assert.equal(eventos[0].destacado,true);
 assert.equal((await pedir(`/publico/procesos/${vice}`)).estado,200);
 assert.equal((await pedir(`/publico/procesos/${borrador}`)).estado,404);
 await pedir(`/configuracion/procesos/${vice}/actual`,'POST');
 assert.equal((await pedir(`/publico/procesos/${rector}`)).estado,200,'Cambiar destacado conserva los otros cargos publicados');
 await pedir(`/configuracion/procesos/${rector}/publicacion`,'PUT',{publicado:false});
 assert.equal((await pedir(`/publico/procesos/${rector}`)).estado,404);
 eventos=(await pedir('/publico/eventos')).datos.elementos;assert.equal(eventos[0].procesos.length,1);
 await pedir(`/configuracion/procesos/${vice}/publicacion`,'PUT',{publicado:false});
 assert.equal((await pedir('/publico/actual')).datos,null);
 assert.equal((await pedir('/publico/eventos')).datos.elementos.length,0);
 console.log('OK: PostgreSQL + HTTP reales: borradores privados, autorización, agrupación, destacado, publicación y retirada. Identidad sustituida por doble de prueba.');
} finally {
 if(hijo && hijo.exitCode===null){hijo.kill();await once(hijo,'exit');}
 if(identidad)await new Promise(r=>identidad.close(r));
 if(contenedor)docker('stop','--time','5',contenedor);
}
