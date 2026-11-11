import test from 'node:test';
import assert from 'node:assert/strict';
import { consultarGraphql } from '../src/api/clienteGraphql.js';
import { resolverSeccion } from '../src/navegacion/secciones.js';

test('el cliente mantiene el origen relativo, las variables y los datos parciales', async t => {
  t.mock.method(globalThis, 'fetch', async (url, opciones) => {
    assert.equal(url, '/graphql'); assert.equal(opciones.method, 'POST');
    assert.deepEqual(JSON.parse(opciones.body).variables, { pagina: 2 });
    return Response.json({ data: { elecciones: { total: 1 } }, errors: [{ message: 'Referencia no disponible' }] });
  });
  const resultado = await consultarGraphql('query Prueba { elecciones { total } }', { pagina: 2 });
  assert.equal(resultado.datos.elecciones.total, 1); assert.match(resultado.advertencia, /referencias/);
});
test('los errores HTTP y las respuestas inválidas no se convierten en datos operativos', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  await assert.rejects(consultarGraphql('query { elecciones { total } }'), /No se pudo completar/);
  fetch.mock.mockImplementation(async () => new Response('<html>Sin API</html>'));
  await assert.rejects(consultarGraphql('query { elecciones { total } }'), /no es válida/);
});
test('la pérdida de red y el timeout ofrecen errores accionables', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('red'); });
  await assert.rejects(consultarGraphql('query { elecciones { total } }'), /Revisa tu conexión/);
  fetch.mock.mockImplementation(async () => { throw new DOMException('plazo', 'TimeoutError'); });
  await assert.rejects(consultarGraphql('query { elecciones { total } }'), /tardó demasiado/);
});
test('los errores GraphQL de validación y límite conservan su explicación', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ errors: [{ extensions: { code: 'ENTRADA_INVALIDA' } }] }));
  await assert.rejects(consultarGraphql('query { elecciones { total } }'), /Revisa los datos/);
  fetch.mock.mockImplementation(async () => Response.json({ errors: [{ extensions: { code: 'LIMITE_DE_CARGA' } }] }));
  await assert.rejects(consultarGraphql('query { elecciones { total } }'), /Aplica un filtro/);
});
test('los enlaces desconocidos resuelven a Inicio y las rutas anteriores siguen disponibles', () => {
  assert.equal(resolverSeccion('#elecciones'), 'elecciones');
  assert.equal(resolverSeccion('#__proto__'), 'inicio');
  assert.equal(resolverSeccion('#ruta-desconocida'), 'inicio');
  assert.equal(resolverSeccion(''), 'inicio');
});
