const app = require("./app");
const { crearTabla, pool } = require("./base_datos");

const puerto = Number(process.env.PORT || 3005);

async function iniciar() {
  try {
    await crearTabla();
    const servidor = app.listen(puerto, "0.0.0.0", () => {
      console.log(`ms-votos escuchando en http://localhost:${puerto}`);
    });
    servidor.on("error", (error) => {
      console.error("No se pudo iniciar el servidor:", error.message);
      process.exit(1);
    });
  } catch (error) {
    console.error("No se pudo conectar con PostgreSQL:", error.message);
    await pool.end();
    process.exit(1);
  }
}

for (const senal of ["SIGINT", "SIGTERM"]) {
  process.once(senal, async () => {
    console.log(`Cerrando ms-votos (${senal})`);
    await pool.end();
    process.exit(0);
  });
}

iniciar();
