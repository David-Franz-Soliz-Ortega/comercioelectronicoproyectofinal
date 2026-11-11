const { pool, crearTabla } = require("./base_datos");

// Datos sintéticos: no corresponden a personas ni elecciones reales.
const votos = [
  {
    electorId: "11111111-1111-4111-8111-111111111111",
    candidatoId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    eleccionId: "33333333-3333-4333-8333-333333333333",
    fecha: "2026-11-01T10:00:00Z",
  },
  {
    electorId: "22222222-2222-4222-8222-222222222222",
    candidatoId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    eleccionId: "33333333-3333-4333-8333-333333333333",
    fecha: "2026-11-01T10:05:00Z",
  },
  {
    electorId: "44444444-4444-4444-8444-444444444444",
    candidatoId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    eleccionId: "33333333-3333-4333-8333-333333333333",
    fecha: "2026-11-01T10:10:00Z",
  },
];

async function cargar() {
  await crearTabla();

  for (const voto of votos) {
    await pool.query(
      `INSERT INTO votos ("electorId", "candidatoId", "eleccionId", fecha)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("electorId", "eleccionId") DO NOTHING`,
      [voto.electorId, voto.candidatoId, voto.eleccionId, voto.fecha],
    );
  }

  const { rows } = await pool.query("SELECT count(*)::int AS total FROM votos");
  console.log(`Datos de prueba cargados. Total de votos: ${rows[0].total}`);
}

cargar()
  .catch((error) => {
    console.error("No se pudieron cargar los datos de prueba:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
