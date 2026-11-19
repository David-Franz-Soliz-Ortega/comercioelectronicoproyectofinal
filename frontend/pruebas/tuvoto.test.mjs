import test from 'node:test';
import assert from 'node:assert/strict';
import { solicitarRest } from '../src/api/clienteRest.js';
import { consultarGraphql } from '../src/api/clienteGraphql.js';
import { iniciarSesion, finalizarSesion } from '../src/api/clienteSesion.js';

test('el portal sin elección conserva null: no inventa datos',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({data:{portal:null}}));
 assert.equal((await consultarGraphql('{ portal { proceso { nombre } } }')).datos.portal,null);
});
test('actas envía la misma solicitud en un reintento, por REST del mismo origen',async t=>{
 const llamadas=[];t.mock.method(globalThis,'fetch',async(url,op)=>{llamadas.push([url,op]);return Response.json({id:'solo-prueba',estado:'publicada',version:1});});
 const datos={idSolicitud:'identificador-estable-de-prueba',versionAnterior:0};
 await solicitarRest('/actas',{metodo:'POST',datos});await solicitarRest('/actas',{metodo:'POST',datos});
 assert.equal(llamadas[0][0],'/api/v1/actas');assert.equal(llamadas[0][1].credentials,'same-origin');assert.equal(llamadas[0][1].body,llamadas[1][1].body);
 await assert.rejects(solicitarRest('/votos'),/no permitido/);await assert.rejects(solicitarRest('/inscripciones'),/no permitido/);
});
test('401/403 no se convierten en resultados publicados',async t=>{
 const f=t.mock.method(globalThis,'fetch',async()=>new Response(null,{status:401}));
 await assert.rejects(solicitarRest('/actas'),e=>e.estado===401);
 f.mock.mockImplementation(async()=>new Response(null,{status:403}));await assert.rejects(solicitarRest('/actas',{metodo:'POST',datos:{}}),e=>e.estado===403);
});
test('conserva login con CSRF, consulta de sesión y logout',async t=>{
 const rutas=[];t.mock.method(globalThis,'fetch',async(url)=>{rutas.push(url);return url.endsWith('/logout')?new Response(null,{status:204}):Response.json({idUsuario:'solo-prueba',roles:[]});});
 await iniciarSesion('solo-prueba','valor-ficticio-no-credencial');await finalizarSesion();
 assert.deepEqual(rutas.map(r=>r.split('/').at(-1)),['csrf','login','yo','logout']);
});
