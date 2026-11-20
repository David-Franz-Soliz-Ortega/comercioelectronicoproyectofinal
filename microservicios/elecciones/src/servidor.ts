import { agruparEventos } from './catalogo-publico.js';
import { instalarHttp } from './http.js';
import swagger from 'swagger-ui-express';
import * as grpc from '@grpc/grpc-js';
import { servicioMesas } from './servidor-grpc.js';
import { readFileSync } from 'node:fs';
import express, { type Request, type Response, type NextFunction } from 'express';
import { Pool, type PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { permiso } from './autorizacion.js';

const db = new Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
const app = express(); app.disable('x-powered-by'); instalarHttp(app,'elecciones'); app.use(express.json({limit:'3mb'}));
const uuid = z.string().uuid();
const proceso = z.object({nombre:z.string().trim().min(1).max(120),cargo:z.string().trim().min(1).max(100),tipo:z.enum(['universidad','municipio','otra']),unidad:z.string().trim().min(1).max(80)}).strict();
const mesa = z.object({codigo:z.string().trim().min(1).max(60),unidad:z.string().trim().min(1).max(120)}).strict();
const contrato = readFileSync(process.env.CONTRATO_OPENAPI ?? '/app/contrato.json','utf8');
app.use('/docs',swagger.serveFiles(JSON.parse(contrato)),swagger.setup(JSON.parse(contrato)));
app.get('/openapi.json',(_req,res)=>{res.type('application/json').send(contrato);});
app.get('/api/v1/salud',async (_req,res)=>{await db.query('SELECT 1');res.json({servicio:'elecciones',estado:'saludable'});});
async function obtener(id:string) {
 const r=await db.query('SELECT id,nombre,cargo,tipo,unidad,actual,publicado FROM tuvoto_procesos WHERE id=$1 AND NOT archivado',[id]); if(!r.rowCount)return null;
 const candidatos=await db.query('SELECT id,nombre,orden,foto IS NOT NULL AS "tieneFoto" FROM tuvoto_candidatos WHERE id_proceso=$1 ORDER BY orden,id',[id]);
 const mesas=await db.query('SELECT id,codigo,unidad FROM tuvoto_mesas WHERE id_proceso=$1 ORDER BY unidad,codigo',[id]);
 return {...r.rows[0],candidatos:candidatos.rows.map(c=>({...c,foto:c.tieneFoto?`/api/v1/publico/candidatos/${c.id}/foto`:null})),mesas:mesas.rows};
}
app.get('/api/v1/publico/actual',async(_req,res)=>{const r=await db.query('SELECT id FROM tuvoto_procesos WHERE actual AND NOT archivado');res.set('Cache-Control','public,max-age=3');res.json(r.rowCount?await obtener(r.rows[0].id):null);});
app.get('/api/v1/publico/eventos',async(_req,res)=>{
 const r=await db.query('SELECT id,id_organizacion AS "idOrganizacion",nombre,cargo,tipo,actual,publicado,archivado FROM tuvoto_procesos WHERE (publicado OR actual) AND NOT archivado ORDER BY nombre,id');
 res.set('Cache-Control','public,max-age=3');res.json({elementos:agruparEventos(r.rows)});
});
app.get('/api/v1/publico/procesos/:id',async(req,res)=>{
 const id=uuid.parse(req.params.id);
 const r=await db.query('SELECT id FROM tuvoto_procesos WHERE id=$1 AND (publicado OR actual) AND NOT archivado',[id]);
 if(!r.rowCount){res.status(404).json({detalle:'Proceso no publicado'});return;}
 const datos=await obtener(id);if(!datos || !(datos.publicado || datos.actual)){res.sendStatus(404);return;}
 res.set('Cache-Control','public,max-age=3');res.json(datos);
});
app.get('/api/v1/publico/candidatos/:id/foto',async(req,res)=>{
 const id=uuid.parse(req.params.id);const r=await db.query('SELECT c.foto,c.mime FROM tuvoto_candidatos c JOIN tuvoto_procesos p ON p.id=c.id_proceso WHERE c.id=$1 AND (p.publicado OR p.actual) AND NOT p.archivado',[id]);
 if(!r.rowCount||!r.rows[0].foto){res.sendStatus(404);return;}res.set({'Content-Type':r.rows[0].mime,'X-Content-Type-Options':'nosniff','Cache-Control':'public,max-age=60'}).send(r.rows[0].foto);
});
app.use('/api/v1/configuracion',async(req:Request,res:Response,next:NextFunction)=>{try{res.locals.actor=await permiso(req,'proceso:configurar',!['GET','HEAD'].includes(req.method));next();}catch(e){res.status((e as {estado?:number}).estado??503).json({detalle:'Configuración no autorizada'});}});
app.get('/api/v1/configuracion/procesos',async(_req,res)=>{const r=await db.query('SELECT id FROM tuvoto_procesos WHERE id_organizacion=$1 AND NOT archivado ORDER BY creado_en DESC',[res.locals.actor.idOrganizacion]);res.json({elementos:await Promise.all(r.rows.map(r=>obtener(r.id)))});});
app.post('/api/v1/configuracion/procesos',async(req,res)=>{const d=proceso.parse(req.body),id=randomUUID();await db.query('INSERT INTO tuvoto_procesos(id,id_organizacion,nombre,cargo,tipo,unidad) VALUES($1,$2,$3,$4,$5,$6)',[id,res.locals.actor.idOrganizacion,d.nombre,d.cargo,d.tipo,d.unidad]);res.status(201).json(await obtener(id));});
async function comprobarPropio(id:string,org:string) {const r=await db.query('SELECT 1 FROM tuvoto_procesos WHERE id=$1 AND id_organizacion=$2 AND NOT archivado',[uuid.parse(id),org]);if(!r.rowCount)throw Object.assign(new Error(),{estado:404});}
app.get('/api/v1/configuracion/procesos/:id',async(req,res)=>{await comprobarPropio(req.params.id,res.locals.actor.idOrganizacion);res.json(await obtener(req.params.id));});
app.put('/api/v1/configuracion/procesos/:id',async(req,res)=>{
 await comprobarPropio(req.params.id,res.locals.actor.idOrganizacion);const d=proceso.parse(req.body);
 const cambiado=await configurarBloqueado(req.params.id,async c=>{const r=await c.query('SELECT 1 FROM tuvoto_asignaciones a JOIN tuvoto_mesas m ON m.id=a.id_mesa WHERE m.id_proceso=$1 LIMIT 1',[req.params.id]);if(r.rowCount)return false;await c.query('UPDATE tuvoto_procesos SET nombre=$2,cargo=$3,tipo=$4,unidad=$5 WHERE id=$1',[req.params.id,d.nombre,d.cargo,d.tipo,d.unidad]);return true;});
 if(!cambiado){res.status(409).json({detalle:'Configuración congelada: existen mesas asignadas'});return;}res.json(await obtener(req.params.id));
});
app.delete('/api/v1/configuracion/procesos/:id',async(req,res)=>{
 await comprobarPropio(req.params.id,res.locals.actor.idOrganizacion);
 const cambiado=await configurarBloqueado(req.params.id,async c=>{const r=await c.query('SELECT 1 FROM tuvoto_asignaciones a JOIN tuvoto_mesas m ON m.id=a.id_mesa WHERE m.id_proceso=$1 LIMIT 1',[req.params.id]);if(r.rowCount)return false;await c.query('UPDATE tuvoto_procesos SET archivado=true,actual=false,publicado=false WHERE id=$1',[req.params.id]);return true;});
 if(!cambiado){res.status(409).json({detalle:'No se archiva un proceso con mesas asignadas'});return;}res.sendStatus(204);
});
app.post('/api/v1/configuracion/procesos/:id/actual',async(req,res)=>{
 await comprobarPropio(req.params.id,res.locals.actor.idOrganizacion);const c=await db.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(607001)');const anterior=await c.query('SELECT id_organizacion FROM tuvoto_procesos WHERE actual FOR UPDATE');if(anterior.rowCount&&anterior.rows[0].id_organizacion!==res.locals.actor.idOrganizacion&&!res.locals.actor.administradorGlobal)throw Object.assign(new Error(),{estado:403});await c.query('UPDATE tuvoto_procesos SET actual=false WHERE actual');await c.query('UPDATE tuvoto_procesos SET actual=true,publicado=true WHERE id=$1',[req.params.id]);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}res.json(await obtener(req.params.id));
});
app.put('/api/v1/configuracion/procesos/:id/publicacion',async(req,res)=>{
 await comprobarPropio(req.params.id,res.locals.actor.idOrganizacion);
 const d=z.object({publicado:z.boolean()}).strict().parse(req.body);
 const c=await db.connect();try{
  await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(607001)');
  await c.query('UPDATE tuvoto_procesos SET publicado=$2,actual=CASE WHEN $2 THEN actual ELSE false END WHERE id=$1 AND id_organizacion=$3 AND NOT archivado',[req.params.id,d.publicado,res.locals.actor.idOrganizacion]);
  await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 res.json(await obtener(req.params.id));
});
function leerImagen(valor?:string){
 let foto:Buffer|null=null,mime:string|null=null;
 if(valor){const m=/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(valor);if(!m)throw Object.assign(new Error(),{estado:422});foto=Buffer.from(m[2],'base64');mime=m[1];if(foto.length>2000000||!(mime==='image/jpeg'?foto.subarray(0,3).equals(Buffer.from([255,216,255])):foto.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))))throw Object.assign(new Error(),{estado:422});}
 return {foto,mime};
}
async function configurarBloqueado<T>(id:string,operacion:(c:PoolClient)=>Promise<T>):Promise<T>{
 const c=await db.connect();try{await c.query('BEGIN');await c.query('SELECT id FROM tuvoto_procesos WHERE id=$1 FOR UPDATE',[id]);const resultado=await operacion(c);await c.query('COMMIT');return resultado;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
app.post('/api/v1/configuracion/procesos/:id/candidatos',async(req,res)=>{
 await comprobarPropio(req.params.id,res.locals.actor.idOrganizacion);
 const d=z.object({nombre:z.string().trim().min(1).max(120),foto:z.string().max(2800000).optional()}).strict().parse(req.body);
 const {foto,mime}=leerImagen(d.foto);
 const r=await configurarBloqueado(req.params.id,c=>c.query('INSERT INTO tuvoto_candidatos(id,id_proceso,nombre,foto,mime) SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS(SELECT 1 FROM tuvoto_asignaciones a JOIN tuvoto_mesas m ON m.id=a.id_mesa WHERE m.id_proceso=$2) RETURNING id',[randomUUID(),req.params.id,d.nombre,foto,mime]));
 if(!r.rowCount){res.status(409).json({detalle:'El catálogo se congela al asignar mesas. Configure candidatos primero.'});return;}res.status(201).json(await obtener(req.params.id));
});
app.put('/api/v1/configuracion/candidatos/:id/foto',async(req,res)=>{
 const id=uuid.parse(req.params.id),d=z.object({foto:z.string().min(1).max(2800000)}).strict().parse(req.body);
 const propio=await db.query('SELECT 1 FROM tuvoto_candidatos c JOIN tuvoto_procesos p ON p.id=c.id_proceso WHERE c.id=$1 AND p.id_organizacion=$2',[id,res.locals.actor.idOrganizacion]);
 if(!propio.rowCount){res.sendStatus(404);return;}
 const {foto,mime}=leerImagen(d.foto);await db.query('UPDATE tuvoto_candidatos SET foto=$2,mime=$3 WHERE id=$1',[id,foto,mime]);res.sendStatus(204);
});
app.post('/api/v1/configuracion/procesos/:id/mesas',async(req,res)=>{await comprobarPropio(req.params.id,res.locals.actor.idOrganizacion);const d=mesa.parse(req.body);await db.query('INSERT INTO tuvoto_mesas(id,id_proceso,codigo,unidad) VALUES($1,$2,$3,$4)',[randomUUID(),req.params.id,d.codigo,d.unidad]);res.status(201).json(await obtener(req.params.id));});
app.post('/api/v1/configuracion/mesas/:id/asignar',async(req,res)=>{
 const id=uuid.parse(req.params.id),d=z.object({idUsuario:uuid}).strict().parse(req.body);
 const r=await db.query('SELECT p.id FROM tuvoto_mesas m JOIN tuvoto_procesos p ON p.id=m.id_proceso WHERE m.id=$1 AND p.id_organizacion=$2',[id,res.locals.actor.idOrganizacion]);if(!r.rowCount){res.sendStatus(404);return;}
 const resp=await fetch((process.env.IDENTIDAD_URL??'http://identidad:3000')+'/api/v1/usuarios',{headers:{Cookie:req.header('Cookie')??'','X-Organizacion':res.locals.actor.idOrganizacion},signal:AbortSignal.timeout(3000)});
 if(!resp.ok){res.status(503).json({detalle:'No se pudo verificar la cuenta'});return;}
 const usuarios=await resp.json();if(!usuarios.elementos.some((u:{idUsuario:string;activo:boolean;roles:{rol:string;idOrganizacion:string|null}[]})=>u.idUsuario===d.idUsuario&&u.activo&&u.roles.some(r=>r.rol==='OPERADOR'&&r.idOrganizacion===res.locals.actor.idOrganizacion)&&!u.roles.some(r=>r.rol==='ADMINISTRADOR'&&(r.idOrganizacion===null||r.idOrganizacion===res.locals.actor.idOrganizacion)))){res.status(403).json({detalle:'Cuenta fuera del alcance autorizado'});return;}
 const asignada=await configurarBloqueado(r.rows[0].id,async c=>{const candidatos=await c.query('SELECT 1 FROM tuvoto_candidatos WHERE id_proceso=$1 LIMIT 1',[r.rows[0].id]);if(!candidatos.rowCount)return false;await c.query('INSERT INTO tuvoto_asignaciones(id_mesa,id_usuario) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,d.idUsuario]);return true;});
 if(!asignada){res.status(409).json({detalle:'Configure candidatos antes de asignar mesas'});return;}res.sendStatus(204);
});
app.get('/api/v1/mis-mesas',async(req,res)=>{try{const a=await permiso(req,'actas:consultar',false);const r=await db.query('SELECT m.id,m.codigo,m.unidad,m.id_proceso AS "idProceso",p.nombre FROM tuvoto_mesas m JOIN tuvoto_procesos p ON p.id=m.id_proceso WHERE p.id_organizacion=$2 AND p.actual AND NOT p.archivado AND ($3 OR EXISTS(SELECT 1 FROM tuvoto_asignaciones a WHERE a.id_mesa=m.id AND a.id_usuario=$1))',[a.idUsuario,a.idOrganizacion,Boolean(a.esAuditor)]);res.json({elementos:r.rows});}catch(e){res.status((e as any).estado??503).json({detalle:'Mesas no autorizadas'});}});
app.get('/api/v1/mesas/:id/contexto',async(req,res)=>{try{const a=await permiso(req,'actas:consultar',false);const r=await db.query('SELECT m.id,m.id_proceso AS "idProceso",m.codigo,m.unidad FROM tuvoto_mesas m JOIN tuvoto_procesos p ON p.id=m.id_proceso JOIN tuvoto_asignaciones a ON a.id_mesa=m.id WHERE m.id=$1 AND a.id_usuario=$2 AND p.id_organizacion=$3 AND p.actual AND NOT p.archivado',[uuid.parse(req.params.id),a.idUsuario,a.idOrganizacion]);if(!r.rowCount){res.sendStatus(403);return;}const p=await obtener(r.rows[0].idProceso);res.json({...r.rows[0],candidatos:p!.candidatos});}catch(e){res.status((e as any).estado??503).json({detalle:'Mesa no autorizada'});}});
app.use((e:any,_req:Request,res:Response,_next:NextFunction)=>{res.status(e instanceof z.ZodError?422:e.code==='23505'?409:e.estado??500).json({detalle:e.code==='23505'?'Registro duplicado':'No se pudo completar la operación'});});
await db.query(`CREATE TABLE IF NOT EXISTS tuvoto_procesos(id UUID PRIMARY KEY,id_organizacion UUID NOT NULL,nombre TEXT NOT NULL,cargo TEXT NOT NULL,tipo TEXT NOT NULL,unidad TEXT NOT NULL,actual BOOLEAN NOT NULL DEFAULT false,archivado BOOLEAN NOT NULL DEFAULT false,creado_en TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE tuvoto_procesos ADD COLUMN IF NOT EXISTS archivado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tuvoto_procesos ADD COLUMN IF NOT EXISTS publicado BOOLEAN NOT NULL DEFAULT false;
UPDATE tuvoto_procesos SET publicado=true WHERE actual AND NOT archivado AND NOT publicado;
CREATE UNIQUE INDEX IF NOT EXISTS tuvoto_actual_unico ON tuvoto_procesos(actual) WHERE actual;
CREATE TABLE IF NOT EXISTS tuvoto_candidatos(id UUID PRIMARY KEY,id_proceso UUID NOT NULL REFERENCES tuvoto_procesos(id),nombre TEXT NOT NULL,orden SERIAL,foto BYTEA,mime TEXT,UNIQUE(id_proceso,nombre));
CREATE TABLE IF NOT EXISTS tuvoto_mesas(id UUID PRIMARY KEY,id_proceso UUID NOT NULL REFERENCES tuvoto_procesos(id),codigo TEXT NOT NULL,unidad TEXT NOT NULL,UNIQUE(id_proceso,codigo));
CREATE TABLE IF NOT EXISTS tuvoto_asignaciones(id_mesa UUID NOT NULL REFERENCES tuvoto_mesas(id),id_usuario UUID NOT NULL,PRIMARY KEY(id_mesa,id_usuario));`);
const interno=servicioMesas(db,async(cabeceras,accion,plazo)=>permiso({header:(nombre:string)=>cabeceras[nombre.toLowerCase()]} as Request,accion,false,AbortSignal.timeout(plazo)),process.env.CLAVE_CLIENTE_ACTAS??'',process.env.CONTRATO_GRPC??'/app/mesa-v1.proto');
await new Promise<void>((aceptar,rechazar)=>interno.bindAsync('0.0.0.0:'+Number(process.env.PUERTO_GRPC??50051),grpc.ServerCredentials.createInsecure(),error=>error?rechazar(error):aceptar()));
app.listen(Number(process.env.PORT??3000),'0.0.0.0');
