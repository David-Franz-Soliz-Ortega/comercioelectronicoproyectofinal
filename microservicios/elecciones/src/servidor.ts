import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import { Pool } from "pg";
import swaggerUi from "swagger-ui-express";
import { parse } from "yaml";
import { z } from "zod";

import { crearClientePadron, consultarElegibilidad, traducirErrorGrpc } from "./cliente-padron.js";

const clientePadron = crearClientePadron();
const puerto = Number(process.env.PORT ?? 3000);
const pool = new Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: process.env.DB_NAME ?? "elecciones_db", user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 10 });
const estados = ["borrador", "programada", "en_curso", "finalizada", "anulada"] as const;
const esquemaEntrada = z.object({ nombre: z.string().trim().min(1).max(120), estado: z.enum(estados) }).strict();
const esquemaUuid = z.string().uuid();
const app = express();
app.disable("x-powered-by");
app.use((solicitud, respuesta, siguiente) => {
  respuesta.setHeader("X-Correlation-ID", solicitud.header("X-Correlation-ID")?.slice(0, 128) || randomUUID());
  if (solicitud.url.startsWith("/api/v1/")) solicitud.url = solicitud.url.slice("/api/v1".length);
  siguiente();
});
app.use(express.json({ limit: "32kb" }));

function problema(respuesta: Response, estado: number, titulo: string, detalle: string, extras: Record<string, unknown> = {}): void {
  respuesta.status(estado).type("application/problem+json").json({ type: `https://sigape.local/problemas/${estado}`, title: titulo, status: estado, detail: detalle, instance: respuesta.req.originalUrl, idCorrelacion: respuesta.getHeader("X-Correlation-ID"), ...extras });
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
  await pool.query(`CREATE TABLE IF NOT EXISTS elecciones (
    id_eleccion UUID PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL CHECK (length(trim(nombre)) > 0),
    estado VARCHAR(16) NOT NULL CHECK (estado IN ('borrador', 'programada', 'en_curso', 'finalizada', 'anulada')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await pool.query("CREATE INDEX IF NOT EXISTS elecciones_estado_creado_idx ON elecciones (estado, creado_en DESC)");
}

app.get("/salud", async (_solicitud, respuesta) => {
  try { await pool.query("SELECT 1"); respuesta.json({ estado: "saludable", servicio: "elecciones" }); }
  catch { problema(respuesta, 503, "Base no disponible", "No se pudo consultar la base de elecciones."); }
});
app.get("/openapi.yaml", async (_solicitud, respuesta, siguiente) => {
  try { respuesta.type("application/yaml").send(await readFile(new URL("../contrato.yaml", import.meta.url), "utf8")); }
  catch (error) { siguiente(error); }
});
// Servir HTML, inicializador y assets bajo el mismo prefijo canónico.
const contratoDocumentacion = parse(await readFile(new URL("../contrato.yaml", import.meta.url), "utf8"));
const opcionesDocumentacion = { swaggerOptions: { validatorUrl: null }, customSiteTitle: "API de elecciones SIGAPE" };
app.use("/docs", swaggerUi.serveFiles(contratoDocumentacion, opcionesDocumentacion), swaggerUi.setup(contratoDocumentacion, opcionesDocumentacion));

app.get("/elecciones", async (solicitud, respuesta) => {
  const pagina = validarPagina(solicitud, respuesta);
  if (!pagina) return;
  const condiciones: string[] = [];
  const valores: unknown[] = [];
  if (solicitud.query.estado !== undefined) {
    const estado = z.enum(estados).safeParse(solicitud.query.estado);
    if (!estado.success) return problema(respuesta, 400, "Filtro inválido", "estado no es un estado reconocido.");
    valores.push(estado.data); condiciones.push(`estado = $${valores.length}`);
  }
  if (solicitud.query.nombre !== undefined) {
    const nombre = z.string().trim().min(1).max(120).safeParse(solicitud.query.nombre);
    if (!nombre.success) return problema(respuesta, 400, "Filtro inválido", "nombre debe contener entre 1 y 120 caracteres.");
    valores.push(`%${nombre.data}%`); condiciones.push(`nombre ILIKE $${valores.length}`);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  try {
    const total = await pool.query<{ total: string }>(`SELECT count(*) AS total FROM elecciones ${where}`, valores);
    valores.push(pagina.limite, (pagina.pagina - 1) * pagina.limite);
    const datos = await pool.query(`SELECT id_eleccion AS "idEleccion", nombre, estado, creado_en AS "creadoEn", actualizado_en AS "actualizadoEn" FROM elecciones ${where} ORDER BY creado_en DESC, id_eleccion LIMIT $${valores.length - 1} OFFSET $${valores.length}`, valores);
    respuesta.json({ elementos: datos.rows, pagina: pagina.pagina, limite: pagina.limite, total: Number(total.rows[0].total) });
  } catch { problema(respuesta, 500, "Error interno", "No se pudo listar las elecciones."); }
});

app.post("/elecciones", async (solicitud, respuesta) => {
  const entrada = esquemaEntrada.safeParse(solicitud.body);
  if (!entrada.success) return problema(respuesta, 422, "Datos inválidos", entrada.error.issues.map((error) => `${error.path.join(".")}: ${error.message}`).join("; "));
  try {
    const id = randomUUID();
    const resultado = await pool.query(`INSERT INTO elecciones (id_eleccion, nombre, estado) VALUES ($1, $2, $3) RETURNING id_eleccion AS "idEleccion", nombre, estado, creado_en AS "creadoEn", actualizado_en AS "actualizadoEn"`, [id, entrada.data.nombre, entrada.data.estado]);
    respuesta.location(`/api/v1/elecciones/${id}`).status(201).json(resultado.rows[0]);
  } catch { problema(respuesta, 500, "Error interno", "No se pudo crear la elección."); }
});

app.get("/elecciones/:idEleccion/inscripciones/:idInscripcion/elegibilidad", async (solicitud, respuesta) => {
  if (!validarId(solicitud.params.idEleccion, respuesta) || !validarId(solicitud.params.idInscripcion, respuesta)) return;
  try {
    const existe = await pool.query("SELECT 1 FROM elecciones WHERE id_eleccion = $1", [solicitud.params.idEleccion]);
    if (!existe.rowCount) return problema(respuesta, 404, "No encontrado", "La elección solicitada no existe.");
  } catch { return problema(respuesta, 503, "Base no disponible", "No se pudo consultar la base de elecciones."); }
  const controlador = new AbortController();
  const cancelar = () => { if (!respuesta.writableEnded) controlador.abort(); };
  respuesta.on("close", cancelar);
  const idCorrelacion = String(respuesta.getHeader("X-Correlation-ID"));
  try {
    const resultado = await consultarElegibilidad(clientePadron, {
      idCorrelacion, idProcesoElectoral: solicitud.params.idEleccion, idInscripcion: solicitud.params.idInscripcion,
    }, undefined, controlador.signal);
    console.log(JSON.stringify({ evento: "cliente_padron_grpc", idCorrelacion, codigoGrpc: 0 }));
    if (!respuesta.destroyed) respuesta.json({ idEleccion: solicitud.params.idEleccion, idInscripcion: solicitud.params.idInscripcion,
      elegible: resultado.resultado === "RESULTADO_ELEGIBILIDAD_ELEGIBLE", idCorrelacion });
  } catch (error) {
    const { estadoHttp, detalle, codigoGrpc, estadoGrpc } = traducirErrorGrpc(error);
    console.log(JSON.stringify({ evento: "cliente_padron_grpc", idCorrelacion, codigoGrpc }));
    if (!respuesta.destroyed) problema(respuesta, estadoHttp, "Consulta de elegibilidad no disponible", detalle, { codigoGrpc, estadoGrpc });
  } finally { respuesta.off("close", cancelar); }
});

app.get("/elecciones/:idEleccion", async (solicitud, respuesta) => {
  if (!validarId(solicitud.params.idEleccion, respuesta)) return;
  try {
    const resultado = await pool.query(`SELECT id_eleccion AS "idEleccion", nombre, estado, creado_en AS "creadoEn", actualizado_en AS "actualizadoEn" FROM elecciones WHERE id_eleccion = $1`, [solicitud.params.idEleccion]);
    if (!resultado.rowCount) return problema(respuesta, 404, "No encontrado", "La elección solicitada no existe.");
    respuesta.json(resultado.rows[0]);
  } catch { problema(respuesta, 500, "Error interno", "No se pudo consultar la elección."); }
});

app.put("/elecciones/:idEleccion", async (solicitud, respuesta) => {
  if (!validarId(solicitud.params.idEleccion, respuesta)) return;
  const entrada = esquemaEntrada.safeParse(solicitud.body);
  if (!entrada.success) return problema(respuesta, 422, "Datos inválidos", entrada.error.issues.map((error) => `${error.path.join(".")}: ${error.message}`).join("; "));
  try {
    const actual = await pool.query<{ estado: string }>("SELECT estado FROM elecciones WHERE id_eleccion = $1", [solicitud.params.idEleccion]);
    if (!actual.rowCount) return problema(respuesta, 404, "No encontrado", "La elección solicitada no existe.");
    if (actual.rows[0].estado !== "borrador") return problema(respuesta, 409, "Conflicto de estado", "Solo se pueden actualizar elecciones en borrador.");
    const resultado = await pool.query(`UPDATE elecciones SET nombre = $2, estado = $3, actualizado_en = now() WHERE id_eleccion = $1 RETURNING id_eleccion AS "idEleccion", nombre, estado, creado_en AS "creadoEn", actualizado_en AS "actualizadoEn"`, [solicitud.params.idEleccion, entrada.data.nombre, entrada.data.estado]);
    respuesta.json(resultado.rows[0]);
  } catch { problema(respuesta, 500, "Error interno", "No se pudo actualizar la elección."); }
});

app.delete("/elecciones/:idEleccion", async (solicitud, respuesta) => {
  if (!validarId(solicitud.params.idEleccion, respuesta)) return;
  try {
    const resultado = await pool.query("DELETE FROM elecciones WHERE id_eleccion = $1 AND estado = 'borrador'", [solicitud.params.idEleccion]);
    if (!resultado.rowCount) {
      const existe = await pool.query("SELECT 1 FROM elecciones WHERE id_eleccion = $1", [solicitud.params.idEleccion]);
      return problema(respuesta, existe.rowCount ? 409 : 404, existe.rowCount ? "Conflicto de estado" : "No encontrado", existe.rowCount ? "Solo se pueden eliminar elecciones en borrador." : "La elección solicitada no existe.");
    }
    respuesta.status(204).end();
  } catch { problema(respuesta, 500, "Error interno", "No se pudo eliminar la elección."); }
});

app.use((_solicitud, respuesta) => problema(respuesta, 404, "No encontrado", "La ruta solicitada no existe."));
const errores: ErrorRequestHandler = (error, _solicitud, respuesta, _siguiente) => problema(respuesta, error instanceof SyntaxError ? 400 : 500, "Solicitud inválida", error instanceof SyntaxError ? "El cuerpo debe contener JSON válido." : "Ocurrió un error inesperado.");
app.use(errores);
await inicializar();
const servidorHttp = app.listen(puerto, "0.0.0.0", () => console.log(`Servicio elecciones disponible en puerto ${puerto}`));
for (const senal of ["SIGTERM", "SIGINT"]) process.once(senal, () => {
  servidorHttp.close(() => { clientePadron.close(); void pool.end(); });
  setTimeout(() => process.exit(1), 10000).unref();
});
