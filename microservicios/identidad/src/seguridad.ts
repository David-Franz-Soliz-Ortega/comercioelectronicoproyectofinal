import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Express, Request, Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

export const roles = ['SUPERADMIN','ADMIN_ELECTORAL','OPERADOR','ELECTOR','AUDITOR'] as const;
const uuid = z.string().uuid();
const cookieSegura = process.env.COOKIE_SEGURA === 'true' || (process.env.COOKIE_SEGURA !== 'false' && process.env.NODE_ENV === 'production');
const cookieSesion = cookieSegura ? '__Host-sigape-sesion' : 'sigape-sesion';
const cookieCsrf = cookieSegura ? '__Host-sigape-csrf' : 'sigape-csrf';
const duracion = Number(process.env.SESION_SEGUNDOS ?? 1800);
const origenes = (process.env.ORIGEN_PUBLICO ?? 'http://localhost:8080,http://127.0.0.1:8080')
  .split(',')
  .map(x => x.trim())
  .filter(Boolean);
const hash = (valor: string) => createHash('sha256').update(valor).digest('hex');
const secreto = () => randomBytes(32).toString('base64url');
export function cookies(req: Request): Record<string,string> {
  return Object.fromEntries((req.headers.cookie ?? '').split(';').map(x => x.trim().split('=')).filter(x => x.length === 2));
}
function tokenSesion(req: Request): string {
  const c = cookies(req);
  return c[cookieSesion] ?? c['__Host-sigape-sesion'] ?? c['sigape-sesion'] ?? '';
}
function tokenCsrf(req: Request): string {
  const c = cookies(req);
  return c[cookieCsrf] ?? c['__Host-sigape-csrf'] ?? c['sigape-csrf'] ?? '';
}
function iguales(a: string,b: string) { return !!a && a.length === b.length && timingSafeEqual(Buffer.from(a),Buffer.from(b)); }
export function error(res: Response,codigo: number,detalle: string) {
  return res.status(codigo).type('application/problem+json').json({type:'about:blank',title:'Solicitud no autorizada',status:codigo,detail:detalle});
}
function csrf(req: Request): boolean {
  const origenReq = req.header('Origin') ?? '';
  return origenes.includes(origenReq) && iguales(tokenCsrf(req), req.header('X-CSRF-Token') ?? '');
}
export async function migrarSeguridad(pool: Pool) {
  if (!Number.isInteger(duracion) || duracion<1 || duracion>86400) throw new Error('SESION_SEGUNDOS inválido');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizaciones(id UUID PRIMARY KEY,nombre VARCHAR(120) NOT NULL,activa BOOLEAN NOT NULL DEFAULT true);
    CREATE TABLE IF NOT EXISTS usuarios(id UUID PRIMARY KEY,usuario VARCHAR(80) UNIQUE NOT NULL,clave_hash TEXT NOT NULL,activo BOOLEAN NOT NULL DEFAULT true,creado_en TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS asignaciones_roles(id UUID PRIMARY KEY,id_usuario UUID NOT NULL REFERENCES usuarios(id),rol VARCHAR(32) NOT NULL CHECK(rol IN ('SUPERADMIN','ADMIN_ELECTORAL','OPERADOR','ELECTOR','AUDITOR')),id_organizacion UUID REFERENCES organizaciones(id),CHECK((rol='SUPERADMIN')=(id_organizacion IS NULL)));
    CREATE UNIQUE INDEX IF NOT EXISTS rol_unico ON asignaciones_roles(id_usuario,rol,COALESCE(id_organizacion,'00000000-0000-0000-0000-000000000000'));
    CREATE TABLE IF NOT EXISTS sesiones(hash TEXT PRIMARY KEY,id_usuario UUID NOT NULL REFERENCES usuarios(id),csrf_hash TEXT NOT NULL,expira_en TIMESTAMPTZ NOT NULL,revocada BOOLEAN NOT NULL DEFAULT false,creada_en TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS intentos_autenticacion(clave TEXT PRIMARY KEY,ventana TIMESTAMPTZ NOT NULL DEFAULT now(),intentos INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS recuperaciones(hash TEXT PRIMARY KEY,id_usuario UUID NOT NULL REFERENCES usuarios(id),expira_en TIMESTAMPTZ NOT NULL,usada BOOLEAN NOT NULL DEFAULT false);
    CREATE TABLE IF NOT EXISTS auditoria_seguridad(id UUID PRIMARY KEY,id_actor UUID,id_organizacion UUID,accion TEXT NOT NULL,objetivo TEXT,creado_en TIMESTAMPTZ NOT NULL DEFAULT now());
    ALTER TABLE sesiones ADD COLUMN IF NOT EXISTS id_organizacion UUID REFERENCES organizaciones(id);
    CREATE INDEX IF NOT EXISTS sesiones_usuario ON sesiones(id_usuario);
    CREATE INDEX IF NOT EXISTS auditoria_organizacion ON auditoria_seguridad(id_organizacion,creado_en);
  `);
}
const esquemaClave = z.string().min(12).refine(v => Buffer.byteLength(v,'utf8')<=72,'Máximo 72 bytes');
const esquemaUsuario = z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,80}$/);
async function auditar(db: Pool|PoolClient,accion: string,actor: string|null=null,organizacion: string|null=null,objetivo: string|null=null) {
  await db.query('INSERT INTO auditoria_seguridad VALUES($1,$2,$3,$4,$5,now())',[randomUUID(),actor,organizacion,accion,objetivo]);
}
export async function bootstrap(pool: Pool,entrada: unknown) {
  const datos=z.object({usuario:esquemaUsuario,contrasena:esquemaClave}).strict().parse(entrada);
  const db=await pool.connect();
  try {
    await db.query('BEGIN');await db.query("SELECT pg_advisory_xact_lock(600001)");
    if ((await db.query("SELECT 1 FROM asignaciones_roles WHERE rol='SUPERADMIN'")).rowCount) throw new Error('Bootstrap ya realizado');
    const id=randomUUID();await db.query('INSERT INTO usuarios(id,usuario,clave_hash) VALUES($1,$2,$3)',[id,datos.usuario,await bcrypt.hash(datos.contrasena,12)]);
    await db.query("INSERT INTO asignaciones_roles VALUES($1,$2,'SUPERADMIN',NULL)",[randomUUID(),id]);
    await auditar(db,'bootstrap',id);await db.query('COMMIT');return {idUsuario:id,usuario:datos.usuario};
  } catch(e) {await db.query('ROLLBACK');throw e;} finally {db.release();}
}
async function autenticar(pool: Pool,req: Request) {
  const token=tokenSesion(req);if(!token || token.length!==43) return null;
  const r=await pool.query('SELECT u.id,u.usuario,s.csrf_hash,s.id_organizacion FROM sesiones s JOIN usuarios u ON u.id=s.id_usuario WHERE s.hash=$1 AND NOT s.revocada AND s.expira_en>now() AND u.activo',[hash(token)]);
  if(!r.rowCount)return null;
  const asignaciones=(await pool.query('SELECT rol,id_organizacion AS "idOrganizacion" FROM asignaciones_roles WHERE id_usuario=$1',[r.rows[0].id])).rows;
  return {...r.rows[0],asignaciones};
}
export const permisos: Record<string,string[]> = {
  'identidades:leer':['SUPERADMIN'],'identidades:escribir':['SUPERADMIN'],
  'elecciones:leer':['ADMIN_ELECTORAL','OPERADOR','ELECTOR','AUDITOR'], 'elecciones:crear':['ADMIN_ELECTORAL'], 'elecciones:modificar':['ADMIN_ELECTORAL'],
  'candidaturas:leer':['ADMIN_ELECTORAL','OPERADOR','ELECTOR','AUDITOR'], 'candidaturas:crear':['ADMIN_ELECTORAL','OPERADOR'], 'candidaturas:modificar':['ADMIN_ELECTORAL'],
  'padron:leer':['ADMIN_ELECTORAL','OPERADOR','AUDITOR'], 'padron:crear':['ADMIN_ELECTORAL','OPERADOR'], 'padron:modificar':['ADMIN_ELECTORAL'],
  'votos:leer':['ADMIN_ELECTORAL','AUDITOR'],'votos:crear':['ADMIN_ELECTORAL'],
  'resultados:leer':['ADMIN_ELECTORAL','OPERADOR','ELECTOR','AUDITOR'],
};
export function rutasSeguridad(app: Express,pool: Pool) {
  app.use(['/autenticacion','/usuarios','/organizaciones','/auditoria-seguridad','/interno'],(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
  app.get('/autenticacion/csrf',(_req,res)=>{
    const token=secreto();res.cookie(cookieCsrf,token,{secure:cookieSegura,httpOnly:false,sameSite:'strict',path:'/'});res.json({csrf:token});
  });
  app.post('/autenticacion/login',async(req,res)=>{
    if(!csrf(req))return error(res,403,'Origen o CSRF inválido');
    const entrada=z.object({usuario:esquemaUsuario,contrasena:z.string().max(200),idOrganizacion:uuid.optional()}).strict().safeParse(req.body);
    if(!entrada.success)return error(res,400,'Solicitud inválida');
    const claves=[hash('usuario:'+entrada.data.usuario),hash('ip:'+req.socket.remoteAddress)];
    for(const clave of claves){
      const r=await pool.query(`INSERT INTO intentos_autenticacion(clave,intentos) VALUES($1,1) ON CONFLICT(clave) DO UPDATE SET ventana=CASE WHEN intentos_autenticacion.ventana<now()-interval '15 minutes' THEN now() ELSE intentos_autenticacion.ventana END,intentos=CASE WHEN intentos_autenticacion.ventana<now()-interval '15 minutes' THEN 1 ELSE intentos_autenticacion.intentos+1 END RETURNING intentos`,[clave]);
      if(r.rows[0].intentos>(clave===claves[0]?8:100))return error(res,429,'Demasiados intentos; espere 15 minutos');
    }
    const usuario=(await pool.query('SELECT * FROM usuarios WHERE usuario=$1',[entrada.data.usuario])).rows[0];
    // Hash de trabajo del proceso: igual coste incluso si la cuenta no existe.
    const correcta=await bcrypt.compare(entrada.data.contrasena,usuario?.clave_hash ?? hashFicticio);
    if(!usuario || !correcta || !usuario.activo){await auditar(pool,'login_fallido');return error(res,401,'Credenciales inválidas');}
    const membresias=(await pool.query('SELECT DISTINCT id_organizacion FROM asignaciones_roles WHERE id_usuario=$1 AND id_organizacion IS NOT NULL',[usuario.id])).rows.map(r=>r.id_organizacion);
    const seleccion=entrada.data.idOrganizacion??(membresias.length===1?membresias[0]:null);
    if(seleccion&&!membresias.includes(seleccion))return error(res,403,'Organización no permitida');
    const token=secreto(),csrfToken=secreto();
    await pool.query("INSERT INTO sesiones(hash,id_usuario,csrf_hash,expira_en,id_organizacion) VALUES($1,$2,$3,now()+($4||' seconds')::interval,$5)",[hash(token),usuario.id,hash(csrfToken),String(duracion),seleccion]);
    res.cookie(cookieSesion,token,{secure:cookieSegura,httpOnly:true,sameSite:'strict',path:'/',maxAge:duracion*1000});
    res.cookie(cookieCsrf,csrfToken,{secure:cookieSegura,httpOnly:false,sameSite:'strict',path:'/'});
    await auditar(pool,'login',usuario.id);res.json({idUsuario:usuario.id,usuario:usuario.usuario,csrf:csrfToken,expiraEnSegundos:duracion});
  });
  app.get('/autenticacion/yo',async(req,res)=>{
    const actor=await autenticar(pool,req);if(!actor)return error(res,401,'Sesión requerida');
    res.json({idUsuario:actor.id,usuario:actor.usuario,roles:actor.asignaciones,idOrganizacion:actor.id_organizacion});
  });
  app.post('/interno/autorizar',async(req,res)=>{
    const servicio=req.header('X-Servicio') ?? '';
    const nombres=['identidad','elecciones','padron-electoral','candidaturas','votacion','resultados','gateway-graphql'];
    const clave=process.env['CLAVE_INTERNA_'+servicio.toUpperCase().replaceAll('-','_')] ?? '';
    if(!nombres.includes(servicio)||clave.length<32||!iguales(clave,req.header('X-Clave-Servicio')??''))return error(res,401,'Servicio no autenticado');
    const actor=await autenticar(pool,req);if(!actor)return error(res,401,'Sesión requerida');
    const datos=z.object({accion:z.string(),idOrganizacion:uuid,escritura:z.boolean()}).strict().safeParse({...req.body,idOrganizacion:req.body?.idOrganizacion||actor.id_organizacion});
    if(!datos.success)return error(res,403,'Organización y operación requeridas');
    if(datos.data.escritura&&(!csrf(req)||!iguales(hash(req.header('X-CSRF-Token')??''),actor.csrf_hash)))return error(res,403,'Origen o CSRF inválido');
    const organizacion=(await pool.query('SELECT 1 FROM organizaciones WHERE id=$1 AND activa',[datos.data.idOrganizacion])).rowCount;
    const esSuperActor=actor.asignaciones.some((r:{rol:string})=>r.rol==='SUPERADMIN');
    const asignados=esSuperActor?['SUPERADMIN']:actor.asignaciones.filter((r:{idOrganizacion:string})=>r.idOrganizacion===datos.data.idOrganizacion).map((r:{rol:string})=>r.rol);
    if(!organizacion||!asignados.some((r:string)=>permisos[datos.data.accion]?.includes(r)))return error(res,403,'Permiso denegado');
    res.json({idUsuario:actor.id,idOrganizacion:datos.data.idOrganizacion,lecturaLimitada:asignados.every((r:string)=>r==='ELECTOR')});
  });
  app.post('/autenticacion/recuperar',async(req,res)=>{
    if(!csrf(req))return error(res,403,'Origen o CSRF inválido');
    const datos=z.object({token:z.string().length(43),contrasena:esquemaClave}).strict().safeParse(req.body);if(!datos.success)return error(res,400,'Solicitud inválida');
    const db=await pool.connect();
    try{await db.query('BEGIN');const r=await db.query('SELECT * FROM recuperaciones WHERE hash=$1 AND NOT usada AND expira_en>now() FOR UPDATE',[hash(datos.data.token)]);
      if(!r.rowCount){await db.query('ROLLBACK');return error(res,401,'Recuperación inválida');}
      const id=r.rows[0].id_usuario;await db.query('UPDATE usuarios SET clave_hash=$2 WHERE id=$1',[id,await bcrypt.hash(datos.data.contrasena,12)]);
      await db.query('UPDATE recuperaciones SET usada=true WHERE id_usuario=$1',[id]);await db.query('UPDATE sesiones SET revocada=true WHERE id_usuario=$1',[id]);await auditar(db,'recuperacion_completada',id);await db.query('COMMIT');res.status(204).end();
    }catch{await db.query('ROLLBACK');error(res,503,'Recuperación no disponible');}finally{db.release();}
  });
  app.use(['/usuarios','/organizaciones','/auditoria-seguridad','/autenticacion/logout','/autenticacion/contrasena','/autenticacion/organizacion'],async(req,res,next)=>{
    const actor=await autenticar(pool,req);if(!actor)return error(res,401,'Sesión requerida');
    if(!['GET','HEAD'].includes(req.method)&&(!csrf(req)||hash(req.header('X-CSRF-Token')??'')!==actor.csrf_hash))return error(res,403,'Origen o CSRF inválido');
    res.locals.actor=actor;next();
  });
  const esSuper=(actor:any)=>actor.asignaciones.some((r:any)=>r.rol==='SUPERADMIN');
  const puedeAdministrar=(actor:any,org:string)=>esSuper(actor)||actor.asignaciones.some((r:any)=>r.rol==='ADMIN_ELECTORAL'&&r.idOrganizacion===org);
  app.post('/autenticacion/organizacion',async(req,res)=>{
    const datos=z.object({idOrganizacion:uuid}).strict().safeParse(req.body);if(!datos.success)return error(res,400,'Solicitud inválida');
    if(!(await pool.query('SELECT 1 FROM asignaciones_roles r JOIN organizaciones o ON o.id=r.id_organizacion WHERE r.id_usuario=$1 AND o.id=$2 AND o.activa',[res.locals.actor.id,datos.data.idOrganizacion])).rowCount)return error(res,403,'Organización no permitida');
    await pool.query('UPDATE sesiones SET id_organizacion=$2 WHERE hash=$1',[hash(tokenSesion(req)),datos.data.idOrganizacion]);res.status(204).end();
  });
  app.post('/autenticacion/logout',async(req,res)=>{
    await pool.query('UPDATE sesiones SET revocada=true WHERE hash=$1',[hash(tokenSesion(req))]);
    res.clearCookie(cookieSesion,{secure:cookieSegura,httpOnly:true,sameSite:'strict',path:'/'});
    if(!cookieSegura)res.clearCookie('__Host-sigape-sesion',{secure:true,httpOnly:true,sameSite:'strict',path:'/'});
    await auditar(pool,'logout',res.locals.actor.id);res.status(204).end();
  });
  app.post('/autenticacion/contrasena',async(req,res)=>{
    const datos=z.object({actual:z.string(),nueva:esquemaClave}).strict().safeParse(req.body);if(!datos.success)return error(res,400,'Solicitud inválida');
    const cuenta=(await pool.query('SELECT clave_hash FROM usuarios WHERE id=$1',[res.locals.actor.id])).rows[0];
    if(!await bcrypt.compare(datos.data.actual,cuenta.clave_hash))return error(res,403,'No autorizado');
    const db=await pool.connect();try{await db.query('BEGIN');await db.query('UPDATE usuarios SET clave_hash=$2 WHERE id=$1',[res.locals.actor.id,await bcrypt.hash(datos.data.nueva,12)]);await db.query('UPDATE sesiones SET revocada=true WHERE id_usuario=$1',[res.locals.actor.id]);await auditar(db,'contrasena_cambiada',res.locals.actor.id);await db.query('COMMIT');res.status(204).end();}catch{await db.query('ROLLBACK');error(res,503,'No disponible');}finally{db.release();}
  });
  app.post('/organizaciones',async(req,res)=>{
    if(!esSuper(res.locals.actor))return error(res,403,'Solo SUPERADMIN');
    const datos=z.object({nombre:z.string().trim().min(1).max(120)}).strict().safeParse(req.body);if(!datos.success)return error(res,400,'Solicitud inválida');
    const id=randomUUID();await pool.query('INSERT INTO organizaciones VALUES($1,$2,true)',[id,datos.data.nombre]);await auditar(pool,'organizacion_creada',res.locals.actor.id,id);res.status(201).json({idOrganizacion:id,nombre:datos.data.nombre});
  });
  app.get('/organizaciones',async(req,res)=>{
    const actor=res.locals.actor;const r=await pool.query('SELECT id AS "idOrganizacion",nombre,activa FROM organizaciones WHERE $1 OR id IN (SELECT id_organizacion FROM asignaciones_roles WHERE id_usuario=$2)',[esSuper(actor),actor.id]);res.json({elementos:r.rows});
  });
  app.put('/organizaciones/:id',async(req,res)=>{
    if(!esSuper(res.locals.actor))return error(res,403,'Solo SUPERADMIN');const datos=z.object({nombre:z.string().trim().min(1).max(120),activa:z.boolean()}).strict().safeParse(req.body);if(!uuid.safeParse(req.params.id).success||!datos.success)return error(res,400,'Solicitud inválida');
    const r=await pool.query('UPDATE organizaciones SET nombre=$2,activa=$3 WHERE id=$1 RETURNING id',[req.params.id,datos.data.nombre,datos.data.activa]);if(!r.rowCount)return error(res,404,'Organización ausente');await auditar(pool,'organizacion_actualizada',res.locals.actor.id,req.params.id);res.status(204).end();
  });
  app.get('/usuarios',async(req,res)=>{
    const org=req.header('X-Organizacion')??'';if(!esSuper(res.locals.actor)&&(!uuid.safeParse(org).success||!puedeAdministrar(res.locals.actor,org)))return error(res,403,'Permiso denegado');
    const filas=await pool.query('SELECT id AS "idUsuario",usuario,activo FROM usuarios WHERE $1 OR id IN (SELECT id_usuario FROM asignaciones_roles WHERE id_organizacion=$2::uuid) ORDER BY usuario LIMIT 100',[esSuper(res.locals.actor),uuid.safeParse(org).success?org:null]);res.json({elementos:filas.rows});
  });
  app.post('/usuarios',async(req,res)=>{
    const datos=z.object({usuario:esquemaUsuario,contrasena:esquemaClave,idOrganizacion:uuid,rol:z.enum(roles)}).strict().safeParse(req.body);if(!datos.success)return error(res,400,'Solicitud inválida');
    const d=datos.data,actor=res.locals.actor;
    if(!puedeAdministrar(actor,d.idOrganizacion)||d.rol==='SUPERADMIN'||(d.rol==='ADMIN_ELECTORAL'&&!esSuper(actor)))return error(res,403,'Asignación no permitida');
    const db=await pool.connect();try{await db.query('BEGIN');const org=await db.query('SELECT 1 FROM organizaciones WHERE id=$1 AND activa',[d.idOrganizacion]);if(!org.rowCount){await db.query('ROLLBACK');return error(res,403,'Organización no disponible');}
      const id=randomUUID();await db.query('INSERT INTO usuarios(id,usuario,clave_hash) VALUES($1,$2,$3)',[id,d.usuario,await bcrypt.hash(d.contrasena,12)]);await db.query('INSERT INTO asignaciones_roles VALUES($1,$2,$3,$4)',[randomUUID(),id,d.rol,d.idOrganizacion]);await auditar(db,'usuario_creado',actor.id,d.idOrganizacion,id);await db.query('COMMIT');res.status(201).json({idUsuario:id,usuario:d.usuario});
    }catch(e){await db.query('ROLLBACK');error(res,(e as any).code==='23505'?409:503,'No se pudo crear la cuenta');}finally{db.release();}
  });
  app.post('/usuarios/:id/roles',async(req,res)=>{
    const datos=z.object({rol:z.enum(roles),idOrganizacion:uuid,revocar:z.boolean().default(false)}).strict().safeParse(req.body);if(!datos.success||!uuid.safeParse(req.params.id).success)return error(res,400,'Solicitud inválida');
    const d=datos.data,actor=res.locals.actor;
    if(actor.id===req.params.id||!puedeAdministrar(actor,d.idOrganizacion)||d.rol==='SUPERADMIN'||(d.rol==='ADMIN_ELECTORAL'&&!esSuper(actor)))return error(res,403,'Asignación no permitida');
    const db=await pool.connect();try{await db.query('BEGIN');const org=await db.query('SELECT 1 FROM organizaciones WHERE id=$1 AND activa',[d.idOrganizacion]);const cuenta=await db.query('SELECT 1 FROM usuarios WHERE id=$1 AND activo FOR UPDATE',[req.params.id]);if(!org.rowCount||!cuenta.rowCount){await db.query('ROLLBACK');return error(res,404,'Cuenta u organización no disponible');}
      if(d.revocar)await db.query('DELETE FROM asignaciones_roles WHERE id_usuario=$1 AND rol=$2 AND id_organizacion=$3',[req.params.id,d.rol,d.idOrganizacion]);else await db.query('INSERT INTO asignaciones_roles VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[randomUUID(),req.params.id,d.rol,d.idOrganizacion]);
      await auditar(db,d.revocar?'rol_revocado':'rol_asignado',actor.id,d.idOrganizacion,req.params.id);await db.query('COMMIT');res.status(204).end();
    }catch{await db.query('ROLLBACK');error(res,503,'No disponible');}finally{db.release();}
  });
  app.post('/usuarios/:id/recuperacion',async(req,res)=>{
    if(!esSuper(res.locals.actor)||!uuid.safeParse(req.params.id).success)return error(res,403,'Solo SUPERADMIN');
    const datos=z.object({contrasenaAdministrador:z.string().max(200)}).strict().safeParse(req.body);if(!datos.success)return error(res,400,'Solicitud inválida');
    const administrador=(await pool.query('SELECT clave_hash FROM usuarios WHERE id=$1',[res.locals.actor.id])).rows[0];if(!await bcrypt.compare(datos.data.contrasenaAdministrador,administrador.clave_hash))return error(res,403,'Reautenticación requerida');
    if(!(await pool.query('SELECT 1 FROM usuarios WHERE id=$1 AND activo',[req.params.id])).rowCount)return error(res,404,'Cuenta ausente');
    const token=secreto();await pool.query("INSERT INTO recuperaciones VALUES($1,$2,now()+interval '10 minutes',false)",[hash(token),req.params.id]);await pool.query('UPDATE sesiones SET revocada=true WHERE id_usuario=$1',[req.params.id]);await auditar(pool,'recuperacion_emitida',res.locals.actor.id,null,req.params.id);res.status(201).json({tokenRecuperacion:token,expiraEnSegundos:600});
  });
  app.get('/auditoria-seguridad',async(req,res)=>{
    const org=req.header('X-Organizacion')??'';const actor=res.locals.actor;
    if(!esSuper(actor)&&(!uuid.safeParse(org).success||!actor.asignaciones.some((r:any)=>r.rol==='AUDITOR'&&r.idOrganizacion===org)))return error(res,403,'Permiso denegado');
    const r=await pool.query('SELECT id,id_actor AS "idActor",id_organizacion AS "idOrganizacion",accion,objetivo,creado_en AS "creadoEn" FROM auditoria_seguridad WHERE $1 OR id_organizacion=$2::uuid ORDER BY creado_en DESC LIMIT 100',[esSuper(actor),uuid.safeParse(org).success?org:null]);res.json({elementos:r.rows});
  });
}
// No contiene una contraseña utilizable: se genera una entrada aleatoria por proceso.
const hashFicticio=await bcrypt.hash(secreto(),12);
