import type { Express } from 'express';
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prepararNuevoConteo } from './reiniciar.js';

// Un solo bloqueo y una sola transacción: nunca iniciar o terminar una parte de la institución.
export async function cambiarConteoInstitucion(db:Pool,organizacion:string,actor:string,accion:'iniciar'|'terminar'|'preparar') {
 const c=await db.connect();
 try {
  await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(607001)');
  const propios=(await c.query("SELECT id,cargo,estado,configuracion FROM tuvoto_procesos WHERE id_organizacion=$1 AND NOT eliminada AND NOT archivado AND estado<>'archivada' ORDER BY id FOR UPDATE",[organizacion])).rows;
  if(accion==='preparar'){
   if(propios.some(p=>p.estado==='recepcion'))throw Object.assign(new Error(),{estado:409,detalle:'Termina el conteo en curso antes de preparar uno nuevo.'});
   const nuevos=[];
   for(const p of propios.filter(p=>p.estado==='cerrada'))nuevos.push(await prepararNuevoConteo(c,p.id,organizacion,actor));
   await c.query('COMMIT');return {accion,actualizados:nuevos.length,idProcesos:nuevos};
  }
  if(accion==='iniciar'&&propios.some(p=>p.estado==='cerrada'))throw Object.assign(new Error(),{estado:409,detalle:'Prepara un nuevo conteo para conservar el anterior y empezar toda la institución desde cero.'});
  const objetivos=propios.filter(p=>p.estado===(accion==='iniciar'?'borrador':'recepcion'));
  if(accion==='iniciar'){
   const faltantes=[];
   for(const p of objetivos){
    const candidatos=Number((await c.query('SELECT count(*) AS n FROM tuvoto_candidatos WHERE id_proceso=$1 AND NOT eliminada',[p.id])).rows[0].n);
    const mesas=(await c.query('SELECT m.id,m.sector,EXISTS(SELECT 1 FROM tuvoto_asignaciones a WHERE a.id_mesa=m.id) AS asignada FROM tuvoto_mesas m WHERE m.id_proceso=$1 AND NOT m.eliminada',[p.id])).rows;
    const motivos=[];
    if(!candidatos)motivos.push('sin candidatos');
    if(p.configuracion?.vuelta===2&&candidatos!==2)motivos.push('segunda vuelta requiere dos candidatos');
    if(!mesas.length)motivos.push('sin mesas');
    if(mesas.some(m=>!m.asignada))motivos.push('mesas sin operador');
    if((p.configuracion?.sectores??[]).some((s:{codigo:string})=>!mesas.some(m=>m.sector===s.codigo)))motivos.push('sectores sin mesas');
    if(motivos.length)faltantes.push({id:p.id,cargo:p.cargo,ambito:p.configuracion?.ambito??'',motivos});
   }
   if(faltantes.length)throw Object.assign(new Error(),{estado:422,detalle:('Completa '+faltantes.length+' cargos: '+faltantes.slice(0,3).map(p=>p.cargo+(p.ambito?' ('+p.ambito+')':'')+': '+p.motivos.join(', ')).join('; ')).slice(0,395),faltantes});
  }else if(objetivos.length&&(await c.query('SELECT 1 FROM registros_en_curso WHERE id_proceso=ANY($1::uuid[]) LIMIT 1',[objetivos.map(p=>p.id)])).rowCount){
   throw Object.assign(new Error(),{estado:409,detalle:'Hay actas en curso. Espera su confirmación antes de terminar la institución.'});
  }
  for(const p of objetivos){
   const estado=accion==='iniciar'?'recepcion':'cerrada';
   // La publicación habilita Resultados; actual y destacado_portada conservan la selección editorial.
   await c.query('UPDATE tuvoto_procesos SET estado=$2,publicado=true WHERE id=$1',[p.id,estado]);
   await c.query('INSERT INTO historial_procesos(id,id_proceso,id_actor,anterior,nuevo) VALUES($1,$2,$3,$4,$5)',[randomUUID(),p.id,actor,p.estado,estado]);
  }
  await c.query('COMMIT');return {accion,actualizados:objetivos.length,idProcesos:objetivos.map(p=>p.id)};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export function rutasConteoInstitucion(app:Express,db:Pool){
 for(const accion of ['iniciar','terminar','preparar'] as const)app.post('/api/v1/configuracion/institucion/'+accion,async(req,res)=>{
  z.object({confirmar:z.literal(true)}).strict().parse(req.body);
  try{res.json(await cambiarConteoInstitucion(db,res.locals.actor.idOrganizacion,res.locals.actor.idUsuario,accion));}
  catch(e){const fallo=e as {estado?:number;detalle?:string;faltantes?:unknown[]};if(!fallo.estado)throw e;res.status(fallo.estado).json({detalle:fallo.detalle,faltantes:fallo.faltantes});}
 });
}
