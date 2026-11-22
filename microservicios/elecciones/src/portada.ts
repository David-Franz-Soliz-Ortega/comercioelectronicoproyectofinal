import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';

export const esquemaPortada = z.object({
 idProcesos: z.array(z.string().uuid()).max(100).refine(ids => new Set(ids).size === ids.length, 'Cargos repetidos'),
 confirmar: z.literal(true),
}).strict();

// La selección editorial no publica cargos, no abre el conteo ni cambia sus resultados.
export async function guardarPortada(db: Pool, organizacion: string, ids: string[]) {
 const c = await db.connect();
 try {
  await c.query('BEGIN');
  await c.query('SELECT pg_advisory_xact_lock(hashtext($1),607005)', [organizacion]);
  const propios = await c.query('SELECT id,estado,archivado,eliminada FROM tuvoto_procesos WHERE id_organizacion=$1 ORDER BY id FOR UPDATE', [organizacion]);
  if (ids.some(id => !propios.rows.some(p => p.id === id && !p.archivado && !p.eliminada && p.estado !== 'archivada'))) {
   throw Object.assign(new Error('Cargo no disponible'), { estado: 422, detalle: 'Selecciona cargos vigentes de esta institución.' });
  }
  await c.query('UPDATE tuvoto_procesos SET destacado_portada=(id=ANY($2::uuid[])) WHERE id_organizacion=$1 AND destacado_portada IS DISTINCT FROM (id=ANY($2::uuid[]))', [organizacion, ids]);
  await c.query('COMMIT');
 } catch (error) { await c.query('ROLLBACK'); throw error; }
 finally { c.release(); }
}

export function rutasPortada(app: Express, db: Pool) {
 // Estas rutas heredan autorización administrativa, organización y CSRF del middleware.
 app.put('/api/v1/configuracion/portada', async (req, res) => {
  const datos = esquemaPortada.parse(req.body);
  await guardarPortada(db, res.locals.actor.idOrganizacion, datos.idProcesos);
  res.json({ idProcesos: datos.idProcesos });
 });
}
