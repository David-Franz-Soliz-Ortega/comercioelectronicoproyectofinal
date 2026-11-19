import type { Request } from 'express';

const servicio = 'elecciones';
export function cabeceras(req: Request): Record<string,string> {
  return {'Cookie':req.header('Cookie')??'', 'Origin':req.header('Origin')??'', 'X-CSRF-Token':req.header('X-CSRF-Token')??'', 'X-Organizacion':req.header('X-Organizacion')??'','X-Correlation-ID':req.header('X-Correlation-ID')??''};
}
export async function permiso(req: Request,accion: string,escritura: boolean,senal?:AbortSignal) {
  const r=await fetch((process.env.IDENTIDAD_URL??'http://identidad:3000')+'/api/v1/interno/autorizar',{
    method:'POST',headers:{...cabeceras(req),'Content-Type':'application/json','X-Servicio':servicio,'X-Clave-Servicio':process.env.CLAVE_SERVICIO??''},
    body:JSON.stringify({accion,idOrganizacion:req.header('X-Organizacion'),escritura}),signal:senal??AbortSignal.timeout(2500)});
  if(!r.ok)throw Object.assign(new Error('No autorizado'),{estado:[401,403].includes(r.status)?r.status:503});
  return r.json();
}
