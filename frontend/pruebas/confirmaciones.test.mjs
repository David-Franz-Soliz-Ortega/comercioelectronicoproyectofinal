import test from 'node:test';
import assert from 'node:assert/strict';
import { notificarExito } from '../src/api/confirmaciones.js';

test('la confirmación sobrevive al cierre del formulario, evita duplicados y admite repetir una operación', async t => {
 const anterior = globalThis.window;
 const destino = new EventTarget();
 globalThis.window = destino;
 t.after(() => { if (anterior === undefined) delete globalThis.window; else globalThis.window = anterior; });
 const mensajes = [];
 destino.addEventListener('tuvoto:operacion-confirmada', e => mensajes.push(e.detail));
 notificarExito('');
 await Promise.resolve();
 assert.deepEqual(mensajes, []);
 notificarExito('3 registros importados.');
 notificarExito('Importación terminada.');
 notificarExito(''); // Un formulario desmontado o reiniciado no descarta el aviso global.
 await Promise.resolve();
 assert.deepEqual(mensajes, ['3 registros importados.']);
 notificarExito('3 registros importados.');
 await Promise.resolve();
 assert.equal(mensajes.length, 2);
});
