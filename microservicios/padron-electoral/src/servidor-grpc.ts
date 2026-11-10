import * as grpc from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import type { Pool, QueryConfig } from "pg";
import { z } from "zod";

const paquete = grpc.loadPackageDefinition(loadSync(
  process.env.CONTRATO_GRPC ?? new URL("../padron-v1.proto", import.meta.url).pathname,
  { keepCase: false, enums: String, defaults: true, oneofs: true },
)) as unknown as { sigape: { padron: { v1: { ServicioPadron: grpc.ServiceClientConstructor } } } };
export const definicionPadron = paquete.sigape.padron.v1.ServicioPadron.service;
interface Solicitud { idCorrelacion: string; idProcesoElectoral: string; idInscripcion: string }
interface Respuesta { idCorrelacion: string; resultado: string }
const entrada = z.object({ idCorrelacion: z.string().min(1).max(128), idProcesoElectoral: z.string().uuid(), idInscripcion: z.string().uuid() });

export function crearServidorGrpc(pool: Pick<Pool, "query">): grpc.Server {
  const servidor = new grpc.Server({ "grpc.max_receive_message_length": 16384 });
  const consultar: grpc.handleUnaryCall<Solicitud, Respuesta> = async (llamada, devolver) => {
    const validacion = entrada.safeParse(llamada.request);
    const idCorrelacion = typeof llamada.request.idCorrelacion === "string" ? llamada.request.idCorrelacion.slice(0, 128) : "";
    function fallar(codigo: grpc.status, detalle: string): void {
      console.log(JSON.stringify({ evento: "consulta_padron_grpc", idCorrelacion, codigoGrpc: codigo }));
      if (!llamada.cancelled) devolver({ code: codigo, details: detalle, name: grpc.status[codigo], message: detalle }, null);
    }
    if (!validacion.success) return fallar(grpc.status.INVALID_ARGUMENT, "Se requieren correlación e identificadores UUID válidos");
    const datos = validacion.data;
    const plazo = llamada.getDeadline();
    const restante = (plazo instanceof Date ? plazo.getTime() : plazo) - Date.now();
    if (restante <= 0 || llamada.cancelled) return fallar(grpc.status.DEADLINE_EXCEEDED, "Plazo de consulta agotado");
    try {
      // Solo se consulta la base propia del padrón. El plazo acota la consulta SQL.
      const consulta: QueryConfig & { query_timeout: number } = {
        text: "SELECT id_eleccion, elegible FROM inscripciones WHERE id_inscripcion = $1",
        values: [datos.idInscripcion], query_timeout: Math.max(1, Math.min(1000, restante)),
      };
      const resultado = await pool.query<{ id_eleccion: string; elegible: boolean }>(consulta);
      if (llamada.cancelled) return;
      if (!resultado.rowCount) return fallar(grpc.status.NOT_FOUND, "Inscripción inexistente");
      if (resultado.rows[0].id_eleccion !== datos.idProcesoElectoral.toLowerCase()) {
        return fallar(grpc.status.FAILED_PRECONDITION, "La inscripción pertenece a otra elección");
      }
      console.log(JSON.stringify({ evento: "consulta_padron_grpc", idCorrelacion: datos.idCorrelacion, codigoGrpc: grpc.status.OK }));
      devolver(null, { idCorrelacion: datos.idCorrelacion,
        resultado: resultado.rows[0].elegible ? "RESULTADO_ELEGIBILIDAD_ELEGIBLE" : "RESULTADO_ELEGIBILIDAD_NO_ELEGIBLE" });
    } catch (error) {
      const codigo = (error as { code?: string }).code;
      const mensaje = error instanceof Error ? error.message : "";
      if (codigo === "57014" || mensaje === "Query read timeout") return fallar(grpc.status.DEADLINE_EXCEEDED, "Plazo de consulta agotado");
      if (codigo === "53300") return fallar(grpc.status.RESOURCE_EXHAUSTED, "Capacidad agotada");
      if (codigo?.startsWith("08") || ["57P01", "57P02", "57P03", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"].includes(codigo ?? "")) {
        return fallar(grpc.status.UNAVAILABLE, "Persistencia temporalmente no disponible");
      }
      fallar(grpc.status.INTERNAL, "No se pudo consultar el padrón");
    }
  };
  servidor.addService(definicionPadron, { ConsultarElegibilidad: consultar });
  return servidor;
}
export async function iniciarGrpc(pool: Pick<Pool, "query">, direccion = process.env.GRPC_DIRECCION ?? "0.0.0.0:50051"): Promise<grpc.Server> {
  const servidor = crearServidorGrpc(pool);
  await new Promise<void>((resolver, rechazar) => servidor.bindAsync(direccion, grpc.ServerCredentials.createInsecure(), error => error ? rechazar(error) : resolver()));
  console.log("Servidor gRPC del padrón disponible");
  return servidor;
}
