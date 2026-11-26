import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararCargaFoto, transmitirFoto } from '../src/api/cargaFoto.js';

test('una respuesta perdida repite solo esa parte y conserva la referencia de la foto', async () => {
  const foto = 'x'.repeat(350000);
  const carga = prepararCargaFoto(foto);
  const recibidas = new Map();
  const intentos = [];
  async function pedir(ruta, {datos}) {
    assert.equal(ruta, '/actas/cargas/' + carga.id);
    intentos.push(datos.indice);
    recibidas.set(datos.indice, datos.contenido);
    if (intentos.length === 2) throw Error('Subida interrumpida');
  }
  const progreso = () => {};
  assert.deepEqual(await transmitirFoto(carga, undefined, progreso, pedir), {idCargaFoto:carga.id});
  assert.deepEqual(intentos, [0, 1, 1, 2]);
  assert.equal([...recibidas.values()].join(''), foto);
  await transmitirFoto(carga, undefined, progreso, pedir);
  assert.equal(intentos.length, 4);
});

test('una foto pequeña viaja completa y no crea una carga temporal', async () => {
  const foto = 'x'.repeat(1000);
  const carga = prepararCargaFoto(foto);
  let pedidos = 0;
  assert.deepEqual(await transmitirFoto(carga, undefined, () => {}, async () => { pedidos += 1; }), { foto });
  assert.equal(pedidos, 0);
});
