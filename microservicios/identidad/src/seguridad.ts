import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { rutasImportacionOperadores } from './importacion-operadores.js';
import type { Express, Request, Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

export const roles = ['ADMINISTRADOR','OPERADOR','AUDITOR'] as const;
const uuid = z.string().uuid();
const cookieSegura = process.env.COOKIE_SEGURA === 'true' || (process.env.COOKIE_SEGURA !== 'false' && process.env.NODE_ENV === 'production');
const cookieSesion = cookieSegura ? '__Host-tuvoto-sesion' : 'tuvoto-sesion';
const cookieCsrf = cookieSegura ? '__Host-tuvoto-csrf' : 'tuvoto-csrf';
const duracion = Number(process.env.SESION_SEGUNDOS ?? 1800);
const origenes = (process.env.ORIGEN_PUBLICO ?? 'http://localhost:8080,http://127.0.0.1:8080')
  .split(',')
  .map(x => x.trim())
  .filter(Boolean);
const hash = (valor: string) => createHash('sha256').update(valor).digest('hex');
const secreto = () => randomBytes(32).toString('base64url');
const secretoJwt = process.env.TUVOTO_JWT_SECRETO || process.env.CLAVE_INTERNA_IDENTIDAD || 'tuvoto-secreto-jwt-produccion-2026-com600-microservicios';

export function firmarJwt(payload: Record<string, any>, expiraSegundos = duracion): string {
  const cabecera = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expiraSegundos;
  const cuerpo = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const firma = createHmac('sha256', secretoJwt).update(`${cabecera}.${cuerpo}`).digest('base64url');
  return `${cabecera}.${cuerpo}.${firma}`;
}

export function verificarJwt(token: string): any | null {
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [cabeceraB64, cuerpoB64, firmaB64] = partes;
  const firmaEsperada = createHmac('sha256', secretoJwt).update(`${cabeceraB64}.${cuerpoB64}`).digest('base64url');
  if (!iguales(firmaB64, firmaEsperada)) return null;
  try {
    const payload = JSON.parse(Buffer.from(cuerpoB64, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function tokenBearer(req: Request): string {
  const auth = req.header('Authorization') ?? req.header('authorization') ?? '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return '';
}
export function cookies(req: Request): Record<string,string> {
  return Object.fromEntries((req.headers.cookie ?? '').split(';').map(x => x.trim().split('=')).filter(x => x.length === 2));
}
function tokenSesion(req: Request): string {
  const c = cookies(req);
  return c[cookieSesion] ?? '';
}
function tokenCsrf(req: Request): string {
  const c = cookies(req);
  return c[cookieCsrf] ?? c['__Host-tuvoto-csrf'] ?? c['tuvoto-csrf'] ?? '';
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
  const db=await pool.connect();
  try {
  await db.query('BEGIN');
  await db.query('SELECT pg_advisory_xact_lock(600002)');
  await db.query(`
    CREATE TABLE IF NOT EXISTS organizaciones(id UUID PRIMARY KEY,nombre VARCHAR(120) NOT NULL,activa BOOLEAN NOT NULL DEFAULT true);
    CREATE TABLE IF NOT EXISTS usuarios(id UUID PRIMARY KEY,usuario VARCHAR(80) UNIQUE NOT NULL,clave_hash TEXT NOT NULL,activo BOOLEAN NOT NULL DEFAULT true,creado_en TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS asignaciones_roles(id UUID PRIMARY KEY,id_usuario UUID NOT NULL REFERENCES usuarios(id),rol VARCHAR(32) NOT NULL CHECK(rol IN ('SUPERADMIN','ADMIN_ELECTORAL','OPERADOR','ELECTOR','AUDITOR')),id_organizacion UUID REFERENCES organizaciones(id),CHECK((rol='SUPERADMIN')=(id_organizacion IS NULL)));
    CREATE UNIQUE INDEX IF NOT EXISTS rol_unico ON asignaciones_roles(id_usuario,rol,COALESCE(id_organizacion,'00000000-0000-0000-0000-000000000000'));
    CREATE TABLE IF NOT EXISTS sesiones(hash TEXT PRIMARY KEY,id_usuario UUID NOT NULL REFERENCES usuarios(id),csrf_hash TEXT NOT NULL,expira_en TIMESTAMPTZ NOT NULL,revocada BOOLEAN NOT NULL DEFAULT false,creada_en TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS intentos_autenticacion(clave TEXT PRIMARY KEY,ventana TIMESTAMPTZ NOT NULL DEFAULT now(),intentos INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS recuperaciones(hash TEXT PRIMARY KEY,id_usuario UUID NOT NULL REFERENCES usuarios(id),expira_en TIMESTAMPTZ NOT NULL,usada BOOLEAN NOT NULL DEFAULT false);
    CREATE TABLE IF NOT EXISTS auditoria_seguridad(id UUID PRIMARY KEY,id_actor UUID,id_organizacion UUID,accion TEXT NOT NULL,objetivo TEXT,creado_en TIMESTAMPTZ NOT NULL DEFAULT now());
    ALTER TABLE sesiones ADD COLUMN IF NOT EXISTS id_organizacion UUID REFERENCES organizaciones(id);
    ALTER TABLE asignaciones_roles DROP CONSTRAINT IF EXISTS asignaciones_roles_rol_check;
    ALTER TABLE asignaciones_roles DROP CONSTRAINT IF EXISTS asignaciones_roles_check;
    WITH fusionadas AS (
      UPDATE asignaciones_roles SET rol='ADMINISTRADOR' WHERE rol IN ('SUPERADMIN','ADMIN_ELECTORAL') RETURNING id_usuario
    ) UPDATE sesiones SET revocada=true WHERE id_usuario IN (SELECT id_usuario FROM fusionadas);
    ALTER TABLE asignaciones_roles ADD CONSTRAINT asignaciones_roles_rol_check CHECK(rol IN ('ADMINISTRADOR','OPERADOR','AUDITOR','ELECTOR'));
    ALTER TABLE asignaciones_roles ADD CONSTRAINT asignaciones_roles_check CHECK(id_organizacion IS NOT NULL OR rol='ADMINISTRADOR');
    CREATE INDEX IF NOT EXISTS sesiones_usuario ON sesiones(id_usuario);
    CREATE INDEX IF NOT EXISTS auditoria_organizacion ON auditoria_seguridad(id_organizacion,creado_en);
  `);
  await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
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
    if ((await db.query("SELECT 1 FROM asignaciones_roles WHERE rol='ADMINISTRADOR' AND id_organizacion IS NULL")).rowCount) throw new Error('Bootstrap ya realizado');
    const id=randomUUID();await db.query('INSERT INTO usuarios(id,usuario,clave_hash) VALUES($1,$2,$3)',[id,datos.usuario,await bcrypt.hash(datos.contrasena,12)]);
    await db.query("INSERT INTO asignaciones_roles VALUES($1,$2,'ADMINISTRADOR',NULL)",[randomUUID(),id]);
    await auditar(db,'bootstrap',id);await db.query('COMMIT');return {idUsuario:id,usuario:datos.usuario};
  } catch(e) {await db.query('ROLLBACK');throw e;} finally {db.release();}
}
async function autenticar(pool: Pool|PoolClient,req: Request) {
  const bearer = tokenBearer(req);
  if (bearer) {
    const payload = verificarJwt(bearer);
    if (!payload || !payload.sub) return null;
    const r = await pool.query('SELECT u.id,u.usuario FROM usuarios u WHERE u.id=$1 AND u.activo', [payload.sub]);
    if (!r.rowCount) return null;
    const asignaciones = (await pool.query('SELECT rol,id_organizacion AS "idOrganizacion" FROM asignaciones_roles WHERE id_usuario=$1', [payload.sub])).rows;
    return { id: r.rows[0].id, usuario: r.rows[0].usuario, csrf_hash: '', id_organizacion: payload.idOrganizacion ?? null, asignaciones, esJwt: true };
  }
  const token=tokenSesion(req);if(!token || token.length!==43) return null;
  const r=await pool.query('SELECT u.id,u.usuario,s.csrf_hash,s.id_organizacion FROM sesiones s JOIN usuarios u ON u.id=s.id_usuario WHERE s.hash=$1 AND NOT s.revocada AND s.expira_en>now() AND u.activo',[hash(token)]);
  if(!r.rowCount)return null;
  // Renovación deslizante: solo una sesión usada sigue viva; el navegador recibe la cookie nueva en /autenticacion/yo.
  try { await pool.query("UPDATE sesiones SET expira_en=now()+($2||' seconds')::interval WHERE hash=$1",[hash(token),String(duracion)]); } catch {}
  const asignaciones=(await pool.query('SELECT rol,id_organizacion AS "idOrganizacion" FROM asignaciones_roles WHERE id_usuario=$1',[r.rows[0].id])).rows;
  return {...r.rows[0],asignaciones,esJwt:false};
}
export const permisos: Record<string,string[]> = {
  'proceso:configurar':['ADMINISTRADOR'],
  'actas:registrar':['OPERADOR'],
  'actas:consultar':['OPERADOR','AUDITOR'],
  'informes:administrar':['ADMINISTRADOR'],
  'informes:consultar':['ADMINISTRADOR','AUDITOR'],
};
export function rutasSeguridad(app: Express,pool: Pool) {
  app.use(['/autenticacion','/usuarios','/organizaciones','/auditoria-seguridad','/importaciones','/interno'],(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
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
    const tokenJwt=firmarJwt({sub:usuario.id,usuario:usuario.usuario,idOrganizacion:seleccion,roles:membresias});
    await auditar(pool,'login',usuario.id);res.json({idUsuario:usuario.id,usuario:usuario.usuario,csrf:csrfToken,token:tokenJwt,tipoToken:'Bearer',expiraEnSegundos:duracion});
  });
  app.post('/autenticacion/token',async(req,res)=>{
    const entrada=z.object({usuario:esquemaUsuario,contrasena:z.string().max(200),idOrganizacion:uuid.optional()}).strict().safeParse(req.body);
    if(!entrada.success)return error(res,400,'Solicitud inválida');
    const usuario=(await pool.query('SELECT * FROM usuarios WHERE usuario=$1',[entrada.data.usuario])).rows[0];
    const correcta=await bcrypt.compare(entrada.data.contrasena,usuario?.clave_hash ?? hashFicticio);
    if(!usuario || !correcta || !usuario.activo){await auditar(pool,'token_fallido');return error(res,401,'Credenciales inválidas');}
    const asignaciones=(await pool.query('SELECT rol,id_organizacion AS "idOrganizacion" FROM asignaciones_roles WHERE id_usuario=$1',[usuario.id])).rows;
    const membresias=[...new Set(asignaciones.map(r=>r.rol))];
    const seleccion=entrada.data.idOrganizacion??(asignaciones.find(a=>a.idOrganizacion)?.idOrganizacion ?? null);
    const tokenJwt=firmarJwt({sub:usuario.id,usuario:usuario.usuario,idOrganizacion:seleccion,roles:membresias});
    await auditar(pool,'token_emitido',usuario.id);
    res.json({token:tokenJwt,tipoToken:'Bearer',expiraEnSegundos:duracion,idUsuario:usuario.id,usuario:usuario.usuario,roles:asignaciones,idOrganizacion:seleccion});
  });
  app.get('/autenticacion/yo',async(req,res)=>{
    const actor=await autenticar(pool,req);if(!actor)return error(res,401,'Sesión requerida');
    res.cookie(cookieSesion,tokenSesion(req),{secure:cookieSegura,httpOnly:true,sameSite:'strict',path:'/',maxAge:duracion*1000});
    res.json({idUsuario:actor.id,usuario:actor.usuario,roles:actor.asignaciones,idOrganizacion:actor.id_organizacion});
  });
  app.post('/interno/autorizar',async(req,res)=>{
    const servicio=req.header('X-Servicio') ?? '';
    const nombres=['identidad','elecciones','actas','resultados'];
    const clave=process.env['CLAVE_INTERNA_'+servicio.toUpperCase().replaceAll('-','_')] ?? '';
    if(!nombres.includes(servicio)||clave.length<32||!iguales(clave,req.header('X-Clave-Servicio')??''))return error(res,401,'Servicio no autenticado');
    const actor=await autenticar(pool,req);if(!actor)return error(res,401,'Sesión requerida');
    const datos=z.object({accion:z.string(),idOrganizacion:uuid,escritura:z.boolean()}).strict().safeParse({...req.body,idOrganizacion:req.body?.idOrganizacion||actor.id_organizacion});
    if(!datos.success)return error(res,403,'Organización y operación requeridas');
    if(datos.data.escritura&&!actor.esJwt&&(!csrf(req)||!iguales(hash(req.header('X-CSRF-Token')??''),actor.csrf_hash)))return error(res,403,'Origen o CSRF inválido');
    const organizacion=(await pool.query('SELECT 1 FROM organizaciones WHERE id=$1 AND activa',[datos.data.idOrganizacion])).rowCount;
    const esAdministradorGlobalActor=actor.asignaciones.some((r:{rol:string;idOrganizacion:string|null})=>r.rol==='ADMINISTRADOR'&&r.idOrganizacion===null);
    const asignados=esAdministradorGlobalActor?['ADMINISTRADOR']:actor.asignaciones.filter((r:{idOrganizacion:string})=>r.idOrganizacion===datos.data.idOrganizacion).map((r:{rol:string})=>r.rol);
    if(datos.data.accion==='actas:registrar'&&(esAdministradorGlobalActor||asignados.includes('ADMINISTRADOR')))return error(res,403,'Administrador no registra actas');
    if(!organizacion||!asignados.some((r:string)=>permisos[datos.data.accion]?.includes(r)))return error(res,403,'Permiso denegado');
    res.json({idUsuario:actor.id,idOrganizacion:datos.data.idOrganizacion,lecturaLimitada:false,administradorGlobal:esAdministradorGlobalActor,esAuditor:asignados.includes('AUDITOR')});
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
  app.use(['/importaciones','/usuarios','/organizaciones','/auditoria-seguridad','/autenticacion/logout','/autenticacion/contrasena','/autenticacion/organizacion'],async(req,res,next)=>{
    const actor=await autenticar(pool,req);if(!actor)return error(res,401,'Sesión requerida');
    if(!['GET','HEAD'].includes(req.method)&&!actor.esJwt&&(!csrf(req)||hash(req.header('X-CSRF-Token')??'')!==actor.csrf_hash))return error(res,403,'Origen o CSRF inválido');
    res.locals.actor=actor;next();
  });
  const esAdministradorGlobal=(actor:any)=>actor.asignaciones.some((r:any)=>r.rol==='ADMINISTRADOR');
  const puedeAdministrar=(actor:any,org:string)=>esAdministradorGlobal(actor)||actor.asignaciones.some((r:any)=>r.rol==='ADMINISTRADOR'&&(r.idOrganizacion===org||r.idOrganizacion===null));
  rutasImportacionOperadores(app,pool,puedeAdministrar,(req,db)=>autenticar(db,req));
  app.post('/autenticacion/organizacion',async(req,res)=>{
    const datos=z.object({idOrganizacion:uuid}).strict().safeParse(req.body);if(!datos.success)return error(res,400,'Solicitud inválida');
    if(!(await pool.query('SELECT 1 FROM asignaciones_roles r JOIN organizaciones o ON o.id=r.id_organizacion WHERE r.id_usuario=$1 AND o.id=$2 AND o.activa',[res.locals.actor.id,datos.data.idOrganizacion])).rowCount)return error(res,403,'Organización no permitida');
    await pool.query('UPDATE sesiones SET id_organizacion=$2 WHERE hash=$1',[hash(tokenSesion(req)),datos.data.idOrganizacion]);res.status(204).end();
  });
  app.post('/autenticacion/logout',async(req,res)=>{
    await pool.query('UPDATE sesiones SET revocada=true WHERE hash=$1',[hash(tokenSesion(req))]);
    res.clearCookie(cookieSesion,{secure:cookieSegura,httpOnly:true,sameSite:'strict',path:'/'});
    if(!cookieSegura)res.clearCookie('__Host-tuvoto-sesion',{secure:true,httpOnly:true,sameSite:'strict',path:'/'});
    await auditar(pool,'logout',res.locals.actor.id);res.status(204).end();
  });
  app.post('/autenticacion/contrasena',async(req,res)=>{
    const datos=z.object({actual:z.string(),nueva:esquemaClave}).strict().safeParse(req.body);if(!datos.success)return error(res,400,'Solicitud inválida');
    const cuenta=(await pool.query('SELECT clave_hash FROM usuarios WHERE id=$1',[res.locals.actor.id])).rows[0];
    if(!await bcrypt.compare(datos.data.actual,cuenta.clave_hash))return error(res,403,'No autorizado');
    const db=await pool.connect();try{await db.query('BEGIN');await db.query('UPDATE usuarios SET clave_hash=$2 WHERE id=$1',[res.locals.actor.id,await bcrypt.hash(datos.data.nueva,12)]);await db.query('UPDATE sesiones SET revocada=true WHERE id_usuario=$1',[res.locals.actor.id]);await auditar(db,'contrasena_cambiada',res.locals.actor.id);await db.query('COMMIT');res.status(204).end();}catch{await db.query('ROLLBACK');error(res,503,'No disponible');}finally{db.release();}
  });
  app.post('/organizaciones',async(req,res)=>{
    if(!esAdministradorGlobal(res.locals.actor))return error(res,403,'Solo administrador con alcance global');
    const datos=z.object({nombre:z.string().trim().min(1).max(120)}).strict().safeParse(req.body);if(!datos.success)return error(res,400,'Solicitud inválida');
    const id=randomUUID();await pool.query('INSERT INTO organizaciones VALUES($1,$2,true)',[id,datos.data.nombre]);await auditar(pool,'organizacion_creada',res.locals.actor.id,id);res.status(201).json({idOrganizacion:id,nombre:datos.data.nombre});
  });
  app.get('/organizaciones',async(req,res)=>{
    const actor=res.locals.actor;const r=await pool.query('SELECT id AS "idOrganizacion",nombre,activa FROM organizaciones WHERE $1 OR id IN (SELECT id_organizacion FROM asignaciones_roles WHERE id_usuario=$2)',[esAdministradorGlobal(actor),actor.id]);res.json({elementos:r.rows});
  });
  app.put('/organizaciones/:id',async(req,res)=>{
    if(!esAdministradorGlobal(res.locals.actor))return error(res,403,'Solo administrador con alcance global');const datos=z.object({nombre:z.string().trim().min(1).max(120),activa:z.boolean()}).strict().safeParse(req.body);if(!uuid.safeParse(req.params.id).success||!datos.success)return error(res,400,'Solicitud inválida');
    const r=await pool.query('UPDATE organizaciones SET nombre=$2,activa=$3 WHERE id=$1 RETURNING id',[req.params.id,datos.data.nombre,datos.data.activa]);if(!r.rowCount)return error(res,404,'Organización ausente');await auditar(pool,'organizacion_actualizada',res.locals.actor.id,req.params.id);res.status(204).end();
  });
  app.get('/usuarios',async(req,res)=>{
    const org=req.header('X-Organizacion')??'';if(!esAdministradorGlobal(res.locals.actor)&&(!uuid.safeParse(org).success||!puedeAdministrar(res.locals.actor,org)))return error(res,403,'Permiso denegado');
    const pagina=z.coerce.number().int().min(1).default(1).parse(req.query.pagina),limite=z.coerce.number().int().min(1).max(100).default(100).parse(req.query.limite);
    const usuario=req.query.usuario===undefined?null:esquemaUsuario.parse(req.query.usuario),idUsuario=req.query.idUsuario===undefined?null:uuid.parse(req.query.idUsuario);
    const esAdmin=esAdministradorGlobal(res.locals.actor);
    const valores=[esAdmin,uuid.safeParse(org).success?org:null,usuario,idUsuario];
    const donde=`($1 OR u.id IN (SELECT id_usuario FROM asignaciones_roles WHERE id_organizacion=$2::uuid OR rol='ADMINISTRADOR')) AND ($3::text IS NULL OR u.usuario=$3) AND ($4::uuid IS NULL OR u.id=$4)`;
    const filas=await pool.query(`SELECT u.id AS "idUsuario",u.usuario,u.activo,COALESCE((SELECT jsonb_agg(jsonb_build_object('rol',r.rol,'idOrganizacion',r.id_organizacion)) FROM asignaciones_roles r WHERE r.id_usuario=u.id AND ($1 OR r.rol='ADMINISTRADOR' OR r.id_organizacion=$2::uuid)),'[]'::jsonb) AS roles FROM usuarios u WHERE ${donde} ORDER BY u.usuario LIMIT $5 OFFSET $6`,[...valores,limite,(pagina-1)*limite]);
    const total=(await pool.query(`SELECT count(*)::int AS n FROM usuarios u WHERE ${donde}`,valores)).rows[0].n;res.json({elementos:filas.rows,pagina,limite,total});
  });
  app.post('/usuarios',async(req,res)=>{
    const datos=z.object({usuario:esquemaUsuario,contrasena:esquemaClave,idOrganizacion:uuid.nullable().optional(),rol:z.enum(['ADMINISTRADOR','OPERADOR','AUDITOR'])}).strict().safeParse(req.body);if(!datos.success)return error(res,400,'Solicitud inválida');
    const d=datos.data,actor=res.locals.actor;
    if(!esAdministradorGlobal(actor)&&(!d.idOrganizacion||!puedeAdministrar(actor,d.idOrganizacion)))return error(res,403,'Asignación no permitida');
    const db=await pool.connect();try{await db.query('BEGIN');
      const targetOrg=d.rol==='ADMINISTRADOR'?null:(d.idOrganizacion??null);
      if(targetOrg){const org=await db.query('SELECT 1 FROM organizaciones WHERE id=$1 AND activa',[targetOrg]);if(!org.rowCount){await db.query('ROLLBACK');return error(res,403,'Organización no disponible');}}
      const id=randomUUID();await db.query('INSERT INTO usuarios(id,usuario,clave_hash) VALUES($1,$2,$3)',[id,d.usuario,await bcrypt.hash(d.contrasena,12)]);
      await db.query('INSERT INTO asignaciones_roles VALUES($1,$2,$3,$4)',[randomUUID(),id,d.rol,targetOrg]);
      await auditar(db,'usuario_creado',actor.id,targetOrg,id);
      await db.query('COMMIT');res.status(201).json({idUsuario:id,usuario:d.usuario});
    }catch(e){await db.query('ROLLBACK');error(res,(e as any).code==='23505'?409:503,'No se pudo crear la cuenta');}finally{db.release();}
  });
  async function cuentaAdministrable(actor:any,id:string,org:string,c:Pool|PoolClient=pool){
    if(!uuid.safeParse(id).success||id===actor.id)throw Object.assign(new Error(),{estado:403});
    const cuenta=await c.query('SELECT id FROM usuarios WHERE id=$1 FOR UPDATE',[id]);if(!cuenta.rowCount)throw Object.assign(new Error(),{estado:404});
    const asignaciones=(await c.query('SELECT rol,id_organizacion AS "idOrganizacion" FROM asignaciones_roles WHERE id_usuario=$1',[id])).rows;
    if(asignaciones.some(r=>r.rol==='ADMINISTRADOR'&&r.idOrganizacion===null)||!esAdministradorGlobal(actor)&&(!uuid.safeParse(org).success||!puedeAdministrar(actor,org)||!asignaciones.length||asignaciones.some(r=>r.idOrganizacion!==org||r.rol==='ADMINISTRADOR')))throw Object.assign(new Error(),{estado:403});
  }
  app.get('/usuarios/:id',async(req,res)=>{try{await cuentaAdministrable(res.locals.actor,req.params.id,req.header('X-Organizacion')??'');const r=await pool.query('SELECT id AS "idUsuario",usuario,activo FROM usuarios WHERE id=$1 AND activo',[req.params.id]);if(!r.rowCount)return error(res,404,'Cuenta no disponible');res.json(r.rows[0]);}catch(e){error(res,(e as any).estado??503,'Cuenta no disponible');}});
  app.put('/usuarios/:id',async(req,res)=>{const d=z.object({usuario:esquemaUsuario}).strict().safeParse(req.body);if(!d.success)return error(res,422,'Usuario inválido');const db=await pool.connect();try{await db.query('BEGIN');await cuentaAdministrable(res.locals.actor,req.params.id,req.header('X-Organizacion')??'',db);const r=await db.query('UPDATE usuarios SET usuario=$2 WHERE id=$1 AND activo RETURNING id AS "idUsuario",usuario,activo',[req.params.id,d.data.usuario]);if(!r.rowCount){await db.query('ROLLBACK');return error(res,404,'Cuenta no disponible');}await auditar(db,'usuario_actualizado',res.locals.actor.id,null,req.params.id);await db.query('COMMIT');res.json(r.rows[0]);}catch(e){await db.query('ROLLBACK');error(res,(e as any).code==='23505'?409:(e as any).estado??503,'No se pudo actualizar la cuenta');}finally{db.release();}});
  app.delete('/usuarios/:id',async(req,res)=>{const db=await pool.connect();try{await db.query('BEGIN');await cuentaAdministrable(res.locals.actor,req.params.id,req.header('X-Organizacion')??'',db);await db.query('UPDATE usuarios SET activo=false WHERE id=$1',[req.params.id]);await db.query('UPDATE sesiones SET revocada=true WHERE id_usuario=$1',[req.params.id]);await auditar(db,'usuario_desactivado',res.locals.actor.id,null,req.params.id);await db.query('COMMIT');res.status(204).end();}catch(e){await db.query('ROLLBACK');error(res,(e as any).estado??503,'No se pudo desactivar la cuenta');}finally{db.release();}});
  app.post('/usuarios/:id/roles',async(req,res)=>{
    const datos=z.object({rol:z.enum(roles),idOrganizacion:uuid.nullable().optional(),revocar:z.boolean().default(false)}).strict().safeParse(req.body);if(!datos.success||!uuid.safeParse(req.params.id).success)return error(res,400,'Solicitud inválida');
    const d=datos.data,actor=res.locals.actor;
    if(!d.revocar&&!['ADMINISTRADOR','OPERADOR','AUDITOR'].includes(d.rol))return error(res,422,'Rol fuera del alcance TUVOTO');
    if(actor.id===req.params.id||(!esAdministradorGlobal(actor)&&(!d.idOrganizacion||!puedeAdministrar(actor,d.idOrganizacion))))return error(res,403,'Asignación no permitida');
    const db=await pool.connect();try{await db.query('BEGIN');
      const cuenta=await db.query('SELECT 1 FROM usuarios WHERE id=$1 AND activo FOR UPDATE',[req.params.id]);if(!cuenta.rowCount){await db.query('ROLLBACK');return error(res,404,'Cuenta no disponible');}
      if(d.idOrganizacion){const org=await db.query('SELECT 1 FROM organizaciones WHERE id=$1 AND activa',[d.idOrganizacion]);if(!org.rowCount){await db.query('ROLLBACK');return error(res,404,'Organización no disponible');}}
      if(d.revocar){
        if(d.idOrganizacion) await db.query('DELETE FROM asignaciones_roles WHERE id_usuario=$1 AND rol=$2 AND id_organizacion=$3',[req.params.id,d.rol,d.idOrganizacion]);
        else await db.query('DELETE FROM asignaciones_roles WHERE id_usuario=$1 AND rol=$2',[req.params.id,d.rol]);
      } else {
        await db.query('INSERT INTO asignaciones_roles VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[randomUUID(),req.params.id,d.rol,d.idOrganizacion??null]);
      }
      await auditar(db,d.revocar?'rol_revocado':'rol_asignado',actor.id,d.idOrganizacion??null,req.params.id);await db.query('COMMIT');res.status(204).end();
    }catch{await db.query('ROLLBACK');error(res,503,'No disponible');}finally{db.release();}
  });
  app.post('/usuarios/:id/recuperacion',async(req,res)=>{
    if(!esAdministradorGlobal(res.locals.actor)||!uuid.safeParse(req.params.id).success)return error(res,403,'Solo administrador con alcance global');
    const datos=z.object({contrasenaAdministrador:z.string().max(200)}).strict().safeParse(req.body);if(!datos.success)return error(res,400,'Solicitud inválida');
    const administrador=(await pool.query('SELECT clave_hash FROM usuarios WHERE id=$1',[res.locals.actor.id])).rows[0];if(!await bcrypt.compare(datos.data.contrasenaAdministrador,administrador.clave_hash))return error(res,403,'Reautenticación requerida');
    if(!(await pool.query('SELECT 1 FROM usuarios WHERE id=$1 AND activo',[req.params.id])).rowCount)return error(res,404,'Cuenta ausente');
    const token=secreto();await pool.query("INSERT INTO recuperaciones VALUES($1,$2,now()+interval '10 minutes',false)",[hash(token),req.params.id]);await pool.query('UPDATE sesiones SET revocada=true WHERE id_usuario=$1',[req.params.id]);await auditar(pool,'recuperacion_emitida',res.locals.actor.id,null,req.params.id);res.status(201).json({tokenRecuperacion:token,expiraEnSegundos:600});
  });
  app.get('/auditoria-seguridad',async(req,res)=>{
    const org=req.header('X-Organizacion')??'';const actor=res.locals.actor;
    if(!esAdministradorGlobal(actor)&&(!uuid.safeParse(org).success||!actor.asignaciones.some((r:any)=>r.rol==='AUDITOR'&&r.idOrganizacion===org)))return error(res,403,'Permiso denegado');
    const r=await pool.query('SELECT id,id_actor AS "idActor",id_organizacion AS "idOrganizacion",accion,objetivo,creado_en AS "creadoEn" FROM auditoria_seguridad WHERE $1 OR id_organizacion=$2::uuid ORDER BY creado_en DESC LIMIT 100',[esAdministradorGlobal(actor),uuid.safeParse(org).success?org:null]);res.json({elementos:r.rows});
  });
}
// No contiene una contraseña utilizable: se genera una entrada aleatoria por proceso.
const hashFicticio=await bcrypt.hash(secreto(),12);
