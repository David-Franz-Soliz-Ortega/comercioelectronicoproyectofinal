import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
// Solo persistencia propia: las actas/proyecciones anteriores nunca se copian ni se borran.
export async function prepararNuevoConteo(c:PoolClient,id:string,organizacion:string,actor:string){
 const p=(await c.query('SELECT * FROM tuvoto_procesos WHERE id=$1 AND id_organizacion=$2 AND NOT eliminada FOR UPDATE',[id,organizacion])).rows[0];
 if(!p)throw Object.assign(new Error(),{estado:404});
 if(p.estado!=='cerrada')throw Object.assign(new Error(),{estado:409,detalle:'Primero termina la recepción del conteo anterior'});
 if((await c.query('SELECT 1 FROM registros_en_curso WHERE id_proceso=$1 LIMIT 1',[id])).rowCount)throw Object.assign(new Error(),{estado:409,detalle:'Hay actas en curso; no se puede preparar otro conteo'});
 const nuevo=randomUUID();
 await c.query('INSERT INTO tuvoto_procesos(id,id_organizacion,nombre,cargo,tipo,unidad,configuracion) VALUES($1,$2,$3,$4,$5,$6,$7)',[nuevo,organizacion,p.nombre,p.cargo,p.tipo,p.unidad,p.configuracion]);
 for(const candidato of (await c.query('SELECT * FROM tuvoto_candidatos WHERE id_proceso=$1 AND NOT eliminada ORDER BY orden,id',[id])).rows)await c.query('INSERT INTO tuvoto_candidatos(id,id_proceso,nombre,orden,foto,mime,id_candidato_origen) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),nuevo,candidato.nombre,candidato.orden,candidato.foto,candidato.mime,candidato.id_candidato_origen]);
 for(const mesa of (await c.query('SELECT * FROM tuvoto_mesas WHERE id_proceso=$1 AND NOT eliminada',[id])).rows){
  const nuevaMesa=randomUUID();await c.query('INSERT INTO tuvoto_mesas(id,id_proceso,codigo,unidad,sector,id_mesa_fisica) VALUES($1,$2,$3,$4,$5,$6)',[nuevaMesa,nuevo,mesa.codigo,mesa.unidad,mesa.sector,mesa.id_mesa_fisica]);
  await c.query('INSERT INTO tuvoto_asignaciones(id_mesa,id_usuario) SELECT $1,id_usuario FROM tuvoto_asignaciones WHERE id_mesa=$2',[nuevaMesa,mesa.id]);
 }
 await c.query("UPDATE tuvoto_procesos SET estado='archivada',archivado=true,actual=false WHERE id=$1",[id]);
 await c.query('INSERT INTO historial_procesos(id,id_proceso,id_actor,anterior,nuevo) VALUES($1,$2,$3,$4,$5)',[randomUUID(),id,actor,'cerrada','archivada']);
 await c.query('INSERT INTO historial_procesos(id,id_proceso,id_actor,anterior,nuevo) VALUES($1,$2,$3,$4,$5)',[randomUUID(),nuevo,actor,'copia de '+id,'borrador']);
 return nuevo;
}
