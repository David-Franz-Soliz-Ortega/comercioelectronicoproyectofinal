import { inicializar, pool } from "./persistencia.js";

const idEleccion = "20000000-0000-4000-8000-000000000001";
try {
  await inicializar();
  const resultado = await pool.query(`INSERT INTO inscripciones (id_inscripcion, id_eleccion, elegible)
    VALUES ('20000000-0000-4000-8000-000000000011', $1, true),
           ('20000000-0000-4000-8000-000000000012', $1, false)
    ON CONFLICT (id_inscripcion) DO NOTHING`, [idEleccion]);
  console.log(JSON.stringify({ mensaje: "Demostración sintética del padrón preparada", nuevas: resultado.rowCount, idEleccion }));
} catch {
  console.error("No se pudo cargar la demostración del padrón. Revisa la conexión a PostgreSQL.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
