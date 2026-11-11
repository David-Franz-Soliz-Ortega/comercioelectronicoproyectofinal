require("dotenv").config({ quiet: true });

const { Pool } = require("pg");

// Una sola conexión compartida por la API y el script de carga.
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "votos_db",
  user: process.env.DB_USER || "votos",
  password: process.env.DB_PASSWORD || "",
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (error) => {
  console.error("Conexión ociosa de PostgreSQL interrumpida:", error.message);
});

// La tabla se crea al iniciar el servicio. No borra datos existentes.
async function crearTabla() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS votos (
      id SERIAL PRIMARY KEY,
      "electorId" UUID NOT NULL,
      "candidatoId" UUID NOT NULL,
      "eleccionId" UUID NOT NULL,
      fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT votos_elector_eleccion_unico UNIQUE ("electorId", "eleccionId")
    )
  `);
}

module.exports = { pool, crearTabla };
