import assert from 'node:assert/strict';
import * as grpc from '/app/node_modules/@grpc/grpc-js/build/src/index.js';
import { crearClientePadron, consultarElegibilidad, traducirErrorGrpc } from '/app/dist/cliente-padron.js';
const entrada = { idCorrelacion: 'prueba-grpc-contenedores', idProcesoElectoral: process.env.PRUEBA_ELECCION, idInscripcion: process.env.PRUEBA_INSCRIPCION };
const real = crearClientePadron();
const doble = crearClientePadron('padron-grpc-pruebas:50051');
try {
  const respuesta = await consultarElegibilidad(real, entrada);
  assert.equal(respuesta.resultado, 'RESULTADO_ELEGIBILIDAD_ELEGIBLE');
  console.log('OK: elecciones → padrón real por gRPC/HTTP2 entre contenedores, con deadline');
  await assert.rejects(consultarElegibilidad(real, { ...entrada, idInscripcion: 'invalido' }), e => e.code === 3);
  console.log('OK: INVALID_ARGUMENT real (3)');
  await new Promise((resolver, rechazar) => doble.waitForReady(Date.now() + 8000, error => error ? rechazar(error) : resolver()));
  const inicio = performance.now();
  await assert.rejects(consultarElegibilidad(doble, entrada, 100), e => e.code === 4 && traducirErrorGrpc(e).estadoHttp === 504);
  assert.ok(performance.now() - inicio < 1200);
  console.log('OK: DEADLINE_EXCEEDED real (4) a los 100 ms frente a respuesta demorada 1500 ms; HTTP 504');
  await assert.rejects(consultarElegibilidad(doble, { ...entrada, idCorrelacion: 'prueba-no-disponible' }), e => e.code === 14 && traducirErrorGrpc(e).estadoHttp === 503);
  console.log('OK: UNAVAILABLE real (14) y traducción HTTP 503');
} finally { real.close(); doble.close(); }
