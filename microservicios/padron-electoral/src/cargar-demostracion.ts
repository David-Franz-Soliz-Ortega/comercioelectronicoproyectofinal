// Práctica 3: un script separado para cargar datos de ejemplo.
import { inicializar, pool } from "./persistencia.js";

const idEleccion = "20000000-0000-4000-8000-000000000001";
const inscripciones = [
  { id: "20000000-0000-4000-8000-000000000011", elegible: true },
  { id: "20000000-0000-4000-8000-000000000012", elegible: false },
];

async function cargarDatos(): Promise<void> {
  try {
    await inicializar();
    for (const inscripcion of inscripciones) {
      // $1, $2 y $3 son parámetros; DO NOTHING evita duplicar un ID existente.
      await pool.query(
        "INSERT INTO inscripciones (id_inscripcion, id_eleccion, elegible) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [inscripcion.id, idEleccion, inscripcion.elegible],
      );
    }
    console.log("Listo: las dos inscripciones de ejemplo están guardadas.");
  } finally {
    await pool.end();
  }
}

cargarDatos().catch(() => {
  console.error("No se pudieron cargar los datos. Revisa PostgreSQL.");
  process.exitCode = 1;
});
