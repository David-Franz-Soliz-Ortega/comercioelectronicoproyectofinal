import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const dist = process.env.TUVOTO_COMPILACION_IDENTIDAD ?? resolve('dist');
const { firmarJwt, verificarJwt, roles, permisos } = await import(pathToFileURL(resolve(dist, 'seguridad.js')));

test('Seguridad P3: los 3 roles requeridos existen en identidad', () => {
  assert.deepEqual([...roles].sort(), ['ADMINISTRADOR', 'AUDITOR', 'OPERADOR']);
});

test('Seguridad P3: permisos asignados correctamente por rol', () => {
  assert.deepEqual(permisos['proceso:configurar'], ['ADMINISTRADOR']);
  assert.deepEqual(permisos['actas:registrar'], ['OPERADOR']);
  assert.deepEqual(permisos['actas:consultar'], ['OPERADOR', 'AUDITOR']);
  assert.deepEqual(permisos['informes:administrar'], ['ADMINISTRADOR']);
  assert.deepEqual(permisos['informes:consultar'], ['ADMINISTRADOR', 'AUDITOR']);
});

test('Seguridad P3: JWT emite token válido con estructura RFC 7519 y expiración', () => {
  const token = firmarJwt({ sub: '11111111-1111-4111-8111-111111111111', usuario: 'admin', rol: 'ADMINISTRADOR' }, 3600);
  assert.ok(typeof token === 'string');
  assert.equal(token.split('.').length, 3);

  const decodificado = verificarJwt(token);
  assert.ok(decodificado);
  assert.equal(decodificado.sub, '11111111-1111-4111-8111-111111111111');
  assert.equal(decodificado.usuario, 'admin');
  assert.equal(decodificado.rol, 'ADMINISTRADOR');
  assert.ok(decodificado.exp > Math.floor(Date.now() / 1000));
});

test('Seguridad P3: JWT rechaza tokens manipulados o expirados (401)', () => {
  const token = firmarJwt({ sub: 'user-1', usuario: 'operador' }, 3600);
  const partes = token.split('.');
  const manipulado = `${partes[0]}.${partes[1]}.firma_invalida`;
  assert.equal(verificarJwt(manipulado), null);

  const expirado = firmarJwt({ sub: 'user-2', usuario: 'expirado' }, -10);
  assert.equal(verificarJwt(expirado), null);
});
