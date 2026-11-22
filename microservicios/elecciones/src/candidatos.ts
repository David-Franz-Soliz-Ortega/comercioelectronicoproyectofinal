import type { Express } from 'express';
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { exigirBorrador } from './modelo.js';

export const esquemaNombreCandidato = z.object({ nombre: z.string().trim().min(1).max(120) }).strict();

export async function editarNombreCandidato(db: Pool, id: string, organizacion: string, actor: string, nombre: string) {
 const c = await db.connect();
 try {
  await c.query('BEGIN');
  const r = await c.query('SELECT p.id,p.estado,p.eliminada,p.actual,p.publicado,c.nombre FROM tuvoto_candidatos c JOIN tuvoto_procesos p ON p.id=c.id_proceso WHERE c.id=$1 AND p.id_organizacion=$2 AND NOT p.eliminada AND NOT c.eliminada FOR UPDATE OF p,c', [id, organizacion]);
  if (!r.rowCount) throw Object.assign(new Error(), { estado: 404, detalle: 'Candidato no disponible.' });
  const p = r.rows[0]; exigirBorrador(p);
  if (p.actual || p.publicado || (await c.query('SELECT 1 FROM registros_en_curso WHERE id_proceso=$1 LIMIT 1', [p.id])).rowCount) throw Object.assign(new Error(), { estado: 409, detalle: 'El cargo ya tiene publicación o registros en curso.' });
  if ((await c.query('SELECT 1 FROM tuvoto_candidatos WHERE id_candidato_origen=$1 LIMIT 1', [id])).rowCount) throw Object.assign(new Error(), { estado: 409, detalle: 'Otra vuelta conserva una referencia a este candidato.' });
  if (p.nombre !== nombre) {
   await c.query('UPDATE tuvoto_candidatos SET nombre=$2 WHERE id=$1', [id, nombre]);
   await c.query("INSERT INTO historial_catalogo(id,id_proceso,id_actor,tipo,id_recurso,accion,anterior) VALUES($1,$2,$3,'candidatos',$4,'nombre_editado',$5)", [randomUUID(), p.id, actor, id, { nombre: p.nombre }]);
  }
  await c.query('COMMIT');
 } catch (e) { await c.query('ROLLBACK'); throw e; }
 finally { c.release(); }
}

export function rutasCandidatos(app: Express, db: Pool) {
 // Hereda sesión, autorización por organización y CSRF de /configuracion.
 app.put('/api/v1/configuracion/candidatos/:id', async (req, res) => {
  const id = z.string().uuid().parse(req.params.id), d = esquemaNombreCandidato.parse(req.body);
  await editarNombreCandidato(db, id, res.locals.actor.idOrganizacion, res.locals.actor.idUsuario, d.nombre);
  res.sendStatus(204);
 });
}
