import { rutasEliminaciones } from './eliminaciones.js';
import { rutasMesasCompartidas } from './mesas-compartidas.js';
import { rutasCargosUniversitarios, comprobarGrupoDirector } from './cargos-universitarios.js';
import { prepararNuevoConteo } from './reiniciar.js';
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
import { esquemaProceso, esquemaMesa, opciones, sectorValido, unidadValida, exigirBorrador, validarTransicion, ESQUEMA } from './modelo.js';
import { rutasImportaciones, buscarOperador } from './importaciones.js';
import { rutasImportacionesGenerales } from './importaciones-generales.js';

const db = new Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
const app = express(); app.disable('x-powered-by'); instalarHttp(app,'elecciones'); app.use(express.json({limit:'3mb'}));
const uuid = z.string().uuid();
const proceso=esquemaProceso;const mesa=esquemaMesa;
const contrato=readFileSync(process.env.CONTRATO_OPENAPI??'/app/contrato.json','utf8');
app.use('/docs',swagger.serveFiles(JSON.parse(contrato)),swagger.setup(JSON.parse(contrato)));
app.get('/openapi.json',(_req,res)=>{res.type('application/json').send(contrato);});
app.get('/api/v1/salud',async (_req,res)=>{await db.query('SELECT 1');res.json({servicio:'elecciones',estado:'saludable'});});
async function obtener(id:string) {
 const r=await db.query('SELECT id,nombre,cargo,tipo,unidad,actual,publicado,estado,configuracion FROM tuvoto_procesos WHERE id=$1 AND NOT eliminada',[id]); if(!r.rowCount)return null;
 const candidatos=await db.query('SELECT id,nombre,orden,id_candidato_origen AS "idCandidatoOrigen",foto IS NOT NULL AS "tieneFoto" FROM tuvoto_candidatos WHERE id_proceso=$1 AND NOT eliminada ORDER BY orden,id',[id]);
 const mesas=await db.query('SELECT m.id,m.codigo,m.unidad,m.sector,m.id_mesa_fisica AS "idMesaFisica",f.recinto,f.apellido_desde AS "apellidoDesde",f.apellido_hasta AS "apellidoHasta" FROM tuvoto_mesas m LEFT JOIN tuvoto_mesas_fisicas f ON f.id=m.id_mesa_fisica WHERE m.id_proceso=$1 AND NOT m.eliminada ORDER BY m.unidad,m.codigo',[id]);
 return {...r.rows[0],ambito:'',vuelta:1,idPrimeraVuelta:null,sectores:[],ponderacion:false,reglaSegundaVuelta:null,...r.rows[0].configuracion,configuracion:undefined,candidatos:candidatos.rows.map(c=>({...c,foto:c.tieneFoto?`/api/v1/publico/candidatos/${c.id}/foto`:null})),mesas:mesas.rows};
}
app.get('/api/v1/publico/eventos',async(_req,res)=>{const r=await db.query(`SELECT id,id_organizacion AS "idOrganizacion",nombre,cargo,tipo,actual,publicado,archivado,estado,configuracion FROM tuvoto_procesos WHERE (publicado OR actual) AND NOT archivado AND NOT eliminada ORDER BY nombre,id`);res.set('Cache-Control','public,max-age=3').json({elementos:agruparEventos(r.rows)});});
app.get('/api/v1/publico/actual',async(_req,res)=>{const r=await db.query('SELECT id FROM tuvoto_procesos WHERE actual AND NOT archivado');res.set('Cache-Control','public,max-age=3');res.json(r.rowCount?await obtener(r.rows[0].id):null);});
app.get('/api/v1/publico/elecciones',async(_req,res)=>{const actual=await db.query('SELECT id_organizacion FROM tuvoto_procesos WHERE actual AND NOT archivado');if(!actual.rowCount){res.json({elementos:[]});return;}const r=await db.query('SELECT id,nombre,cargo,tipo,configuracion FROM tuvoto_procesos WHERE id_organizacion=$1 AND (publicado OR actual) AND NOT archivado ORDER BY creado_en,id',[actual.rows[0].id_organizacion]);res.json({elementos:r.rows.map(p=>({id:p.id,nombre:p.nombre,cargo:p.cargo,tipo:p.tipo,ambito:p.configuracion.ambito??'',vuelta:p.configuracion.vuelta??1}))});});
app.get('/api/v1/publico/procesos/:id',async(req,res)=>{const id=uuid.parse(req.params.id);if(!(await db.query('SELECT 1 FROM tuvoto_procesos WHERE id=$1 AND (publicado OR actual) AND NOT archivado',[id])).rowCount){res.status(404).json({detalle:'Recurso no disponible'});return;}res.json(await obtener(id));});
app.get('/api/v1/publico/candidatos/:id/foto',async(req,res)=>{
 const id=uuid.parse(req.params.id);const r=await db.query('SELECT c.foto,c.mime FROM tuvoto_candidatos c JOIN tuvoto_procesos p ON p.id=c.id_proceso WHERE c.id=$1 AND (p.actual OR p.publicado) AND NOT p.archivado AND NOT p.eliminada AND NOT c.eliminada',[id]);
 if(!r.rowCount||!r.rows[0].foto){res.status(404).json({detalle:'Recurso no disponible'});return;}res.set({'Content-Type':r.rows[0].mime,'X-Content-Type-Options':'nosniff','Cache-Control':'public,max-age=60'}).send(r.rows[0].foto);
});
app.use('/api/v1/configuracion',async(req:Request,res:Response,next:NextFunction)=>{try{res.locals.actor=await permiso(req,'proceso:configurar',!['GET','HEAD'].includes(req.method));next();}catch(e){res.status((e as {estado?:number}).estado??503).json({detalle:'Configuración no autorizada'});}});
rutasEliminaciones(app,db);
rutasMesasCompartidas(app,db);
rutasImportaciones(app,db);
rutasImportacionesGenerales(app,db);
rutasCargosUniversitarios(app,db);
app.get('/api/v1/configuracion/asignaciones',async(_req,res)=>{const r=await db.query(`SELECT a.id_usuario AS "idUsuario",m.id AS "idMesa",m.codigo,m.unidad,m.sector,m.id_mesa_fisica AS "idMesaFisica",p.id AS "idProceso",p.cargo,p.nombre,p.estado,COALESCE(p.configuracion->>'ambito','') AS ambito FROM tuvoto_asignaciones a JOIN tuvoto_mesas m ON m.id=a.id_mesa JOIN tuvoto_procesos p ON p.id=m.id_proceso WHERE p.id_organizacion=$1 AND NOT p.eliminada AND NOT m.eliminada AND p.estado<>'archivada' ORDER BY p.cargo,m.codigo,a.id_usuario`,[res.locals.actor.idOrganizacion]);res.json({elementos:r.rows});});
app.get('/api/v1/configuracion/procesos',async(_req,res)=>{const r=await db.query('SELECT id FROM tuvoto_procesos WHERE id_organizacion=$1 AND NOT eliminada ORDER BY creado_en DESC',[res.locals.actor.idOrganizacion]);res.json({elementos:await Promise.all(r.rows.map(r=>obtener(r.id)))});});
app.post('/api/v1/configuracion/procesos',async(req,res)=>{const d=proceso.parse(req.body),id=randomUUID();const crear=async(c:Pool|PoolClient)=>{await c.query('SELECT pg_advisory_xact_lock(hashtext($1),607004)',[res.locals.actor.idOrganizacion]);await comprobarVuelta(d,res.locals.actor.idOrganizacion);await comprobarGrupoDirector(c,res.locals.actor.idOrganizacion,d);await c.query('INSERT INTO tuvoto_procesos(id,id_organizacion,nombre,cargo,tipo,unidad,configuracion) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,res.locals.actor.idOrganizacion,d.nombre,d.cargo,d.tipo,d.unidad,JSON.stringify(opciones(d))]);};if(d.idPrimeraVuelta)await configurarBloqueado(d.idPrimeraVuelta,crear,false);else {const c=await db.connect();try{await c.query('BEGIN');await crear(c);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}res.status(201).json(await obtener(id));});
async function comprobarVuelta(d:any,org:string){if(!d.idPrimeraVuelta)return;const p=await obtener(d.idPrimeraVuelta);await comprobarPropio(d.idPrimeraVuelta,org);if(!p||p.vuelta!==1||p.cargo!==d.cargo||p.ambito!==d.ambito)throw Object.assign(new Error(),{estado:422,detalle:'La primera vuelta debe pertenecer al mismo cargo y ámbito'});}
async function comprobarPropio(id:string,org:string) {const r=await db.query('SELECT 1 FROM tuvoto_procesos WHERE id=$1 AND id_organizacion=$2 AND NOT eliminada',[uuid.parse(id),org]);if(!r.rowCount)throw Object.assign(new Error(),{estado:404});}
app.get('/api/v1/configuracion/procesos/:id',async(req,res)=>{await comprobarPropio(req.params.id,res.locals.actor.idOrganizacion);res.json(await obtener(req.params.id));});
app.put('/api/v1/configuracion/procesos/:id',async(req,res)=>{
 await comprobarPropio(req.params.id,res.locals.actor.idOrganizacion);const d=proceso.parse(req.body);const previo=await obtener(req.params.id);if(previo!.vuelta!==d.vuelta||previo!.idPrimeraVuelta!==d.idPrimeraVuelta)throw Object.assign(new Error(),{estado:409,detalle:'La vuelta y su referencia se fijan al crear la elección'});await comprobarVuelta(d,res.locals.actor.idOrganizacion);
 const cambiado=await configurarBloqueado(req.params.id,async c=>{await c.query('SELECT pg_advisory_xact_lock(hashtext($1),607004)',[res.locals.actor.idOrganizacion]);await comprobarGrupoDirector(c,res.locals.actor.idOrganizacion,d,req.params.id);const mesas=(await c.query('SELECT sector,unidad FROM tuvoto_mesas WHERE id_proceso=$1 AND NOT eliminada',[req.params.id])).rows;if(mesas.some(m=>!sectorValido(d,m.sector)||!unidadValida(d,m.unidad)))throw Object.assign(new Error(),{estado:409,detalle:'Hay mesas de un sector o carrera que intentas retirar'});if((await c.query("SELECT 1 FROM tuvoto_procesos WHERE configuracion->>'idPrimeraVuelta'=$1 AND NOT eliminada LIMIT 1",[req.params.id])).rowCount)throw Object.assign(new Error(),{estado:409});await c.query('UPDATE tuvoto_procesos SET nombre=$2,cargo=$3,tipo=$4,unidad=$5,configuracion=$6 WHERE id=$1',[req.params.id,d.nombre,d.cargo,d.tipo,d.unidad,JSON.stringify(opciones(d))]);return true;});
 if(!cambiado){res.status(409).json({detalle:'Configuración congelada: existen mesas asignadas'});return;}res.json(await obtener(req.params.id));
});
app.delete('/api/v1/configuracion/procesos/:id',async(req,res)=>{
 await comprobarPropio(req.params.id,res.locals.actor.idOrganizacion);
 await configurarBloqueado(req.params.id,async c=>{
  if((await c.query("SELECT 1 FROM tuvoto_procesos WHERE configuracion->>'idPrimeraVuelta'=$1 AND NOT eliminada LIMIT 1",[req.params.id])).rowCount)throw Object.assign(new Error(),{estado:409,detalle:'Otra vuelta conserva una referencia a esta elección'});
  await c.query('UPDATE tuvoto_procesos SET eliminada=true WHERE id=$1',[req.params.id]);
  await c.query('INSERT INTO historial_procesos(id,id_proceso,id_actor,anterior,nuevo) VALUES($1,$2,$3,$4,$5)',[randomUUID(),req.params.id,res.locals.actor.idUsuario,'borrador','eliminada']);
 });res.sendStatus(204);
});
app.get('/api/v1/configuracion/procesos/:id/historial',async(req,res)=>{await comprobarPropio(req.params.id,res.locals.actor.idOrganizacion);res.json({elementos:(await db.query('SELECT anterior,nuevo,creado_en FROM historial_procesos WHERE id_proceso=$1 ORDER BY creado_en,id',[req.params.id])).rows});});
app.post('/api/v1/configuracion/procesos/:id/estado',async(req,res)=>{
 await comprobarPropio(req.params.id,res.locals.actor.idOrganizacion);
 const d=z.object({estado:z.enum(['cerrada','archivada']),confirmar:z.literal(true)}).strict().parse(req.body);
 const c=await db.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(607001)');const p=(await c.query('SELECT estado FROM tuvoto_procesos WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];validarTransicion(p.estado,d.estado);
 if((await c.query('SELECT 1 FROM registros_en_curso WHERE id_proceso=$1 LIMIT 1',[req.params.id])).rowCount)throw Object.assign(new Error(),{estado:409,detalle:'Hay un acta en curso. Espera su confirmación antes de cerrar'});
 await c.query(`UPDATE tuvoto_procesos SET estado=$2,archivado=($2='archivada'),actual=CASE WHEN $2='archivada' THEN false ELSE actual END WHERE id=$1`,[req.params.id,d.estado]);
 await c.query('INSERT INTO historial_procesos(id,id_proceso,id_actor,anterior,nuevo) VALUES($1,$2,$3,$4,$5)',[randomUUID(),req.params.id,res.locals.actor.idUsuario,p.estado,d.estado]);await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}res.json(await obtener(req.params.id));
});
app.post('/api/v1/configuracion/procesos/:id/reiniciar',async(req,res)=>{
 z.object({confirmar:z.literal(true)}).strict().parse(req.body);
 const c=await db.connect();let nuevo:string;try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(607001)');nuevo=await prepararNuevoConteo(c,uuid.parse(req.params.id),res.locals.actor.idOrganizacion,res.locals.actor.idUsuario);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 res.status(201).json(await obtener(nuevo));
});
app.post('/api/v1/configuracion/procesos/:id/actual',async(req,res)=>{
 z.object({confirmar:z.literal(true)}).strict().parse(req.body);await comprobarPropio(req.params.id,res.locals.actor.idOrganizacion);const c=await db.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(607001)');await c.query('SELECT id FROM tuvoto_procesos WHERE id=$1 FOR UPDATE',[req.params.id]);const p=await obtener(req.params.id);if(!p)throw Object.assign(new Error(),{estado:404});if(!['borrador','recepcion','cerrada'].includes(p.estado))throw Object.assign(new Error(),{estado:409,detalle:'Una elección archivada no se puede publicar'});if(!p?.candidatos.length||!p.mesas.length||(p.vuelta===2&&p.candidatos.length!==2)||p.sectores.some((s:any)=>!p.mesas.some((m:any)=>m.sector===s.codigo)))throw Object.assign(new Error(),{estado:422,detalle:'Completa candidatos y mesas de todos los sectores antes de publicar'});if(p.estado==='borrador'&&(await c.query('SELECT 1 FROM tuvoto_mesas m WHERE m.id_proceso=$1 AND NOT m.eliminada AND NOT EXISTS(SELECT 1 FROM tuvoto_asignaciones a WHERE a.id_mesa=m.id) LIMIT 1',[req.params.id])).rowCount)throw Object.assign(new Error(),{estado:422,detalle:'Asigna un operador a cada mesa antes de iniciar el conteo'});await c.query('SELECT pg_advisory_xact_lock(607001)');const anterior=await c.query('SELECT id_organizacion FROM tuvoto_procesos WHERE actual FOR UPDATE');if(anterior.rowCount&&anterior.rows[0].id_organizacion!==res.locals.actor.idOrganizacion&&!res.locals.actor.administradorGlobal)throw Object.assign(new Error(),{estado:403});await c.query('UPDATE tuvoto_procesos SET actual=false WHERE actual');await c.query("UPDATE tuvoto_procesos SET actual=true,publicado=true,estado=CASE WHEN estado='borrador' THEN 'recepcion' ELSE estado END WHERE id=$1",[req.params.id]);if(p.estado==='borrador')await c.query('INSERT INTO historial_procesos(id,id_proceso,id_actor,anterior,nuevo) VALUES($1,$2,$3,$4,$5)',[randomUUID(),req.params.id,res.locals.actor.idUsuario,'borrador','recepcion']);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}res.json(await obtener(req.params.id));
});
function leerImagen(valor?:string){
 let foto:Buffer|null=null,mime:string|null=null;
 if(valor){const m=/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(valor);if(!m)throw Object.assign(new Error(),{estado:422});foto=Buffer.from(m[2],'base64');mime=m[1];if(foto.length>2000000||!(mime==='image/jpeg'?foto.subarray(0,3).equals(Buffer.from([255,216,255])):foto.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))))throw Object.assign(new Error(),{estado:422});}
 return {foto,mime};
}
async function configurarBloqueado<T>(id:string,operacion:(c:PoolClient)=>Promise<T>,soloBorrador=true):Promise<T>{
 const c=await db.connect();try{await c.query('BEGIN');const p=(await c.query('SELECT estado,eliminada FROM tuvoto_procesos WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!p)throw Object.assign(new Error(),{estado:404});if(soloBorrador)exigirBorrador(p);const resultado=await operacion(c);await c.query('COMMIT');return resultado;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
app.post('/api/v1/configuracion/procesos/:id/candidatos',async(req,res)=>{
 await comprobarPropio(req.params.id,res.locals.actor.idOrganizacion);
 const d=z.object({nombre:z.string().trim().min(1).max(120).optional(),foto:z.string().max(2800000).optional(),idCandidatoOrigen:uuid.optional()}).strict().parse(req.body);
 const resultado=await configurarBloqueado(req.params.id,async c=>{const p=await obtener(req.params.id);let nombre=d.nombre,imagen=leerImagen(d.foto),origen:string|null=null;
  if(p!.vuelta===2){const r=await c.query('SELECT id,nombre,foto,mime FROM tuvoto_candidatos WHERE id=$1 AND id_proceso=$2 AND NOT eliminada FOR SHARE',[d.idCandidatoOrigen??null,p!.idPrimeraVuelta]);if(!r.rowCount||p!.candidatos.length>=2||p!.candidatos.some((v:any)=>v.idCandidatoOrigen===d.idCandidatoOrigen))throw Object.assign(new Error(),{estado:422});nombre=r.rows[0].nombre;imagen={foto:r.rows[0].foto,mime:r.rows[0].mime};origen=r.rows[0].id;}else if(!nombre||d.idCandidatoOrigen)throw Object.assign(new Error(),{estado:422});
  if(p!.candidatos.length>=100)throw Object.assign(new Error(),{estado:422});const agregado=await c.query('INSERT INTO tuvoto_candidatos(id,id_proceso,nombre,foto,mime,id_candidato_origen) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id_proceso,nombre) DO UPDATE SET eliminada=false,foto=COALESCE(EXCLUDED.foto,tuvoto_candidatos.foto),mime=COALESCE(EXCLUDED.mime,tuvoto_candidatos.mime) WHERE tuvoto_candidatos.eliminada RETURNING id',[randomUUID(),req.params.id,nombre,imagen.foto,imagen.mime,origen]);if(!agregado.rowCount)throw Object.assign(new Error(),{estado:409,detalle:'Candidato ya registrado'});});res.status(201).json(await obtener(req.params.id));
});
app.get('/api/v1/configuracion/candidatos/:id/foto',async(req,res)=>{
 res.set('Cache-Control','private, no-store');
 const id=uuid.parse(req.params.id);
 const r=await db.query('SELECT c.foto,c.mime FROM tuvoto_candidatos c JOIN tuvoto_procesos p ON p.id=c.id_proceso WHERE c.id=$1 AND p.id_organizacion=$2 AND NOT p.eliminada AND NOT c.eliminada',[id,res.locals.actor.idOrganizacion]);
 if(!r.rowCount||!r.rows[0].foto){res.status(404).json({detalle:'Fotografía no disponible'});return;}
 res.set({'Content-Type':r.rows[0].mime,'X-Content-Type-Options':'nosniff'}).send(r.rows[0].foto);
});
app.put('/api/v1/configuracion/candidatos/:id/foto',async(req,res)=>{
 const id=uuid.parse(req.params.id),d=z.object({foto:z.string().min(1).max(2800000)}).strict().parse(req.body);
 const propio=await db.query('SELECT p.id FROM tuvoto_candidatos c JOIN tuvoto_procesos p ON p.id=c.id_proceso WHERE c.id=$1 AND p.id_organizacion=$2 AND NOT p.eliminada AND NOT c.eliminada',[id,res.locals.actor.idOrganizacion]);
 if(!propio.rowCount){res.status(404).json({detalle:'Recurso no disponible'});return;}
 const {foto,mime}=leerImagen(d.foto);await configurarBloqueado(propio.rows[0].id,async c=>{const actualizada=await c.query('UPDATE tuvoto_candidatos SET foto=$2,mime=$3 WHERE id=$1 AND NOT eliminada RETURNING id',[id,foto,mime]);if(!actualizada.rowCount)throw Object.assign(new Error(),{estado:404});});res.sendStatus(204);
});
app.post('/api/v1/configuracion/procesos/:id/mesas',async(req,res)=>{await comprobarPropio(req.params.id,res.locals.actor.idOrganizacion);const d=mesa.parse(req.body);await configurarBloqueado(req.params.id,async c=>{const p=await obtener(req.params.id);if(!sectorValido(p,d.sector)||!unidadValida(p,d.unidad))throw Object.assign(new Error(),{estado:422,detalle:'Selecciona un sector y una carrera del cargo'});const agregada=await c.query('INSERT INTO tuvoto_mesas(id,id_proceso,codigo,unidad,sector) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id_proceso,codigo) DO UPDATE SET eliminada=false WHERE tuvoto_mesas.eliminada AND tuvoto_mesas.unidad=EXCLUDED.unidad AND tuvoto_mesas.sector=EXCLUDED.sector RETURNING id',[randomUUID(),req.params.id,d.codigo,d.unidad,d.sector]);if(!agregada.rowCount)throw Object.assign(new Error(),{estado:409,detalle:'Código de mesa registrado o reservado con otros datos'});});res.status(201).json(await obtener(req.params.id));});
app.get('/api/v1/configuracion/procesos/:id/asignaciones',async(req,res)=>{await comprobarPropio(req.params.id,res.locals.actor.idOrganizacion);const r=await db.query('SELECT a.id_mesa AS "idMesa",a.id_usuario AS "idUsuario",m.codigo,m.unidad,m.sector FROM tuvoto_asignaciones a JOIN tuvoto_mesas m ON m.id=a.id_mesa WHERE m.id_proceso=$1 AND NOT m.eliminada ORDER BY m.codigo,a.id_usuario',[req.params.id]);res.json({elementos:r.rows});});
app.post('/api/v1/configuracion/mesas/:id/asignar',async(req,res)=>{
 const id=uuid.parse(req.params.id),d=z.object({idUsuario:uuid}).strict().parse(req.body);
 const r=await db.query('SELECT p.id FROM tuvoto_mesas m JOIN tuvoto_procesos p ON p.id=m.id_proceso WHERE m.id=$1 AND p.id_organizacion=$2 AND NOT p.eliminada AND NOT m.eliminada',[id,res.locals.actor.idOrganizacion]);if(!r.rowCount){res.status(404).json({detalle:'Recurso no disponible'});return;}
 const operador=await buscarOperador(req,res.locals.actor.idOrganizacion,{idUsuario:d.idUsuario});if(!operador){res.status(403).json({detalle:'Operador fuera del alcance autorizado'});return;}
 await configurarBloqueado(r.rows[0].id,async c=>{if(!(await c.query('SELECT 1 FROM tuvoto_mesas WHERE id=$1 AND NOT eliminada',[id])).rowCount)throw Object.assign(new Error(),{estado:404});await c.query('INSERT INTO tuvoto_asignaciones(id_mesa,id_usuario) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,d.idUsuario]);});res.sendStatus(204);
});
app.get('/api/v1/mis-mesas',async(req,res)=>{try{const a=await permiso(req,'actas:consultar',false);const r=await db.query('SELECT m.id,m.codigo,m.unidad,m.sector,m.id_mesa_fisica AS "idMesaFisica",m.id_proceso AS "idProceso",p.nombre,p.cargo,p.estado FROM tuvoto_mesas m JOIN tuvoto_procesos p ON p.id=m.id_proceso WHERE p.id_organizacion=$2 AND (p.actual OR p.publicado) AND NOT p.archivado AND NOT p.eliminada AND NOT m.eliminada AND ($3 OR EXISTS(SELECT 1 FROM tuvoto_asignaciones a WHERE a.id_mesa=m.id AND a.id_usuario=$1))',[a.idUsuario,a.idOrganizacion,Boolean(a.esAuditor)]);res.json({elementos:r.rows});}catch(e){res.status((e as any).estado??503).json({detalle:'Mesas no autorizadas'});}});
app.get('/api/v1/mesas/:id/contexto',async(req,res)=>{try{const a=await permiso(req,'actas:consultar',false);const r=await db.query('SELECT m.id,m.id_proceso AS "idProceso",m.codigo,m.unidad,m.sector,m.id_mesa_fisica AS "idMesaFisica",p.estado FROM tuvoto_mesas m JOIN tuvoto_procesos p ON p.id=m.id_proceso JOIN tuvoto_asignaciones a ON a.id_mesa=m.id WHERE m.id=$1 AND a.id_usuario=$2 AND p.id_organizacion=$3 AND (p.actual OR p.publicado) AND NOT p.archivado AND NOT p.eliminada AND NOT m.eliminada',[uuid.parse(req.params.id),a.idUsuario,a.idOrganizacion]);if(!r.rowCount){res.status(403).json({detalle:'Acceso no autorizado'});return;}const p=await obtener(r.rows[0].idProceso);res.json({...r.rows[0],cargo:p!.cargo,sectorNombre:p!.sectores.find((s:any)=>s.codigo===r.rows[0].sector)?.nombre??'General',candidatos:p!.candidatos});}catch(e){res.status((e as any).estado??503).json({detalle:'Mesa no autorizada'});}});
app.use((e:any,_req:Request,res:Response,_next:NextFunction)=>{res.status(e instanceof z.ZodError?422:e.code==='23505'?409:e.estado??500).json({detalle:e.code==='23505'?'Registro duplicado':e.detalle??'No se pudo completar la operación'});});
const migracion=await db.connect();try{await migracion.query('BEGIN');await migracion.query('SELECT pg_advisory_xact_lock(607002)');await migracion.query(ESQUEMA);await migracion.query('COMMIT');}catch(e){await migracion.query('ROLLBACK');throw e;}finally{migracion.release();}
const interno=servicioMesas(db,async(cabeceras,accion,plazo)=>permiso({header:(nombre:string)=>cabeceras[nombre.toLowerCase()]} as Request,accion,false,AbortSignal.timeout(plazo)),process.env.CLAVE_CLIENTE_ACTAS??'',process.env.CONTRATO_GRPC??'/app/mesa-v1.proto');
await new Promise<void>((aceptar,rechazar)=>interno.bindAsync('0.0.0.0:'+Number(process.env.PUERTO_GRPC??50051),grpc.ServerCredentials.createInsecure(),error=>error?rechazar(error):aceptar()));
app.listen(Number(process.env.PORT??3000),'0.0.0.0');
