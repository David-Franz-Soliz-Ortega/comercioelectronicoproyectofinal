const express = require("express");
const { pool } = require("./base_datos");

const app = express();
app.disable("x-powered-by");
app.use(express.json());

// Ruta de prueba: confirma que la API y PostgreSQL responden.
app.get("/salud", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      estado: "arriba",
      servicio: "ms-votos",
      baseDatos: "conectada",
    });
  } catch (error) {
    console.error("Salud: PostgreSQL no responde:", error.message);
    res.status(503).json({
      estado: "caido",
      servicio: "ms-votos",
      baseDatos: "desconectada",
    });
  }
});

// Lectura sencilla para comprobar los datos de prueba cargados.
app.get("/votos", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, "electorId", "candidatoId", "eleccionId", fecha
      FROM votos
      ORDER BY id
    `);
    res.json(rows);
  } catch (error) {
    console.error("No se pudieron listar los votos:", error.message);
    res.status(503).json({ error: "Base de datos no disponible" });
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

app.use((error, _req, res, _next) => {
  const jsonInvalido = error.type === "entity.parse.failed";
  if (jsonInvalido) {
    return res.status(400).json({ error: "El cuerpo no es JSON válido" });
  }
  console.error(error);
  return res.status(500).json({ error: "Error interno" });
});

module.exports = app;
