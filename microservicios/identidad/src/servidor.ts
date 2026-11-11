import { migrarSeguridad, rutasSeguridad } from "./seguridad.js";
import { proteger } from "./autorizacion.js";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import { Pool } from "pg";
import swaggerUi from "swagger-ui-express";
import { parse } from "yaml";
import { z } from "zod";

const puerto = Number(process.env.PORT ?? 3000);
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? "identidad_db",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
});

const estados = ["activa", "suspendida"] as const;
const esquemaEntrada = z.object({
  nombre: z.string().trim().min(1).max(120),
  estado: z.enum(estados),
}).strict();
const esquemaUuid = z.string().uuid();
const app = express();
app.disable("x-powered-by");
app.use((solicitud, respuesta, siguiente) => {
  const id = solicitud.header("X-Correlation-ID")?.slice(0, 128) || randomUUID();
  respuesta.setHeader("X-Correlation-ID", id);
  if (solicitud.url.startsWith("/api/v1/")) solicitud.url = solicitud.url.slice("/api/v1".length);
  siguiente();
});
app.use(express.json({ limit: "32kb" }));

function problema(respuesta: Response, estado: number, titulo: string, detalle: string): void {
  respuesta.status(estado).type("application/problem+json").json({
    type: `https://sigape.local/problemas/${estado}`,
    title: titulo,
    status: estado,
    detail: detalle,
    instance: respuesta.req.originalUrl,
    idCorrelacion: respuesta.getHeader("X-Correlation-ID"),
  });
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS identidades (
      id_identidad UUID PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL CHECK (length(trim(nombre)) > 0),
      estado VARCHAR(16) NOT NULL CHECK (estado IN ('activa', 'suspendida')),
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

app.get("/salud", async (_solicitud, respuesta) => {
  try {
    await pool.query("SELECT 1");
    respuesta.json({ estado: "saludable", servicio: "identidad" });
  } catch {
    problema(respuesta, 503, "Base no disponible", "No se pudo consultar la base de identidad.");
  }
});

app.get("/openapi.yaml", async (_solicitud, respuesta, siguiente) => {
  try {
    respuesta.type("application/yaml").send(await readFile(new URL("../contrato.yaml", import.meta.url), "utf8"));
  } catch (error) {
    siguiente(error);
  }
});

// Servir HTML, inicializador y assets bajo el mismo prefijo canónico.
const contratoDocumentacion = parse(await readFile(new URL("../contrato.yaml", import.meta.url), "utf8"));
const opcionesDocumentacion = { swaggerOptions: { validatorUrl: null }, customSiteTitle: "API de identidad SIGAPE" };
app.use("/docs", swaggerUi.serveFiles(contratoDocumentacion, opcionesDocumentacion), swaggerUi.setup(contratoDocumentacion, opcionesDocumentacion));

rutasSeguridad(app,pool);
app.use(proteger(pool,"identidades","id_identidad","identidades","identidades"));

app.get("/identidades", async (solicitud, respuesta) => {
  const paginacion = validarPagina(solicitud, respuesta);
  if (!paginacion) return;
  const filtros: string[] = ["id_organizacion = $1"];
  const valores: unknown[] = [respuesta.locals.organizacion];
  if (solicitud.query.estado !== undefined) {
    const estado = z.enum(estados).safeParse(solicitud.query.estado);
    if (!estado.success) return problema(respuesta, 400, "Filtro inválido", "estado no es un estado reconocido.");
    valores.push(estado.data);
    filtros.push(`estado = $${valores.length}`);
  }
  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
  try {
    const total = await pool.query<{ total: string }>(`SELECT count(*) AS total FROM identidades ${where}`, valores);
    valores.push(paginacion.limite, (paginacion.pagina - 1) * paginacion.limite);
    const datos = await pool.query(
      `SELECT id_identidad AS "idIdentidad", nombre, estado, creado_en AS "creadoEn", actualizado_en AS "actualizadoEn" FROM identidades ${where} ORDER BY creado_en DESC, id_identidad LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
      valores,
    );
    respuesta.json({ elementos: datos.rows, pagina: paginacion.pagina, limite: paginacion.limite, total: Number(total.rows[0].total) });
  } catch {
    problema(respuesta, 500, "Error interno", "No se pudo listar las identidades.");
  }
});

app.post("/identidades", async (solicitud, respuesta) => {
  const entrada = esquemaEntrada.safeParse(solicitud.body);
  if (!entrada.success) return problema(respuesta, 422, "Datos inválidos", entrada.error.issues.map((error) => `${error.path.join(".")}: ${error.message}`).join("; "));
  try {
    const id = randomUUID();
    const resultado = await pool.query(
      `INSERT INTO identidades(id_organizacion, id_identidad, nombre, estado) VALUES($1, $2, $3, $4) RETURNING id_identidad AS "idIdentidad", nombre, estado, creado_en AS "creadoEn", actualizado_en AS "actualizadoEn"`,
      [respuesta.locals.organizacion,id, entrada.data.nombre, entrada.data.estado],
    );
    respuesta.location(`/api/v1/identidades/${id}`).status(201).json(resultado.rows[0]);
  } catch {
    problema(respuesta, 500, "Error interno", "No se pudo crear la identidad.");
  }
});

app.get("/identidades/:idIdentidad", async (solicitud, respuesta) => {
  if (!validarId(solicitud.params.idIdentidad, respuesta)) return;
  try {
    const resultado = await pool.query(
      `SELECT id_identidad AS "idIdentidad", nombre, estado, creado_en AS "creadoEn", actualizado_en AS "actualizadoEn" FROM identidades WHERE id_identidad = $1`,
      [solicitud.params.idIdentidad],
    );
    if (!resultado.rowCount) return problema(respuesta, 404, "No encontrado", "La identidad solicitada no existe.");
    respuesta.json(resultado.rows[0]);
  } catch {
    problema(respuesta, 500, "Error interno", "No se pudo consultar la identidad.");
  }
});

app.put("/identidades/:idIdentidad", async (solicitud, respuesta) => {
  if (!validarId(solicitud.params.idIdentidad, respuesta)) return;
  const entrada = esquemaEntrada.safeParse(solicitud.body);
  if (!entrada.success) return problema(respuesta, 422, "Datos inválidos", entrada.error.issues.map((error) => `${error.path.join(".")}: ${error.message}`).join("; "));
  try {
    const resultado = await pool.query(
      `UPDATE identidades SET nombre = $2, estado = $3, actualizado_en = now() WHERE id_identidad = $1 RETURNING id_identidad AS "idIdentidad", nombre, estado, creado_en AS "creadoEn", actualizado_en AS "actualizadoEn"`,
      [solicitud.params.idIdentidad, entrada.data.nombre, entrada.data.estado],
    );
    if (!resultado.rowCount) return problema(respuesta, 404, "No encontrado", "La identidad solicitada no existe.");
    respuesta.json(resultado.rows[0]);
  } catch {
    problema(respuesta, 500, "Error interno", "No se pudo actualizar la identidad.");
  }
});

app.delete("/identidades/:idIdentidad", async (solicitud, respuesta) => {
  if (!validarId(solicitud.params.idIdentidad, respuesta)) return;
  try {
    const resultado = await pool.query("DELETE FROM identidades WHERE id_identidad = $1", [solicitud.params.idIdentidad]);
    if (!resultado.rowCount) return problema(respuesta, 404, "No encontrado", "La identidad solicitada no existe.");
    respuesta.status(204).end();
  } catch {
    problema(respuesta, 500, "Error interno", "No se pudo eliminar la identidad.");
  }
});

const errores: ErrorRequestHandler = (error, _solicitud, respuesta, _siguiente) => {
  const detalle = error instanceof SyntaxError ? "El cuerpo debe contener JSON válido." : "Ocurrió un error inesperado.";
  problema(respuesta, error instanceof SyntaxError ? 400 : 500, "Solicitud inválida", detalle);
};
app.use((_solicitud, respuesta) => problema(respuesta, 404, "No encontrado", "La ruta solicitada no existe."));
app.use(errores);

await inicializar();
await pool.query("ALTER TABLE identidades ADD COLUMN IF NOT EXISTS id_organizacion UUID");
await pool.query("CREATE INDEX IF NOT EXISTS identidades_organizacion ON identidades(id_organizacion)");
await migrarSeguridad(pool);
app.listen(puerto, "0.0.0.0", () => console.log(`Servicio identidad disponible en puerto ${puerto}`));
