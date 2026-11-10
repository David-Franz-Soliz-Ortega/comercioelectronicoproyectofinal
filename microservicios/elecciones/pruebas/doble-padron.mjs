// Doble aislado de red: nunca consulta bases ni sustituye al padrón principal.
import * as grpc from '/app/node_modules/@grpc/grpc-js/build/src/index.js';
import { definicionPadron } from '/app/dist/cliente-padron.js';
const servidor = new grpc.Server();
servidor.addService(definicionPadron, { ConsultarElegibilidad: (llamada, devolver) => {
  console.log(JSON.stringify({ evento: 'doble_grpc', idCorrelacion: llamada.request.idCorrelacion }));
  if (llamada.request.idCorrelacion === 'prueba-no-disponible') {
    return devolver({ code: grpc.status.UNAVAILABLE, details: 'Fallo simulado de red' });
  }
  setTimeout(() => {
    if (!llamada.cancelled) devolver(null, { idCorrelacion: llamada.request.idCorrelacion, resultado: 'RESULTADO_ELEGIBILIDAD_ELEGIBLE' });
  }, 1500).unref();
} });
servidor.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), error => { if (error) throw error; });
process.on('SIGTERM', () => { servidor.forceShutdown(); process.exit(0); });
