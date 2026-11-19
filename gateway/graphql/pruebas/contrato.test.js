import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSchema, graphql } from 'graphql';
const schema = buildSchema(readFileSync(process.env.CONTRATO_GRAPHQL ?? new URL('../../../compartido/contratos/graphql/tuvoto.graphql', import.meta.url), 'utf8'));
test('portal vacío se representa como null, sin inventar una elección', async () => {
 const r = await graphql({ schema, source: '{ portal { proceso { nombre } } }', rootValue: { portal: () => null } });
 assert.equal(r.errors, undefined); assert.equal(r.data.portal, null);
});
test('el contrato nuevo no permite emitir votos individuales ni consultar el antiguo padrón', async () => {
 for (const source of ['mutation { crearVoto }', '{ inscripciones { total } }']) assert.ok((await graphql({ schema, source })).errors?.length);
});

test('visitas concurrentes comparten carga pública y errores no quedan cacheados', async () => {
 const { crearCachePublica } = await import('../src/cache-publica.js');
 let ahora=0, llamadas=0;const cache=crearCachePublica(3000,()=>ahora);
 const cargar=async()=>{llamadas++;return{total:4};};
 const respuestas=await Promise.all(Array.from({length:50},()=>cache(cargar)));
 assert.equal(llamadas,1);assert.ok(respuestas.every(r=>r.total===4));
 await cache(cargar);assert.equal(llamadas,1);ahora=3001;
 await assert.rejects(cache(async()=>{throw Error('sin API');}));
 await cache(cargar);assert.equal(llamadas,2);
});

test('la caché pública no mezcla resultados de distintas unidades', async () => {
 const { crearCachePublicaPorClave } = await import('../src/cache-publica.js');const cache=crearCachePublicaPorClave(2);
 assert.equal(await cache('Facultad A',()=>3),3);assert.equal(await cache('Facultad B',()=>7),7);
 assert.equal(await cache('Facultad A',()=>99),3);
});
