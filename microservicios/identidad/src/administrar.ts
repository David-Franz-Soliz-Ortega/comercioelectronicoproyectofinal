import { Pool } from 'pg';
import { migrarSeguridad, bootstrap } from './seguridad.js';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? 'identidad_db',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

try {
  const bloques = [];
  for await (const bloque of process.stdin) bloques.push(bloque);
  let datos: unknown = null;
  if (bloques.length) {
    const raw = Buffer.concat(bloques).toString('utf8').trim();
    if (raw) datos = JSON.parse(raw);
  }
  if (!datos && process.env.SUPERADMIN_USUARIO && process.env.SUPERADMIN_CLAVE) {
    datos = {
      usuario: process.env.SUPERADMIN_USUARIO,
      contrasena: process.env.SUPERADMIN_CLAVE,
    };
  }
  if (!datos) {
    throw new Error('Se requieren credenciales válidas por stdin o variables de entorno');
  }
  await migrarSeguridad(pool);
  const resultado = await bootstrap(pool, datos);
  console.log(JSON.stringify(resultado));
} catch {
  console.error('No se pudo inicializar: entrada inválida o bootstrap ya realizado');
  process.exitCode = 1;
} finally {
  await pool.end();
}
