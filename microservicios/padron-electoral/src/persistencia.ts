import { Pool } from "pg";

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? "padron_electoral_db",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 3000,
});

// Una conexión ociosa puede cerrarse al reiniciar PostgreSQL. El pool la reemplaza.
pool.on("error", () => console.error("Conexión ociosa del padrón interrumpida."));

export async function inicializar(): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS inscripciones (
    id_inscripcion UUID PRIMARY KEY,
    id_eleccion UUID NOT NULL,
    elegible BOOLEAN NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await pool.query("CREATE INDEX IF NOT EXISTS inscripciones_eleccion_elegibilidad_idx ON inscripciones (id_eleccion, elegible)");
}
