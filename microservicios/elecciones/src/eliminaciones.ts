import type { Express } from 'express';
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { exigirBorrador } from './modelo.js';

// Retirar del catálogo conserva filas, fotografías y asignaciones originales.
export function rutasEliminaciones(app:Express,db:Pool){
 for(const tipo of ['candidatos','mesas'] as const)app.delete('/api/v1/configuracion/'+tipo+'/:id',async(req,res)=>{
  const id=z.string().uuid().parse(req.params.id),actor=res.locals.actor;
  z.object({confirmar:z.literal(true)}).strict().parse(req.body);
  const c=await db.connect();
  try{
   await c.query('BEGIN');
   const r=await c.query(`SELECT p.id,p.estado,p.eliminada,p.actual,p.publicado FROM tuvoto_${tipo} r JOIN tuvoto_procesos p ON p.id=r.id_proceso WHERE r.id=$1 AND p.id_organizacion=$2 AND NOT p.eliminada AND NOT r.eliminada FOR UPDATE OF p,r`,[id,actor.idOrganizacion]);
   if(!r.rowCount)throw Object.assign(new Error(),{estado:404,detalle:'Recurso no disponible'});
   const p=r.rows[0];exigirBorrador(p);
   if(p.actual||p.publicado||(await c.query('SELECT 1 FROM registros_en_curso WHERE id_proceso=$1 LIMIT 1',[p.id])).rowCount)throw Object.assign(new Error(),{estado:409,detalle:'El cargo ya tiene publicación o registros en curso'});
   if(tipo==='candidatos'&&(await c.query('SELECT 1 FROM tuvoto_candidatos WHERE id_candidato_origen=$1 LIMIT 1',[id])).rowCount)throw Object.assign(new Error(),{estado:409,detalle:'Una segunda vuelta conserva este candidato'});
   const fila=(await c.query(`SELECT to_jsonb(r)-'foto' AS datos FROM tuvoto_${tipo} r WHERE id=$1 AND NOT eliminada`,[id])).rows[0];
   if(!fila)throw Object.assign(new Error(),{estado:404});
   await c.query(`UPDATE tuvoto_${tipo} SET eliminada=true WHERE id=$1`,[id]);
   await c.query('INSERT INTO historial_catalogo(id,id_proceso,id_actor,tipo,id_recurso,accion,anterior) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),p.id,actor.idUsuario,tipo,id,'retirada',fila.datos]);
   await c.query('COMMIT');res.sendStatus(204);
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 });
}
