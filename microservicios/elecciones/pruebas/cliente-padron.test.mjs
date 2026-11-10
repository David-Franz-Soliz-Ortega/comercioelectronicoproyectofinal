import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import * as grpc from '@grpc/grpc-js';
process.env.CONTRATO_GRPC ??= fileURLToPath(new URL('../../../compartido/contratos/grpc/padron-v1.proto', import.meta.url));
const { crearClientePadron, consultarElegibilidad, definicionPadron, traducirErrorGrpc } = await import('../dist/cliente-padron.js');
const entrada = { idCorrelacion: 'prueba', idProcesoElectoral: '10000000-0000-4000-8000-000000000001', idInscripcion: '10000000-0000-4000-8000-000000000002' };

test('el cliente aplica deadline real y traduce DEADLINE_EXCEEDED a HTTP 504', async t => {
  const servidor = new grpc.Server();
  servidor.addService(definicionPadron, { ConsultarElegibilidad: (llamada, devolver) => {
    setTimeout(() => { if (!llamada.cancelled) devolver(null, { idCorrelacion: 'prueba', resultado: 'RESULTADO_ELEGIBILIDAD_ELEGIBLE' }); }, 250).unref();
  } });
  const puerto = await new Promise((resolver, rechazar) => servidor.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (error, puerto) => error ? rechazar(error) : resolver(puerto)));
  const cliente = crearClientePadron('127.0.0.1:' + puerto);
  t.after(() => { cliente.close(); servidor.forceShutdown(); });
  await new Promise((resolver, rechazar) => cliente.waitForReady(Date.now() + 3000, error => error ? rechazar(error) : resolver()));
  await assert.rejects(consultarElegibilidad(cliente, entrada, 40), error => error.code === grpc.status.DEADLINE_EXCEEDED && traducirErrorGrpc(error).estadoHttp === 504);
});

test('mapea códigos de protocolo sin revelar mensajes internos', () => {
  for (const [codigo, http] of [[3,400],[5,404],[9,409],[4,504],[14,503],[8,503],[1,408],[13,502],[15,502],[16,401],[7,403]]) {
    const resultado = traducirErrorGrpc({ code: codigo, message: 'dato interno reservado' });
    assert.equal(resultado.estadoHttp, http); assert.equal(resultado.codigoGrpc, codigo);
    assert.ok(!resultado.detalle.includes('reservado'));
  }
});

test('rechaza respuestas sin correlación o resultado reconocido', async t => {
  const servidor = new grpc.Server();
  servidor.addService(definicionPadron, { ConsultarElegibilidad: (_, devolver) => devolver(null, { idCorrelacion: 'otra', resultado: 'RESULTADO_ELEGIBILIDAD_NO_DEFINIDO' }) });
  const puerto = await new Promise((resolver, rechazar) => servidor.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (error, puerto) => error ? rechazar(error) : resolver(puerto)));
  const cliente = crearClientePadron('127.0.0.1:' + puerto);
  t.after(() => { cliente.close(); servidor.forceShutdown(); });
  await assert.rejects(consultarElegibilidad(cliente, entrada), error => error.code === grpc.status.DATA_LOSS);
});
