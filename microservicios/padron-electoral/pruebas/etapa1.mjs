import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import * as grpc from "@grpc/grpc-js";
import { definicionPadron } from "../dist/servidor-grpc.js";
import { pool } from "../dist/persistencia.js";

const base = process.env.PADRON_URL ?? "http://127.0.0.1:3000";
const correlacion = "prueba-integrante2";
async function solicitar(metodo, ruta, estado, cuerpo) {
  const respuesta = await fetch(base + ruta, {
    method: metodo, headers: { "Content-Type": "application/json", "X-Correlation-ID": correlacion },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(respuesta.status, estado, metodo + " " + ruta);
  assert.equal(respuesta.headers.get("x-correlation-id"), correlacion);
  if (estado === 204) return;
  if (estado >= 400) assert.match(respuesta.headers.get("content-type"), /application\/problem\+json/);
  return respuesta.json();
}
test("Etapa 1: PostgreSQL, salud, CRUD, elegibilidad REST/gRPC y carga repetible", async t => {
  t.after(() => pool.end());
  for (const ruta of ["/salud", "/api/v1/salud"]) {
    assert.deepEqual(await solicitar("GET", ruta, 200), { estado: "saludable", servicio: "padron-electoral" });
  }
  const contrato = await fetch(base + "/openapi.yaml");
  assert.equal(contrato.status, 200);
  assert.match(await contrato.text(), /consultarElegibilidad/);
  assert.equal((await fetch(base + "/docs/")).status, 200);

  const ejecutar = promisify(execFile);
  await ejecutar(process.execPath, ["dist/cargar-demostracion.js"]);
  const antes = await pool.query("SELECT * FROM inscripciones WHERE id_inscripcion IN ('20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000012') ORDER BY id_inscripcion");
  await ejecutar(process.execPath, ["dist/cargar-demostracion.js"]);
  const despues = await pool.query("SELECT * FROM inscripciones WHERE id_inscripcion IN ('20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000012') ORDER BY id_inscripcion");
  assert.equal(antes.rowCount, 2);
  assert.deepEqual(despues.rows, antes.rows);

  const entrada = { idEleccion: randomUUID(), elegible: true };
  const creado = await solicitar("POST", "/api/v1/inscripciones", 201, entrada);
  t.after(async () => { await solicitar("DELETE", "/api/v1/inscripciones/" + creado.idInscripcion, 204); });
  assert.deepEqual(Object.keys(creado).sort(), ["actualizadoEn", "creadoEn", "elegible", "idEleccion", "idInscripcion"]);
  assert.equal((await pool.query("SELECT id_eleccion FROM inscripciones WHERE id_inscripcion=$1", [creado.idInscripcion])).rows[0].id_eleccion, entrada.idEleccion);
  assert.deepEqual(await solicitar("GET", "/api/v1/inscripciones/" + creado.idInscripcion, 200), creado);
  assert.equal((await solicitar("GET", "/api/v1/inscripciones?idEleccion=" + entrada.idEleccion + "&limite=1&elegible=true", 200)).total, 1);
  assert.equal((await solicitar("GET", "/api/v1/inscripciones/" + creado.idInscripcion + "/elegibilidad", 200)).elegible, true);

  const Constructor = grpc.makeGenericClientConstructor(definicionPadron, "ServicioPadron");
  const cliente = new Constructor("127.0.0.1:50051", grpc.credentials.createInsecure());
  t.after(() => cliente.close());
  const consultar = cambios => new Promise((resolver, rechazar) => cliente.ConsultarElegibilidad({
    idCorrelacion: correlacion, idProcesoElectoral: entrada.idEleccion, idInscripcion: creado.idInscripcion, ...cambios,
  }, { deadline: Date.now() + 1500 }, (error, resultado) => error ? rechazar(error) : resolver(resultado)));
  assert.equal((await consultar()).resultado, "RESULTADO_ELEGIBILIDAD_ELEGIBLE");
  await solicitar("PUT", "/api/v1/inscripciones/" + creado.idInscripcion, 200, { ...entrada, elegible: false });
  assert.equal((await consultar()).resultado, "RESULTADO_ELEGIBILIDAD_NO_ELEGIBLE");
  await assert.rejects(consultar({ idProcesoElectoral: randomUUID() }), error => error.code === grpc.status.FAILED_PRECONDITION);
  await assert.rejects(consultar({ idInscripcion: randomUUID() }), error => error.code === grpc.status.NOT_FOUND);
  await assert.rejects(consultar({ idInscripcion: "incorrecto" }), error => error.code === grpc.status.INVALID_ARGUMENT);
  for (const ruta of ["/inscripciones?limite=101", "/inscripciones?pagina=0", "/inscripciones?elegible=si", "/inscripciones/no-uuid"]) {
    await solicitar("GET", ruta, 400);
  }
  await solicitar("POST", "/inscripciones", 422, { ...entrada, electorId: "no permitido" });
  await solicitar("POST", "/inscripciones", 422, { ...entrada, elegible: "true" });
  await solicitar("GET", "/inscripciones/" + randomUUID(), 404);
  const eliminable = await solicitar("POST", "/inscripciones", 201, entrada);
  await solicitar("DELETE", "/inscripciones/" + eliminable.idInscripcion, 204);
  await solicitar("GET", "/inscripciones/" + eliminable.idInscripcion, 404);
});
