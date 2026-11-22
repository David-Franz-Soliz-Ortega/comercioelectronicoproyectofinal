import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararEleccion } from '../src/api/preparacionEleccion.js';
const org = 'organizacion-sintetica-a';
const proceso = { candidatos: [{ id: 'candidato-de-prueba' }], mesas: [{ id: 'mesa-de-prueba' }], actual: false };
const operador = { activo: true, roles: [{ rol: 'OPERADOR', idOrganizacion: org }] };

test('no permite publicar sin organización ni una elección con candidatos y mesas', () => {
  const preparacion = prepararEleccion({});
  assert.equal(preparacion.puedePublicar, false);
  assert.equal(prepararEleccion({ organizacion: org }).puedePublicar, false);
  assert.equal(prepararEleccion({ proceso }).puedePublicar, false);
});
test('no permite publicar si faltan candidatos o mesas', () => {
  assert.equal(prepararEleccion({ organizacion: org, proceso: { candidatos: [], mesas: proceso.mesas } }).puedePublicar, false);
  const preparacion = prepararEleccion({ organizacion: org, proceso: { candidatos: proceso.candidatos, mesas: [] } });
  assert.equal(preparacion.puedePublicar, false);
});
test('no ofrece operadores inactivos, de otra organización ni administradores con rol mezclado', () => {
  const cuentas = [
    { ...operador, activo: false },
    { activo: true, roles: [{ rol: 'OPERADOR', idOrganizacion: 'otra-organizacion' }] },
    { activo: true, roles: [...operador.roles, { rol: 'ADMINISTRADOR', idOrganizacion: org }] },
    { activo: true, roles: [...operador.roles, { rol: 'ADMINISTRADOR', idOrganizacion: null }] },
  ];
  const preparacion = prepararEleccion({ organizacion: org, proceso, cuentas });
  assert.equal(preparacion.operadores.length, 0);
});
test('comprobar preparación no publica ni modifica la elección', () => {
  const copia = structuredClone(proceso);
  assert.equal(prepararEleccion({ organizacion: org, proceso, cuentas: [operador] }).puedePublicar, true);
  assert.deepEqual(proceso, copia);
});
