// Práctica 7: preparar datos, llamar a la API y comprobar la respuesta.
const request = require("supertest");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");

const api = request(process.env.PADRON_URL || "http://localhost:3004");
const base = new Pool({
  host: process.env.DB_HOST, database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  max: 1, connectionTimeoutMillis: 2000,
});
afterAll(() => base.end());

test("GET /salud comprueba el servicio y PostgreSQL", async () => {
  const respuesta = await api.get("/salud");
  expect(respuesta.status).toBe(200);
  expect(respuesta.body.estado).toBe("saludable");
  await api.get("/api/v1/salud").expect(200);
});

test("crea, consulta, modifica y elimina una inscripción", async () => {
  const datos = { idEleccion: randomUUID(), elegible: true };
  const creada = await api.post("/api/v1/inscripciones").send(datos).expect(201);
  const id = creada.body.idInscripcion;
  const ruta = "/api/v1/inscripciones/" + id;

  try {
    const guardada = await base.query(
      "SELECT elegible FROM inscripciones WHERE id_inscripcion = $1", [id]
    );
    expect(guardada.rows[0].elegible).toBe(true);

    const consulta = await api.get(ruta).expect(200);
    expect(consulta.body.idEleccion).toBe(datos.idEleccion);
    const lista = await api.get("/api/v1/inscripciones")
      .query({ idEleccion: datos.idEleccion, limite: 1 }).expect(200);
    expect(lista.body.total).toBe(1);

    await api.put(ruta).send({ idEleccion: datos.idEleccion, elegible: false }).expect(200);
    const resultado = await api.get(ruta + "/elegibilidad").expect(200);
    expect(resultado.body.elegible).toBe(false);
  } finally {
    // Limpia solamente la inscripción creada por esta prueba.
    await api.delete(ruta).expect(204);
  }
  await api.get(ruta).expect(404);
});

test("rechaza campos inválidos y paginación fuera de rango", async () => {
  await api.post("/inscripciones").send({}).expect(422);
  await api.post("/inscripciones")
    .send({ idEleccion: randomUUID(), elegible: true, electorId: "no permitido" }).expect(422);
  await api.get("/inscripciones/no-es-uuid").expect(400);
  await api.get("/inscripciones?limite=101").expect(400);
  await api.get("/inscripciones?pagina=0").expect(400);
});

test("ofrece documentación y el contrato del equipo", async () => {
  await api.get("/docs/").expect(200);
  const contrato = await api.get("/openapi.yaml").expect(200);
  expect(contrato.text).toContain("consultarElegibilidad");
});
