import test from 'node:test';
import assert from 'node:assert/strict';
import { consultarFotografiaCandidato } from '../src/api/fotografiasCandidatos.js';

const candidato = '11111111-1111-4111-8111-111111111111';
const organizacion = '22222222-2222-4222-8222-222222222222';
test('las fotos privadas usan cookie del mismo origen y organización explícita, sin almacenarse en caché', async t => {
  let solicitud;
  t.mock.method(globalThis, 'fetch', async (ruta, opciones) => {
    solicitud = { ruta, opciones };
    return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'Content-Type': 'image/png' } });
  });
  const r = await consultarFotografiaCandidato(candidato, organizacion);
  assert.equal(r.size, 4); assert.equal(r.type, 'image/png');
  assert.equal(solicitud.ruta, `/api/v1/configuracion/candidatos/${candidato}/foto`);
  assert.equal(solicitud.opciones.headers['X-Organizacion'], organizacion);
  assert.equal(solicitud.opciones.credentials, 'same-origin');
  assert.equal(solicitud.opciones.cache, 'no-store');
});
test('no consulta fotos si falta el contexto válido de candidato u organización', async t => {
  let solicitudes = 0; t.mock.method(globalThis, 'fetch', async () => { solicitudes++; });
  for (const [id, org] of [[candidato, ''], ['../otro', organizacion], [candidato, 'otra-organizacion']]) await assert.rejects(consultarFotografiaCandidato(id, org), /institución y un candidato válidos/);
  assert.equal(solicitudes, 0);
});
test('los errores de autorización conservan 401/403; una foto ausente no se interpreta como imagen', async t => {
  for (const estado of [401, 403, 404, 500]) {
    t.mock.method(globalThis, 'fetch', async () => new Response('No disponible', { status: estado }));
    await assert.rejects(consultarFotografiaCandidato(candidato, organizacion), e => e.estado === estado);
  }
});
test('solo se aceptan respuestas JPEG/PNG con contenido y tamaño permitidos', async t => {
  for (const [contenido, tipo] of [['<html>Error</html>', 'text/html'], ['<svg/>', 'image/svg+xml'], ['', 'image/png'], [new Uint8Array(2000001), 'image/jpeg']]) {
    t.mock.method(globalThis, 'fetch', async () => new Response(contenido, { headers: { 'Content-Type': tipo } }));
    await assert.rejects(consultarFotografiaCandidato(candidato, organizacion));
  }
});
