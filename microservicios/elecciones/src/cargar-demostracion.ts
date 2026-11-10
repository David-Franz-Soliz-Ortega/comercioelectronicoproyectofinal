import { Pool } from "pg";

const pool = new Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: process.env.DB_NAME ?? "elecciones_db", user: process.env.DB_USER, password: process.env.DB_PASSWORD });

try {
  const resultado = await pool.query(`
    WITH series AS (
      SELECT numero, md5('sigape-p1-eleccion-' || numero::text) AS hash
      FROM generate_series(1, 10000) AS numero
    )
    INSERT INTO elecciones (id_eleccion, nombre, estado)
    SELECT
      (substr(hash, 1, 8) || '-' || substr(hash, 9, 4) || '-' || substr(hash, 13, 4) || '-' || substr(hash, 17, 4) || '-' || substr(hash, 21, 12))::uuid,
      'Elección sintética P1 ' || numero,
      'borrador'
    FROM series
    ON CONFLICT (id_eleccion) DO NOTHING
  `);
  console.log(`Registros sintéticos insertados: ${resultado.rowCount ?? 0}. La carga es idempotente.`);
} finally {
  await pool.end();
}