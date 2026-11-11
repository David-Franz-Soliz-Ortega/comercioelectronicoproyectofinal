const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");

const app = require("../src/app");
const { pool } = require("../src/base_datos");

let servidor;
let url;

before(async () => {
  servidor = app.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  url = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
  await new Promise((resolver) => servidor.close(resolver));
  await pool.end();
});

test("GET /salud responde 200 y confirma PostgreSQL", async () => {
  const respuesta = await fetch(`${url}/salud`);
  assert.equal(respuesta.status, 200);

  const cuerpo = await respuesta.json();
  assert.equal(cuerpo.servicio, "ms-votos");
  assert.equal(cuerpo.baseDatos, "conectada");
});

test("GET /votos devuelve un arreglo", async () => {
  const respuesta = await fetch(`${url}/votos`);
  assert.equal(respuesta.status, 200);

  const cuerpo = await respuesta.json();
  assert.ok(Array.isArray(cuerpo));
});
