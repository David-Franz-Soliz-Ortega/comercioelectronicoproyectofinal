import test from 'node:test';
import assert from 'node:assert/strict';
import configurar from '../vite.config.js';

test('el proxy aislado reenvía autenticación y GraphQL; solo adapta el origen del Vite local', t => {
  const anterior = process.env.URL_ENTRADA_DESARROLLO;
  process.env.URL_ENTRADA_DESARROLLO = 'http://127.0.0.1:8888';
  t.after(() => anterior === undefined ? delete process.env.URL_ENTRADA_DESARROLLO : process.env.URL_ENTRADA_DESARROLLO = anterior);
  const { server } = configurar({ command: 'serve' });
  assert.equal(server.host, '127.0.0.1');
  for (const ruta of ['/api/v1', '/graphql']) {
    const proxy = server.proxy[ruta];
    assert.equal(proxy.target, 'http://127.0.0.1:8888');
    let alReenviar;
    proxy.configure({ on: (evento, funcion) => { assert.equal(evento, 'proxyReq'); alReenviar = funcion; } });
    const cabeceras = [];
    const salida = { setHeader: (...datos) => cabeceras.push(datos) };
    alReenviar(salida, { headers: { origin: 'http://127.0.0.1:5173' }, socket: { localPort: 5173 } });
    assert.deepEqual(cabeceras, [['Origin', 'http://127.0.0.1:8888']]);
    alReenviar(salida, { headers: { origin: 'http://sitio-ajeno.invalid' }, socket: { localPort: 5173 } });
    alReenviar(salida, { headers: {}, socket: { localPort: 5173 } });
    assert.equal(cabeceras.length, 1, 'No se legitiman orígenes ajenos ni se inventa Origin');
  }
});
