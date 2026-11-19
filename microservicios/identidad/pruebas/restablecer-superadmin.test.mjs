// Exclusivamente dobles en memoria: no Docker, red, SQL real ni lectura de secretos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const carpeta = process.env.SIGAPE_COMPILACION_PRUEBA;
assert.ok(carpeta, 'Especifique la compilación temporal de identidad.');
const { parametros, diagnosticoSeguro } = await import(pathToFileURL(resolve(carpeta, 'restablecer-superadmin.js')));
const { operarRecuperacion, validarClave } = await import(pathToFileURL(resolve(carpeta, 'restablecer-superadmin-operacion.js')));
const id = '11111111-1111-4111-8111-111111111111';
const argumentos = ['--entorno', 'sigape-auth-test', '--id-usuario', id, '--evidencia', '/tmp/evidencia-privada.json'];
function doble({ activo = true, roles = 1, fallo = '' } = {}) {
  const consultas = [];
  return { consultas, async query(sql, valores) {
    consultas.push({ sql, valores });
    if (fallo && sql.includes(fallo)) throw new Error('Fallo simulado');
    if (sql.startsWith('SELECT id, activo')) return { rows: [{ id, activo }], rowCount: 1 };
    if (sql.startsWith('SELECT id FROM asignaciones_roles')) return { rows: Array.from({ length: roles }, () => ({ id: 'rol-sintetico' })), rowCount: roles };
    return { rows: [], rowCount: 1 };
  } };
}
test('no hay modo ni destino predeterminados; rechaza principal, argumentos de contraseña y confirmación ausente', () => {
  assert.throws(() => parametros([]));
  assert.throws(() => parametros(argumentos));
  assert.throws(() => parametros(['--simular', ...argumentos.map(x => x === 'sigape-auth-test' ? 'sigape' : x)]));
  assert.throws(() => parametros(['--aplicar', ...argumentos]));
  assert.throws(() => parametros(['--simular', ...argumentos, '--contrasena', 'dato-prohibido']));
  assert.throws(() => parametros(['--simular', '--aplicar', ...argumentos]));
  assert.equal(parametros(['--simular', ...argumentos]).simular, true);
  assert.equal(parametros(['--aplicar', ...argumentos, '--confirmar', 'RESTABLECER:sigape-auth-test:' + id]).simular, false);
});
test('simulación no solicita hash ni ejecuta UPDATE, INSERT o COMMIT', async () => {
  const db = doble();
  const resultado = await operarRecuperacion(db, id, true, undefined, async () => { throw new Error('No debe hashear'); });
  assert.equal(resultado.cambios, false);
  assert.match(db.consultas[0].sql, /READ ONLY/);
  assert.equal(db.consultas.at(-1).sql, 'ROLLBACK');
  assert.ok(db.consultas.every(c => !/UPDATE|INSERT|COMMIT/.test(c.sql)));
});
test('cuenta inactiva o SUPERADMIN ambiguo aborta sin escrituras', async () => {
  for (const opciones of [{ activo: false }, { roles: 0 }, { roles: 2 }]) {
    const db = doble(opciones);
    await assert.rejects(operarRecuperacion(db, id, false, 'valor-solo-para-pruebas'));
    assert.equal(db.consultas.at(-1).sql, 'ROLLBACK');
    assert.ok(db.consultas.every(c => !c.sql.startsWith('UPDATE') && !c.sql.startsWith('INSERT')));
  }
});
test('actualización dirigida al UUID, bcrypt coste 12, revocación y auditoría sin suplantar actor', async () => {
  const db = doble(); let coste;
  await operarRecuperacion(db, id, false, 'valor-solo-para-pruebas', async (_clave, valor) => { coste = valor; return 'hash-doble'; });
  assert.equal(coste, 12);
  const cambios = db.consultas.filter(c => c.sql.startsWith('UPDATE'));
  assert.equal(cambios.length, 3);
  assert.match(cambios[0].sql, /^UPDATE usuarios SET clave_hash=\$2 WHERE id=\$1/);
  for (const cambio of cambios) assert.equal(cambio.valores[0], id);
  const auditoria = db.consultas.find(c => c.sql.startsWith('INSERT'));
  assert.match(auditoria.sql, /NULL,NULL/); assert.equal(auditoria.valores[2], id);
  assert.equal(db.consultas.at(-1).sql, 'COMMIT');
  assert.ok(db.consultas.every(c => !/^UPDATE (asignaciones_roles|organizaciones)/.test(c.sql)));
});
test('fallo de auditoría provoca rollback y nunca commit', async () => {
  const db = doble({ fallo: 'INSERT INTO auditoria_seguridad' });
  await assert.rejects(operarRecuperacion(db, id, false, 'valor-solo-para-pruebas', async () => 'hash-doble'));
  assert.equal(db.consultas.at(-1).sql, 'ROLLBACK');
  assert.ok(db.consultas.every(c => c.sql !== 'COMMIT'));
});
test('validación mantiene mínimo 12 caracteres y máximo 72 bytes UTF-8', () => {
  assert.throws(() => validarClave('corta'));
  assert.throws(() => validarClave('á'.repeat(37)));
  assert.throws(() => validarClave('a'.repeat(12) + '\n'));
  assert.doesNotThrow(() => validarClave('a'.repeat(72)));
});

test('diagnóstico distingue política, confirmación y caducidad sin revelar excepciones sensibles', () => {
  assert.match(diagnosticoSeguro(new Error('Contraseña no válida.'), 'politica-contrasena'), /politica-contrasena.*Contraseña no válida/);
  assert.match(diagnosticoSeguro(new Error('Las entradas no coinciden.'), 'confirmacion-privada'), /no coinciden/);
  assert.match(diagnosticoSeguro(new Error('Evidencia ausente, caducada o ajena.'), 'aislamiento-final'), /caducada/);
  assert.doesNotMatch(diagnosticoSeguro(new Error('dato-privado-de-prueba'), 'transaccion-contenedor'), /dato-privado/);
});
