import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
assert.ok(process.env.TUVOTO_COMPILACION_IDENTIDAD);
const { rutasSeguridad, permisos } = await import(pathToFileURL(resolve(process.env.TUVOTO_COMPILACION_IDENTIDAD,'seguridad.js')));
test('acciones de configuración, actas e informes; no hay voto individual',()=>{
 assert.deepEqual(Object.keys(permisos).sort(),['actas:consultar','actas:registrar','informes:administrar','informes:consultar','proceso:configurar']);assert.deepEqual(permisos['actas:registrar'],['OPERADOR']);
});
test('PDP aplica rol, alcance y separación administrativa; no usa bases reales',async t=>{
 const anterior=process.env.CLAVE_INTERNA_ACTAS;process.env.CLAVE_INTERNA_ACTAS='a'.repeat(32);t.after(()=>anterior===undefined?delete process.env.CLAVE_INTERNA_ACTAS:process.env.CLAVE_INTERNA_ACTAS=anterior);
 const org='11111111-1111-4111-8111-111111111111',otra='22222222-2222-4222-8222-222222222222',token='c'.repeat(43);
 for(const [roles,estado,accion='actas:registrar'] of [[[{rol:'OPERADOR',idOrganizacion:org}],200],[[{rol:'ADMINISTRADOR',idOrganizacion:org}],403],[[{rol:'ADMINISTRADOR',idOrganizacion:null}],403],[[{rol:'OPERADOR',idOrganizacion:otra}],403],[[{rol:'OPERADOR',idOrganizacion:org},{rol:'ADMINISTRADOR',idOrganizacion:org}],403],
 [[{rol:'ADMINISTRADOR',idOrganizacion:org}],200,'proceso:configurar'],
 [[{rol:'ADMINISTRADOR',idOrganizacion:null}],200,'proceso:configurar'],
 [[{rol:'ADMINISTRADOR',idOrganizacion:otra}],403,'proceso:configurar'],
 [[{rol:'OPERADOR',idOrganizacion:org}],403,'proceso:configurar'],
 [[{rol:'AUDITOR',idOrganizacion:org}],403,'proceso:configurar'],
 [[{rol:'AUDITOR',idOrganizacion:org}],200,'actas:consultar'],
 [[{rol:'SUPERADMIN',idOrganizacion:null}],403,'proceso:configurar'],
 [[{rol:'ADMIN_ELECTORAL',idOrganizacion:org}],403,'proceso:configurar']]){
  let handler;const app={use(){},get(){},put(){},delete(){},post(path,fn){if(path==='/interno/autorizar')handler=fn}};
  rutasSeguridad(app,{async query(sql){if(sql.includes('FROM sesiones s JOIN usuarios'))return{rowCount:1,rows:[{id:org,csrf_hash:createHash('sha256').update(token).digest('hex')}]};if(sql.includes('FROM asignaciones_roles'))return{rows:roles};if(sql.includes('FROM organizaciones'))return{rowCount:1,rows:[{}]};throw Error('Consulta no esperada');}});
  const headers={'x-servicio':'actas','x-clave-servicio':'a'.repeat(32),'x-csrf-token':token,origin:'http://127.0.0.1:8080'};
  const req={headers:{cookie:`tuvoto-sesion=${'s'.repeat(43)}; tuvoto-csrf=${token}`},header:k=>headers[k.toLowerCase()],body:{accion,idOrganizacion:org,escritura:true}};
  let codigo=200;const res={status(c){codigo=c;return this},type(){return this},json(){return this}};await handler(req,res);assert.equal(codigo,estado);
 }
});
