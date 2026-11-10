import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import * as grpc from '@grpc/grpc-js';
process.env.CONTRATO_GRPC ??= fileURLToPath(new URL('../../../compartido/contratos/grpc/padron-v1.proto', import.meta.url));
const { crearServidorGrpc, definicionPadron } = await import('../dist/servidor-grpc.js');
const idEleccion = '10000000-0000-4000-8000-000000000001';
const idInscripcion = '10000000-0000-4000-8000-000000000002';
async function preparar(t, consultar) {
  const servidor = crearServidorGrpc({ query: consultar });
  const puerto = await new Promise((resolver, rechazar) => servidor.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (error, puerto) => error ? rechazar(error) : resolver(puerto)));
  const Constructor = grpc.makeGenericClientConstructor(definicionPadron, 'ServicioPadron');
  const cliente = new Constructor('127.0.0.1:' + puerto, grpc.credentials.createInsecure());
  t.after(() => { cliente.close(); servidor.forceShutdown(); });
  return cambios => new Promise((resolver, rechazar) => cliente.ConsultarElegibilidad({
    idCorrelacion: 'prueba', idProcesoElectoral: idEleccion, idInscripcion, ...cambios,
  }, { deadline: Date.now() + 1000 }, (error, respuesta) => error ? rechazar(error) : resolver(respuesta)));
}
test('devuelve elegibilidad sintética y valida asociación con la elección', async t => {
  let elegible = true;
  const llamar = await preparar(t, async () => ({ rowCount: 1, rows: [{ id_eleccion: idEleccion, elegible }] }));
  assert.equal((await llamar()).resultado, 'RESULTADO_ELEGIBILIDAD_ELEGIBLE');
  elegible = false;
  assert.equal((await llamar()).resultado, 'RESULTADO_ELEGIBILIDAD_NO_ELEGIBLE');
  await assert.rejects(llamar({ idProcesoElectoral: idInscripcion }), error => error.code === 9);
  await assert.rejects(llamar({ idInscripcion: 'invalido' }), error => error.code === 3);
});
test('distingue ausencia, fallo de conexión y timeout SQL', async t => {
  let fallo;
  const llamar = await preparar(t, async () => { if (fallo) throw fallo; return { rowCount: 0, rows: [] }; });
  await assert.rejects(llamar(), error => error.code === 5);
  fallo = Object.assign(new Error('conexión'), { code: 'ECONNREFUSED' });
  await assert.rejects(llamar(), error => error.code === 14);
  fallo = Object.assign(new Error('timeout SQL'), { code: '57014' });
  await assert.rejects(llamar(), error => error.code === 4);
});
