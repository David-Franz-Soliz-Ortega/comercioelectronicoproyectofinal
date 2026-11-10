import * as grpc from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";

const paquete = grpc.loadPackageDefinition(loadSync(
  process.env.CONTRATO_GRPC ?? new URL("../padron-v1.proto", import.meta.url).pathname,
  { keepCase: false, enums: String, defaults: true, oneofs: true },
)) as unknown as { sigape: { padron: { v1: { ServicioPadron: grpc.ServiceClientConstructor } } } };
export const definicionPadron = paquete.sigape.padron.v1.ServicioPadron.service;
export interface SolicitudElegibilidad { idCorrelacion: string; idProcesoElectoral: string; idInscripcion: string }
export interface RespuestaElegibilidad { idCorrelacion: string; resultado: string }
export interface ClientePadron extends grpc.Client {
  ConsultarElegibilidad(entrada: SolicitudElegibilidad, opciones: grpc.CallOptions,
    devolver: (error: grpc.ServiceError | null, respuesta?: RespuestaElegibilidad) => void): grpc.ClientUnaryCall;
}
export function crearClientePadron(destino = process.env.PADRON_GRPC_DIRECCION ?? "padron-electoral:50051"): ClientePadron {
  return new paquete.sigape.padron.v1.ServicioPadron(destino, grpc.credentials.createInsecure(), {
    "grpc.enable_retries": 0, "grpc.max_receive_message_length": 16384,
  }) as unknown as ClientePadron;
}
export function consultarElegibilidad(cliente: ClientePadron, entrada: SolicitudElegibilidad,
  plazoMs = Number(process.env.PADRON_GRPC_PLAZO_MS ?? 1200), senal?: AbortSignal): Promise<RespuestaElegibilidad> {
  if (!Number.isFinite(plazoMs) || plazoMs < 1 || plazoMs > 10000) throw new Error("PADRON_GRPC_PLAZO_MS debe estar entre 1 y 10000");
  return new Promise((resolver, rechazar) => {
    const cancelar = () => llamada.cancel();
    const llamada = cliente.ConsultarElegibilidad(entrada, { deadline: new Date(Date.now() + plazoMs) }, (error, respuesta) => {
      senal?.removeEventListener("abort", cancelar);
      if (error) return rechazar(error);
      if (!respuesta || respuesta.idCorrelacion !== entrada.idCorrelacion ||
          !["RESULTADO_ELEGIBILIDAD_ELEGIBLE", "RESULTADO_ELEGIBILIDAD_NO_ELEGIBLE"].includes(respuesta.resultado)) {
        return rechazar(Object.assign(new Error("Respuesta de padrón inválida"), { code: grpc.status.DATA_LOSS }));
      }
      resolver(respuesta);
    });
    if (senal?.aborted) cancelar();
    else senal?.addEventListener("abort", cancelar, { once: true });
  });
}
export function traducirErrorGrpc(error: unknown): { estadoHttp: number; codigoGrpc: number; estadoGrpc: string; detalle: string } {
  const codigo = typeof error === "object" && error !== null && "code" in error && typeof error.code === "number" ? error.code : grpc.status.UNKNOWN;
  const estados: Record<number, [number, string]> = {
    [grpc.status.INVALID_ARGUMENT]: [400, "Los identificadores de la consulta no son válidos."],
    [grpc.status.NOT_FOUND]: [404, "La inscripción solicitada no existe."],
    [grpc.status.FAILED_PRECONDITION]: [409, "La inscripción no pertenece a la elección consultada."],
    [grpc.status.DEADLINE_EXCEEDED]: [504, "El padrón no respondió dentro del plazo configurado."],
    [grpc.status.UNAVAILABLE]: [503, "El servicio de padrón no está disponible."],
    [grpc.status.RESOURCE_EXHAUSTED]: [503, "El padrón no dispone de capacidad en este momento."],
    [grpc.status.CANCELLED]: [408, "La consulta de elegibilidad fue cancelada."],
    [grpc.status.UNAUTHENTICATED]: [401, "La consulta requiere autenticación."],
    [grpc.status.PERMISSION_DENIED]: [403, "La consulta no está autorizada."],
  };
  const [estadoHttp, detalle] = estados[codigo] ?? [502, "El padrón devolvió una respuesta inesperada."];
  return { estadoHttp, codigoGrpc: codigo, estadoGrpc: grpc.status[codigo] ?? "UNKNOWN", detalle };
}
