import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararEleccion } from '../src/api/preparacionEleccion.js';
const org = 'organizacion-sintetica-a';
const proceso = { candidatos: [{ id: 'candidato-de-prueba' }], mesas: [{ id: 'mesa-de-prueba' }], actual: false };
const operador = { activo: true, roles: [{ rol: 'OPERADOR', idOrganizacion: org }] };

test('la guía comienza por organización y no permite publicar una elección vacía', () => {
  const guia = prepararEleccion({});
  assert.equal(guia.siguiente.id, 'organizacion');
  assert.equal(guia.puedePublicar, false);
  assert.equal(prepararEleccion({ organizacion: org }).siguiente.id, 'eleccion');
});
test('los candidatos y mesas faltantes tienen prioridad antes de asignar', () => {
  assert.equal(prepararEleccion({ organizacion: org, proceso: { candidatos: [], mesas: [] } }).siguiente.id, 'candidatos');
  const guia = prepararEleccion({ organizacion: org, proceso: { candidatos: proceso.candidatos, mesas: [] } });
  assert.equal(guia.siguiente.id, 'mesas');
  assert.equal(guia.puedePublicar, false);
});
test('no ofrece operadores inactivos, de otra organización ni administradores con rol mezclado', () => {
  const cuentas = [
    { ...operador, activo: false },
    { activo: true, roles: [{ rol: 'OPERADOR', idOrganizacion: 'otra-organizacion' }] },
    { activo: true, roles: [...operador.roles, { rol: 'ADMINISTRADOR', idOrganizacion: org }] },
    { activo: true, roles: [...operador.roles, { rol: 'ADMINISTRADOR', idOrganizacion: null }] },
  ];
  const guia = prepararEleccion({ organizacion: org, proceso, cuentas });
  assert.equal(guia.operadores.length, 0);
  assert.equal(guia.siguiente.id, 'operadores');
});
test('tener mesa y operador no demuestra que exista una asignación', () => {
  const guia = prepararEleccion({ organizacion: org, proceso, cuentas: [operador] });
  assert.equal(guia.siguiente.id, 'asignaciones');
  assert.equal(guia.pasos.find(p => p.id === 'asignaciones').listo, false);
});
test('una asignación confirmada dirige a revisión sin publicar automáticamente', () => {
  const guia = prepararEleccion({ organizacion: org, proceso, cuentas: [operador], asignacionesConfirmadas: 1 });
  assert.equal(guia.siguiente.id, 'publicacion');
  assert.equal(guia.pasos.at(-1).listo, false);
  assert.equal(proceso.actual, false);
});
test('una elección ya visible no inventa sus asignaciones históricas', () => {
  const guia = prepararEleccion({ organizacion: org, proceso: { ...proceso, actual: true }, cuentas: [operador] });
  assert.equal(guia.pasos.at(-1).listo, true);
  assert.equal(guia.pasos.find(p => p.id === 'asignaciones').listo, false);
  assert.equal(guia.siguiente.id, 'publicacion');
});
