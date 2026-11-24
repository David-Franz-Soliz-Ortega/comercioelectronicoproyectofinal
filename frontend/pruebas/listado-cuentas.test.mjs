import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('Usuarios muestra solo administradores autorizados, sin exigir una institución seleccionada', async () => {
  const vite = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false, watch: null }, appType: 'custom' });
  try {
    const { default: Listado } = await vite.ssrLoadModule('/src/componentes/ListadoCuentas.jsx');
    const cuentas = [
      { idUsuario: 'a', usuario: 'admin-prueba', activo: true, roles: [{ rol: 'ADMINISTRADOR', idOrganizacion: null }] },
      { idUsuario: 'o', usuario: 'operador-prueba', activo: true, roles: [{ rol: 'OPERADOR', idOrganizacion: 'org' }] },
      { idUsuario: 'r', usuario: 'auditor-prueba', activo: false, roles: [{ rol: 'AUDITOR', idOrganizacion: 'org' }] },
    ];
    const propiedades = { cuentas, organizaciones: [{ idOrganizacion: 'org', nombre: 'Institución sintética' }], idActual: 'a' };
    const html = renderToStaticMarkup(React.createElement(Listado, propiedades));
    for (const texto of ['admin-prueba', 'Todo el sistema', 'Cuenta actual']) assert.ok(html.includes(texto), texto);
    assert.ok(!html.includes('operador-prueba')&&!html.includes('auditor-prueba'),'Los otros roles no aparecen en Administradores');
    const mixto=renderToStaticMarkup(React.createElement(Listado,{...propiedades,cuentas:[{...cuentas[0],roles:[...cuentas[0].roles,...cuentas[1].roles]}]}));
    assert.ok(mixto.includes('admin-prueba'),'Conservar cuentas que realmente tengan rol administrativo');
    assert.ok(!html.includes('Revocar administrador'), 'No ofrecer revocación de la cuenta actual ni de roles distintos');
    assert.ok(!renderToStaticMarkup(React.createElement(Listado, { ...propiedades, cuentas: [cuentas[1]] })).includes('admin-prueba'), 'No incorporar cuentas que no devolvió la API');
    const otro=renderToStaticMarkup(React.createElement(Listado,{...propiedades,cuentas:[{idUsuario:'b',usuario:'admin-inactivo',activo:false,roles:[{rol:'ADMINISTRADOR',idOrganizacion:'org'}]}]}));
    assert.ok(otro.includes('admin-inactivo')&&otro.includes('Inactivo')&&otro.includes('Revocar administrador'),'Conservar administradores inactivos y sus acciones autorizadas');
    const fallo = renderToStaticMarkup(React.createElement(Listado, { ...propiedades, error: 'Permiso denegado' }));
    assert.ok(fallo.includes('Permiso denegado') && !fallo.includes('operador-prueba'));
    assert.match(renderToStaticMarkup(React.createElement(Listado, { ...propiedades, cargando: true })), /Cargando administradores/);
    assert.match(renderToStaticMarkup(React.createElement(Listado, { ...propiedades, cuentas: [] })), /No hay administradores disponibles/);
  } finally { await vite.close(); }
});
