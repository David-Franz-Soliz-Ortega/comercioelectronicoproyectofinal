import test from 'node:test';
import assert from 'node:assert/strict';
import { asignarMesasOperador, mesasAsignables } from '../src/api/operadores.js';

test('asignación opcional no realiza escrituras cuando no se eligen mesas',async()=>{
 let llamadas=0;
 await asignarMesasOperador({pedir:async()=>llamadas++,organizacion:'org',idUsuario:'persona',mesas:[],completadas:new Set()});
 assert.equal(llamadas,0);
});
test('un fallo parcial conserva avances y el reintento solo envía las mesas pendientes',async()=>{
 const completadas=new Set(),solicitudes=[];let fallar=true;
 const pedir=async(ruta,op)=>{solicitudes.push({ruta,op});if(ruta.includes('/b/')&&fallar){fallar=false;throw Error('Fallo sintético');}};
 const datos={pedir,organizacion:'org',idUsuario:'persona',mesas:['a','b','c'],completadas};
 await assert.rejects(asignarMesasOperador(datos),/Fallo sintético/);
 assert.deepEqual([...completadas],['a']);
 await asignarMesasOperador(datos);
 assert.deepEqual([...completadas],['a','b','c']);
 assert.deepEqual(solicitudes.map(s=>s.ruta),['/configuracion/mesas/a/asignar','/configuracion/mesas/b/asignar','/configuracion/mesas/b/asignar','/configuracion/mesas/c/asignar']);
 for(const {op} of solicitudes)assert.deepEqual(op,{metodo:'POST',organizacion:'org',datos:{idUsuario:'persona'}});
});
test('el selector no ofrece mesas de cargos iniciados, publicados o archivados',()=>{
 const base={id:'p',cargo:'Cargo',mesas:[{id:'m',codigo:'001'}]};
 const procesos=[{...base,estado:'borrador'},...['recepcion','cerrada','archivada'].map(estado=>({...base,estado})),{...base,estado:'borrador',actual:true},{...base,estado:'borrador',publicado:true}];
 assert.equal(mesasAsignables(procesos).length,1);
});

const {resolverMesaOperador,completarImportacionOperadores}=await import('../src/api/operadores.js');
const catalogo=[{id:'p1',estado:'borrador',mesas:[{id:'m1',codigo:'A01',idMesaFisica:'fisica'}]},{id:'p2',estado:'borrador',mesas:[{id:'m2',codigo:'A01',idMesaFisica:'fisica'}]}];
test('el código de mesa compartida asigna todos sus cargos; una mesa inexistente o vacía queda pendiente',()=>{
 assert.deepEqual(resolverMesaOperador(' A01 ',catalogo),{ids:['m1','m2'],aviso:''});
 assert.deepEqual(resolverMesaOperador('',catalogo),{ids:[],aviso:'Sin mesa'});
 assert.deepEqual(resolverMesaOperador('NO-EXISTE',catalogo),{ids:[],aviso:'Mesa no encontrada: NO-EXISTE'});
});
test('no se deducen vínculos por códigos repetidos ni se asignan cargos bloqueados',()=>{
 const ambiguo=[...catalogo,{id:'otro',estado:'borrador',mesas:[{id:'otra',codigo:'A01'}]}];
 assert.equal(resolverMesaOperador('A01',ambiguo).aviso,'Código ambiguo: A01');
 for(const cambio of [{estado:'recepcion'},{publicado:true},{actual:true}])assert.deepEqual(resolverMesaOperador('A01',[catalogo[0],{...catalogo[1],...cambio}]),{ids:[],aviso:'Mesa bloqueada: A01'});
});
test('la importación no crea cuentas otra vez y muestra los pendientes sin inventar asignaciones',async()=>{
 const llamadas=[];
 const resultados=await completarImportacionOperadores({operadores:[{idUsuario:'u1',usuario:'uno',mesa:'A01'},{idUsuario:'u2',usuario:'dos',mesa:'NO'},{idUsuario:'u3',usuario:'tres',mesa:''}],procesos:catalogo,organizacion:'org',pedir:async(r,op)=>llamadas.push({r,op})});
 assert.equal(llamadas.length,2);assert.ok(llamadas.every(l=>l.op.datos.idUsuario==='u1'&&l.op.organizacion==='org'));
 assert.deepEqual(resultados.map(r=>r.asignadas),[2,0,0]);assert.equal(resultados[0].estado,'Asignado');assert.match(resultados[1].estado,/Mesa no encontrada/);assert.match(resultados[2].estado,/Sin mesa/);
});
test('los fallos parciales no deshacen cuentas creadas ni se presentan como asignaciones completas',async()=>{
 const resultados=await completarImportacionOperadores({operadores:[{idUsuario:'u',usuario:'uno',mesa:'A01'}],procesos:catalogo,organizacion:'org',pedir:async(r)=>{if(r.includes('/m2/'))throw Error('Fallo sintético');}});
 assert.equal(resultados[0].asignadas,1);assert.match(resultados[0].estado,/Parcial/);
});

test('el listado institucional conserva pendientes, varias mesas y cuentas históricas sin incluir roles de otro ámbito',async()=>{
 const {listarOperadoresInstitucion}=await import('../src/api/operadores.js');
 const cuenta=(id,org='org')=>({idUsuario:id,usuario:id,activo:true,roles:[{rol:'OPERADOR',idOrganizacion:org}]});
 const cuentas=[cuenta('operador10'),cuenta('operador2'),cuenta('pendiente'),cuenta('ajeno','otra')];
 const asignaciones=[{idUsuario:'operador2',idMesa:'r',codigo:'DOC-01',cargo:'Rector',unidad:'Tecnología'},{idUsuario:'operador2',idMesa:'v',codigo:'DOC-01',cargo:'Vicerrector',unidad:'Tecnología'},{idUsuario:'historico',idMesa:'h',codigo:'H-01'}];
 const copia=structuredClone({cuentas,asignaciones});
 const listar=op=>listarOperadoresInstitucion({cuentas,asignaciones,organizacion:'org',...op});
 assert.equal(listar().some(g=>g.cuenta.idUsuario==='ajeno'),false);
 assert.deepEqual(listar({soloPendientes:true}).map(g=>g.cuenta.idUsuario),['operador10','pendiente']);
 assert.equal(listar({busqueda:'tecnologia'})[0].mesas.length,2);
 assert.equal(listar({idUsuario:'operador2'})[0].cuenta.usuario,'operador2');
 assert.equal(listar().find(g=>g.cuenta.idUsuario==='historico').cuenta.activo,false);
 assert.equal(listar({busqueda:'inexistente'}).length,0);
 assert.deepEqual({cuentas,asignaciones},copia);
});

test('distribuye solo mesas sin operador entre operadores activos con menos carga',async()=>{
 const { distribuirMesasPendientes } = await import('../src/api/operadores.js');
 const procesos=[{id:'p',estado:'borrador',cargo:'Rector',mesas:[{id:'m1'},{id:'m2'},{id:'m3'},{id:'m4'}]}];
 const cuentas=[
  {idUsuario:'a',usuario:'a',activo:true,roles:[{rol:'OPERADOR',idOrganizacion:'org'}]},
  {idUsuario:'b',usuario:'b',activo:true,roles:[{rol:'OPERADOR',idOrganizacion:'org'}]},
  {idUsuario:'x',usuario:'x',activo:false,roles:[{rol:'OPERADOR',idOrganizacion:'org'}]},
 ];
 const asignaciones=[{idUsuario:'a',idMesa:'m1',idMesaFisica:'f1'}];
 const grupos=distribuirMesasPendientes({cuentas,asignaciones,procesos,organizacion:'org'});
 assert.deepEqual(grupos,[{idUsuario:'b',mesas:['m2','m4']},{idUsuario:'a',mesas:['m3']}]);
 const copia=structuredClone({procesos,cuentas,asignaciones});
 distribuirMesasPendientes({cuentas,asignaciones,procesos,organizacion:'org'});
 assert.deepEqual({procesos,cuentas,asignaciones},copia,'No modifica datos: solo propone');
 assert.deepEqual(distribuirMesasPendientes({cuentas:[],asignaciones:[],procesos,organizacion:'org'}),[]);
});

test('una mesa física con varias actas se asigna completa al mismo operador',async()=>{
 const { distribuirMesasPendientes } = await import('../src/api/operadores.js');
 const procesos=[{id:'p',estado:'borrador',cargo:'Rector',mesas:[{id:'a1',idMesaFisica:'f1'},{id:'a2',idMesaFisica:'f1'},{id:'b1',idMesaFisica:'f2'}]}];
 const cuentas=[{idUsuario:'a',usuario:'a',activo:true,roles:[{rol:'OPERADOR',idOrganizacion:'org'}]},{idUsuario:'b',usuario:'b',activo:true,roles:[{rol:'OPERADOR',idOrganizacion:'org'}]}];
 const grupos=distribuirMesasPendientes({cuentas,asignaciones:[],procesos,organizacion:'org'});
 assert.deepEqual(grupos,[{idUsuario:'a',mesas:['a1','a2']},{idUsuario:'b',mesas:['b1']}]);
});
