import type { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';

const servicio = 'elecciones';
export function cabeceras(req: Request): Record<string,string> {
  return {'Cookie':req.header('Cookie')??'', 'Origin':req.header('Origin')??'', 'X-CSRF-Token':req.header('X-CSRF-Token')??'', 'X-Organizacion':req.header('X-Organizacion')??''};
}
export async function permiso(req: Request,accion: string,escritura: boolean) {
  const r=await fetch((process.env.IDENTIDAD_URL??'http://identidad:3000')+'/api/v1/interno/autorizar',{
    method:'POST',headers:{...cabeceras(req),'Content-Type':'application/json','X-Servicio':servicio,'X-Clave-Servicio':process.env.CLAVE_SERVICIO??''},
    body:JSON.stringify({accion,idOrganizacion:req.header('X-Organizacion'),escritura}),signal:AbortSignal.timeout(2500)});
  if(!r.ok)throw Object.assign(new Error('No autorizado'),{estado:[401,403].includes(r.status)?r.status:503});
  return r.json();
}
export function proteger(pool: Pool, tabla: string, columna: string, recurso: string, dominio: string) {
  return async (req: Request,res: Response,next: NextFunction) => {
    if(!req.path.startsWith('/'+recurso))return next();
    try{
      const lectura=['GET','HEAD'].includes(req.method);
      const accion=dominio+':'+(lectura?'leer':dominio==='identidades'?'escribir':req.method==='POST'?'crear':'modificar');
      const contexto=await permiso(req,accion,!lectura);res.locals.organizacion=contexto.idOrganizacion;res.locals.contexto=contexto;
      const id=req.path.split('/')[2];
      if(id&&/^[0-9a-f-]{36}$/i.test(id)){
        const r=await pool.query(`SELECT id_organizacion${tabla==='elecciones'?',estado':''} FROM ${tabla} WHERE ${columna}=$1`,[id]);
        if(r.rowCount && (r.rows[0].id_organizacion!==contexto.idOrganizacion || (contexto.lecturaLimitada && !['programada','en_curso','finalizada'].includes(r.rows[0].estado))))return res.status(403).json({status:403,detail:'Recurso fuera del alcance permitido'});
      }
      const referencia=req.body?.idEleccion??req.query.idEleccion;
      if(dominio==='padron'&&referencia){
        const r=await fetch((process.env.ELECCIONES_URL??'http://elecciones:3000')+'/api/v1/elecciones/'+encodeURIComponent(String(referencia)),{headers:cabeceras(req),signal:AbortSignal.timeout(2500)});
        if(!r.ok)return res.status([403,404].includes(r.status)?r.status:503).json({status:r.status,detail:'Elección no disponible'});
      }
      next();
    }catch(e){const estado=(e as {estado?:number}).estado??503;res.status(estado).type('application/problem+json').json({type:'about:blank',title:'Acceso no disponible',status:estado,detail:estado===401?'Sesión requerida':estado===403?'Permiso denegado':'Identidad no disponible'});}
  };
}
