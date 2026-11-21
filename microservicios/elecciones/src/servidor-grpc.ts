import * as grpc from '@grpc/grpc-js';
import * as loader from '@grpc/proto-loader';
import type { Pool, QueryConfig } from 'pg';
import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';

export type AutorizarMesa=(cabeceras:Record<string,string>,accion:string,plazo:number)=>Promise<{idUsuario:string;idOrganizacion:string;esAuditor?:boolean}>;
export function servicioMesas(db:Pool,autorizar:AutorizarMesa,clave:string,contrato:string) {
 const definicion=loader.loadSync(contrato,{keepCase:true,defaults:true});
 const paquete=grpc.loadPackageDefinition(definicion) as any;
 const servidor=new grpc.Server();
 servidor.addService(paquete.tuvoto.mesas.v1.ServicioMesas.service,{
  async ConsultarMesa(llamada:grpc.ServerUnaryCall<any,any>,responder:grpc.sendUnaryData<any>){
   const fallar=(code:grpc.status,details:string)=>responder({code,details});
   const recibida=String(llamada.metadata.get('x-clave-servicio')[0]??'');
   if(clave.length<32||Buffer.byteLength(recibida)!==Buffer.byteLength(clave)||!timingSafeEqual(Buffer.from(recibida),Buffer.from(clave)))return fallar(grpc.status.UNAUTHENTICATED,'Cliente interno no autorizado');
   const limite=Number(llamada.getDeadline());
   if(!Number.isFinite(limite))return fallar(grpc.status.INVALID_ARGUMENT,'Deadline obligatorio');
   if(Date.now()>=limite)return fallar(grpc.status.DEADLINE_EXCEEDED,'Plazo agotado');
   if(!z.string().uuid().safeParse(llamada.request.id_mesa).success)return fallar(grpc.status.INVALID_ARGUMENT,'Mesa inválida');
   try{
    const registro=llamada.request.id_registro;
    if(registro&&!z.string().uuid().safeParse(registro).success)return fallar(grpc.status.INVALID_ARGUMENT,'Registro inválido');
    if(llamada.request.finalizar_registro){
     if(!registro)return fallar(grpc.status.INVALID_ARGUMENT,'Registro obligatorio');
     await db.query('DELETE FROM registros_en_curso r USING tuvoto_mesas m WHERE r.id=$1 AND r.id_proceso=m.id_proceso AND m.id=$2',[registro,llamada.request.id_mesa]);responder(null,{});return;
    }
    const cabeceras=Object.fromEntries(['cookie','origin','x-csrf-token','x-organizacion','x-correlation-id'].map(k=>[k,String(llamada.metadata.get(k)[0]??'')]));
    const actor=await autorizar(cabeceras,llamada.request.para_registro?'actas:registrar':'actas:consultar',Math.max(1,limite-Date.now()));
    const fila=await db.query({text:'SELECT m.id,m.id_proceso,m.codigo,m.unidad,m.sector,p.nombre AS nombre_proceso,p.estado AS estado_proceso FROM tuvoto_mesas m JOIN tuvoto_procesos p ON p.id=m.id_proceso WHERE m.id=$1 AND p.id_organizacion=$2 AND (p.actual OR p.publicado) AND NOT p.eliminada AND NOT m.eliminada AND ($4 OR EXISTS(SELECT 1 FROM tuvoto_asignaciones a WHERE a.id_mesa=m.id AND a.id_usuario=$3))',values:[llamada.request.id_mesa,actor.idOrganizacion,actor.idUsuario,Boolean(actor.esAuditor&&!llamada.request.para_registro)],query_timeout:Math.max(1,limite-Date.now())} as QueryConfig & {query_timeout:number});
    if(llamada.cancelled)return fallar(grpc.status.CANCELLED,'Consulta cancelada');
    if(!fila.rowCount)return fallar(grpc.status.PERMISSION_DENIED,'Mesa fuera de asignación o elección actual');
    const candidatos=await db.query({text:'SELECT id,nombre FROM tuvoto_candidatos WHERE id_proceso=$1 AND NOT eliminada ORDER BY orden,id',values:[fila.rows[0].id_proceso],query_timeout:Math.max(1,limite-Date.now())} as QueryConfig & {query_timeout:number});
    if(Date.now()>=limite)return fallar(grpc.status.DEADLINE_EXCEEDED,'Plazo agotado');
    if(llamada.request.para_registro&&typeof db.connect==='function'){
     const c=await db.connect();try{await c.query('BEGIN');const p=(await c.query('SELECT estado FROM tuvoto_procesos WHERE id=$1 FOR UPDATE',[fila.rows[0].id_proceso])).rows[0];
      if(p&&p.estado!=='recepcion'){await c.query('ROLLBACK');return fallar(grpc.status.FAILED_PRECONDITION,'La elección no está en recepción');}
      if(registro)await c.query('INSERT INTO registros_en_curso(id,id_proceso,id_usuario) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[registro,fila.rows[0].id_proceso,actor.idUsuario]);await c.query('COMMIT');
     }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
    }
    responder(null,{...fila.rows[0],candidatos:candidatos.rows});
   }catch(e:any){
    const codigo=e.estado===401?grpc.status.UNAUTHENTICATED:e.estado===403?grpc.status.PERMISSION_DENIED:Date.now()>=limite?grpc.status.DEADLINE_EXCEEDED:grpc.status.UNAVAILABLE;
    fallar(codigo,'No se pudo consultar la mesa');
   }
  }
 });
 return servidor;
}
