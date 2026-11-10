import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import { Pool } from "pg";
import swaggerUi from "swagger-ui-express";
import { parse } from "yaml";
import { z } from "zod";

const puerto = Number(process.env.PORT ?? 3000);
const pool = new Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: process.env.DB_NAME ?? "padron_electoral_db", user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 10 });
const esquemaEntrada = z.object({ idEleccion: z.string().uuid(), elegible: z.boolean() }).strict();
const esquemaUuid = z.string().uuid();
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use((solicitud, respuesta, siguiente) => {
  respuesta.setHeader("X-Correlation-ID", solicitud.header("X-Correlation-ID")?.slice(0, 128) || randomUUID());
  if (solicitud.url.startsWith("/api/v1/")) solicitud.url = solicitud.url.slice("/api/v1".length);
  siguiente();
});

function problema(respuesta: Response, estado: number, titulo: string, detalle: string): void {
  respuesta.status(estado).type("application/problem+json").json({ type: `https://sigape.local/problemas/${estado}`, title: titulo, status: estado, detail: detalle, instance: respuesta.req.originalUrl, idCorrelacion: respuesta.getHeader("X-Correlation-ID") });
}

function validarId(id: string, respuesta: Response): boolean {
  if (!esquemaUuid.safeParse(id).success) {
    problema(respuesta, 400, "Identificador inválido", "El identificador debe ser un UUID válido.");
    return false;
  }
  return true;
}

function validarPagina(solicitud: Request, respuesta: Response): { pagina: number; limite: number } | null {
  const pagina = Number(solicitud.query.pagina ?? 1);
  const limite = Number(solicitud.query.limite ?? 20);
  if (!Number.isInteger(pagina) || pagina < 1 || !Number.isInteger(limite) || limite < 1 || limite > 100) {
    problema(respuesta, 400, "Paginación inválida", "pagina debe ser mayor que cero y limite debe estar entre 1 y 100.");
    return null;
  }
  return { pagina, limite };
}

async function inicializar(): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS inscripciones (
    id_inscripcion UUID PRIMARY KEY,
    id_eleccion UUID NOT NULL,
    elegible BOOLEAN NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await pool.query("CREATE INDEX IF NOT EXISTS inscripciones_eleccion_elegibilidad_idx ON inscripciones (id_eleccion, elegible)");
}

app.get("/salud", async (_solicitud, respuesta) => {
  try { await pool.query("SELECT 1"); respuesta.json({ estado: "saludable", servicio: "padron-electoral" }); }
  catch { problema(respuesta, 503, "Base no disponible", "No se pudo consultar la base del padrón."); }
});
app.get("/openapi.yaml", async (_solicitud, respuesta, siguiente) => {
  try { respuesta.type("application/yaml").send(await readFile(new URL("../contrato.yaml", import.meta.url), "utf8")); }
  catch (error) { siguiente(error); }
});
app.get("/docs", async (_solicitud, respuesta, siguiente) => {
  try { respuesta.send(swaggerUi.generateHTML(parse(await readFile(new URL("../contrato.yaml", import.meta.url), "utf8")))); }
  catch (error) { siguiente(error); }
});

app.get("/inscripciones", async (solicitud, respuesta) => {
  const pagina = validarPagina(solicitud, respuesta);
  if (!pagina) return;
  const condiciones: string[] = [];
  const valores: unknown[] = [];
  if (solicitud.query.idEleccion !== undefined) {
    const id = esquemaUuid.safeParse(solicitud.query.idEleccion);
    if (!id.success) return problema(respuesta, 400, "Filtro inválido", "idEleccion debe ser un UUID válido.");
    valores.push(id.data); condiciones.push(`id_eleccion = $${valores.length}`);
  }
  if (solicitud.query.elegible !== undefined) {
    if (solicitud.query.elegible !== "true" && solicitud.query.elegible !== "false") return problema(respuesta, 400, "Filtro inválido", "elegible debe ser true o false.");
    valores.push(solicitud.query.elegible === "true"); condiciones.push(`elegible = $${valores.length}`);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  try {
    const total = await pool.query<{ total: string }>(`SELECT count(*) AS total FROM inscripciones ${where}`, valores);
    valores.push(pagina.limite, (pagina.pagina - 1) * pagina.limite);
    const datos = await pool.query(`SELECT id_inscripcion AS "idInscripcion", id_eleccion AS "idEleccion", elegible, creado_en AS "creadoEn", actualizado_en AS "actualizadoEn" FROM inscripciones ${where} ORDER BY creado_en DESC, id_inscripcion LIMIT $${valores.length - 1} OFFSET $${valores.length}`, valores);
    respuesta.json({ elementos: datos.rows, pagina: pagina.pagina, limite: pagina.limite, total: Number(total.rows[0].total) });
  } catch { problema(respuesta, 500, "Error interno", "No se pudo listar las inscripciones."); }
});

app.post("/inscripciones", async (solicitud, respuesta) => {
  const entrada = esquemaEntrada.safeParse(solicitud.body);
  if (!entrada.success) return problema(respuesta, 422, "Datos inválidos", entrada.error.issues.map((error) => `${error.path.join(".")}: ${error.message}`).join("; "));
  try {
    const id = randomUUID();
    const resultado = await pool.query(`INSERT INTO inscripciones (id_inscripcion, id_eleccion, elegible) VALUES ($1, $2, $3) RETURNING id_inscripcion AS "idInscripcion", id_eleccion AS "idEleccion", elegible, creado_en AS "creadoEn", actualizado_en AS "actualizadoEn"`, [id, entrada.data.idEleccion, entrada.data.elegible]);
    respuesta.location(`/api/v1/inscripciones/${id}`).status(201).json(resultado.rows[0]);
  } catch { problema(respuesta, 500, "Error interno", "No se pudo crear la inscripción."); }
});

app.get("/inscripciones/:idInscripcion/elegibilidad", async (solicitud, respuesta) => {
  if (!validarId(solicitud.params.idInscripcion, respuesta)) return;
  try {
    const resultado = await pool.query(`SELECT id_inscripcion AS "idInscripcion", elegible FROM inscripciones WHERE id_inscripcion = $1`, [solicitud.params.idInscripcion]);
    if (!resultado.rowCount) return problema(respuesta, 404, "No encontrado", "La inscripción solicitada no existe.");
    respuesta.json(resultado.rows[0]);
  } catch { problema(respuesta, 500, "Error interno", "No se pudo consultar la elegibilidad."); }
});

app.get("/inscripciones/:idInscripcion", async (solicitud, respuesta) => {
  if (!validarId(solicitud.params.idInscripcion, respuesta)) return;
  try {
    const resultado = await pool.query(`SELECT id_inscripcion AS "idInscripcion", id_eleccion AS "idEleccion", elegible, creado_en AS "creadoEn", actualizado_en AS "actualizadoEn" FROM inscripciones WHERE id_inscripcion = $1`, [solicitud.params.idInscripcion]);
    if (!resultado.rowCount) return problema(respuesta, 404, "No encontrado", "La inscripción solicitada no existe.");
    respuesta.json(resultado.rows[0]);
  } catch { problema(respuesta, 500, "Error interno", "No se pudo consultar la inscripción."); }
});

app.put("/inscripciones/:idInscripcion", async (solicitud, respuesta) => {
  if (!validarId(solicitud.params.idInscripcion, respuesta)) return;
  const entrada = esquemaEntrada.safeParse(solicitud.body);
  if (!entrada.success) return problema(respuesta, 422, "Datos inválidos", entrada.error.issues.map((error) => `${error.path.join(".")}: ${error.message}`).join("; "));
  try {
    const resultado = await pool.query(`UPDATE inscripciones SET id_eleccion = $2, elegible = $3, actualizado_en = now() WHERE id_inscripcion = $1 RETURNING id_inscripcion AS "idInscripcion", id_eleccion AS "idEleccion", elegible, creado_en AS "creadoEn", actualizado_en AS "actualizadoEn"`, [solicitud.params.idInscripcion, entrada.data.idEleccion, entrada.data.elegible]);
    if (!resultado.rowCount) return problema(respuesta, 404, "No encontrado", "La inscripción solicitada no existe.");
    respuesta.json(resultado.rows[0]);
  } catch { problema(respuesta, 500, "Error interno", "No se pudo actualizar la inscripción."); }
});

app.delete("/inscripciones/:idInscripcion", async (solicitud, respuesta) => {
  if (!validarId(solicitud.params.idInscripcion, respuesta)) return;
  try {
    const resultado = await pool.query("DELETE FROM inscripciones WHERE id_inscripcion = $1", [solicitud.params.idInscripcion]);
    if (!resultado.rowCount) return problema(respuesta, 404, "No encontrado", "La inscripción solicitada no existe.");
    respuesta.status(204).end();
  } catch { problema(respuesta, 500, "Error interno", "No se pudo eliminar la inscripción."); }
});

app.use((_solicitud, respuesta) => problema(respuesta, 404, "No encontrado", "La ruta solicitada no existe."));
const errores: ErrorRequestHandler = (error, _solicitud, respuesta, _siguiente) => problema(respuesta, error instanceof SyntaxError ? 400 : 500, "Solicitud inválida", error instanceof SyntaxError ? "El cuerpo debe contener JSON válido." : "Ocurrió un error inesperado.");
app.use(errores);
await inicializar();
app.listen(puerto, "0.0.0.0", () => console.log(`Servicio padrón electoral disponible en puerto ${puerto}`));