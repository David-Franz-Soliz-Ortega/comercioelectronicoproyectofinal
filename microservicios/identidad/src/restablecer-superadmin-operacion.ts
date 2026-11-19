import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';

type Base = { query: (sql: string, valores?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> };
export function validarClave(clave: unknown): asserts clave is string {
  if (typeof clave !== 'string' || clave.length < 12 || Buffer.byteLength(clave, 'utf8') > 72 || /[\r\n\0]/.test(clave)) throw new Error('Contraseña no válida.');
}
export async function operarRecuperacion(db: Base, id: string, simular: boolean, clave: unknown,
  hashear: (clave: string, coste: number) => Promise<string> = bcrypt.hash) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error('UUID inválido.');
  if (!simular) validarClave(clave);
  await db.query(simular ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN ISOLATION LEVEL SERIALIZABLE');
  try {
    const usuario = await db.query('SELECT id, activo FROM usuarios WHERE id=$1' + (simular ? '' : ' FOR UPDATE'), [id]);
    if (usuario.rows.length !== 1 || usuario.rows[0].activo !== true) throw new Error('Cuenta ausente o inactiva.');
    const roles = await db.query("SELECT id FROM asignaciones_roles WHERE id_usuario=$1 AND rol='SUPERADMIN' AND id_organizacion IS NULL" + (simular ? '' : ' FOR SHARE'), [id]);
    if (roles.rows.length !== 1) throw new Error('SUPERADMIN global no inequívoco.');
    if (simular) { await db.query('ROLLBACK'); return { simulacion: true, idUsuario: id, cambios: false }; }
    const hash = await hashear(clave as string, 12);
    const cambio = await db.query('UPDATE usuarios SET clave_hash=$2 WHERE id=$1 AND activo=true', [id, hash]);
    if (cambio.rowCount !== 1) throw new Error('Actualización no inequívoca.');
    await db.query('UPDATE sesiones SET revocada=true WHERE id_usuario=$1 AND NOT revocada', [id]);
    await db.query('UPDATE recuperaciones SET usada=true WHERE id_usuario=$1 AND NOT usada', [id]);
    // Operador local: id_actor NULL, sin suplantar una sesión autenticada.
    await db.query('INSERT INTO auditoria_seguridad(id,id_actor,id_organizacion,accion,objetivo) VALUES($1,NULL,NULL,$2,$3)', [randomUUID(), 'restablecimiento_administrativo_superadmin', id]);
    await db.query('COMMIT'); return { simulacion: false, idUsuario: id, cambios: true };
  } catch (error) { await db.query('ROLLBACK'); throw error; }
}

// Solo el coordinador verificado invoca esta función dentro del contenedor exacto.
export async function ejecutarOperacionPrivada() {
  let bruto = ''; for await (const parte of process.stdin) { bruto += parte; if (Buffer.byteLength(bruto) > 4096) throw new Error('Entrada excesiva.'); }
  const datos = JSON.parse(bruto); bruto = '';
  if (datos.proyecto !== 'sigape-auth-test' || typeof datos.simular !== 'boolean' ||
      process.env.DB_HOST !== 'base-postgres' || process.env.DB_NAME !== 'identidad_db' ||
      process.env.DB_PORT !== '5432' || !process.env.DB_USER || !process.env.DB_PASSWORD ||
      !Array.isArray(datos.direcciones) || datos.direcciones.length === 0) throw new Error('Destino no acreditado.');
  const direcciones = await lookup('base-postgres', { all: true });
  if (!direcciones.length || direcciones.some(d => !datos.direcciones.includes(d.address))) throw new Error('DNS ajeno al PostgreSQL inspeccionado.');
  const db = new Client({ host: 'base-postgres', port: 5432, database: 'identidad_db', user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: false, connectionTimeoutMillis: 5000, statement_timeout: 5000,
    application_name: 'sigape-auth-test-restablecer-superadmin' });
  try { await db.connect(); console.log(JSON.stringify(await operarRecuperacion(db, datos.idUsuario, datos.simular, datos.clave))); }
  finally { datos.clave = undefined; await db.end(); }
}
