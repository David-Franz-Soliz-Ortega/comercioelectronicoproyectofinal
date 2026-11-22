import test from 'node:test';
import assert from 'node:assert/strict';
import {completarNombreEleccion,agruparCargos,tiposCargoUniversitarios} from '../src/api/seleccionAdministracion.js';
test('el selector reutiliza los tipos universitarios guardados sin repetirlos ni traer cargos de otros tipos de organización',()=>{
 const procesos=[{tipo:'universidad',cargo:'Centro de Estudiantes sintético'},{tipo:'universidad',cargo:' CENTRO DE ESTUDIANTES SINTÉTICO '},{tipo:'universidad',cargo:'Rector'},{tipo:'municipio',cargo:'Alcalde'}];
 const copia=structuredClone(procesos),tipos=tiposCargoUniversitarios(procesos,'Cargo histórico');
 assert.deepEqual(tipos,['Rector','Vicerrector','Decano','Director','Centro de Estudiantes sintético','Cargo histórico']);
 assert.deepEqual(procesos,copia);
});
test('editar un cargo conserva su valor exacto aunque otro registro use las mismas palabras en mayúsculas',()=>{
 const actual='Centro de Estudiantes sintético';
 const tipos=tiposCargoUniversitarios([{tipo:'universidad',cargo:actual.toLocaleUpperCase('es')}],actual);
 assert.equal(tipos.filter(t=>t.toLocaleLowerCase('es')===actual.toLocaleLowerCase('es')).length,1);
 assert.ok(tipos.includes(actual));
 assert.ok(tiposCargoUniversitarios([],'RECTOR').includes('RECTOR'));
});

test('agrupa cargos y cuenta los registros reales sin mezclar Rector con Vicerrector o Director',()=>{
 const lista=[{id:'d1',cargo:'Director',ambito:'Grupo A'},{id:'dec1',cargo:'Decano',ambito:'Medicina'},{id:'v',cargo:'Vicerrector'},{id:'d2',cargo:'Director',ambito:'Grupo B'},{id:'r',cargo:'Rector'},{id:'dec2',cargo:'Decano',ambito:'Tecnología',estado:'archivada'}];
 const copia=structuredClone(lista),g=agruparCargos(lista);
 assert.deepEqual(g.map(g=>[g.nombre,g.cantidad]),[['Rectorado',1],['Vicerrectorado',1],['Decanos',2],['Directores',2]]);
 assert.deepEqual(g.find(g=>g.id==='directores').procesos.map(p=>p.id),['d1','d2']);
 assert.equal(g.find(g=>g.id==='decanos').procesos[1].estado,'archivada');
 assert.deepEqual(lista,copia);assert.equal(g.reduce((n,g)=>n+g.cantidad,0),lista.length);
});
test('reconoce variantes de cargo y mantiene los cargos ajenos a las cuatro familias en sus propios grupos',()=>{
 const g=agruparCargos([{cargo:' VICERRECTORA '},{cargo:'Vice-rector'},{cargo:'Decanos'},{cargo:'DECANATO'},{cargo:'Dirección'},{cargo:'Directora'},{cargo:'Alcalde'},{cargo:'ALCALDE'},{cargo:'Concejal'},{cargo:'Rector y Vicerrector'}]);
 assert.equal(g.find(g=>g.id==='vicerrectorado').cantidad,2);
 assert.equal(g.find(g=>g.id==='decanos').cantidad,2);assert.equal(g.find(g=>g.id==='directores').cantidad,2);
 assert.equal(g.find(g=>g.id==='otro:alcalde').cantidad,2);assert.equal(g.find(g=>g.id==='otro:concejal').cantidad,1);
 assert.equal(g.find(g=>g.id==='otro:rector y vicerrector').cantidad,1);
 assert.deepEqual(agruparCargos([]),[]);
});
test('crear sin nombre manual usa la institución respetando el límite REST',()=>{
 const datos={nombre:'',cargo:'Rector',tipo:'universidad'};
 assert.deepEqual(completarNombreEleccion(datos,{nombre:'  USFX  '}),{...datos,nombre:'USFX'});
 assert.equal(datos.nombre,'');
 assert.equal(completarNombreEleccion(datos,{nombre:'A'.repeat(160)}).nombre.length,120);
 assert.throws(()=>completarNombreEleccion(datos,null),/Selecciona una institución/);
});
test('editar o añadir cargos preserva la agrupación histórica aunque cambie la institución',()=>{
 const datos={nombre:'Elecciones universitarias 2026',cargo:'Vicerrector',vuelta:1};
 assert.deepEqual(completarNombreEleccion(datos,{nombre:'USFX actualizada'}),datos);
});

test('filtros de cargos conservan IDs, buscan sin tildes y permiten recuperar archivados',async()=>{
 const {filtrarCargos}=await import('../src/api/seleccionAdministracion.js');
 const lista=[{id:'d',cargo:'Director',facultad:'Tecnología',estado:'borrador',carreras:['Diseño']},{id:'r',cargo:'Rector',estado:'recepcion'},{id:'a',cargo:'Decano',estado:'archivada'}];
 const copia=structuredClone(lista);
 assert.deepEqual(filtrarCargos(lista).map(p=>p.id),['d','r']);
 assert.deepEqual(filtrarCargos(lista,{busqueda:'tecnologia'}).map(p=>p.id),['d']);
 assert.deepEqual(filtrarCargos(lista,{busqueda:'diseno'}).map(p=>p.id),['d']);
 assert.deepEqual(filtrarCargos(lista,{estado:'recepcion'}).map(p=>p.id),['r']);
 assert.deepEqual(filtrarCargos(lista,{estado:'archivada',archivados:true}).map(p=>p.id),['a']);
 assert.deepEqual(lista,copia);
});

test('alta y edición comparten valores iniciales sin mutar otros cargos ni cambiar su vuelta',async()=>{
 const {datosEleccionVacia,datosDeProceso}=await import('../src/api/seleccionAdministracion.js');
 const uno=datosEleccionVacia(),dos=datosEleccionVacia();
 uno.carreras.push('Carrera sintética');assert.deepEqual(dos.carreras,[]);
 const proceso={...dos,cargo:'Director',vuelta:2,sectores:[{nombre:'Prueba',pesoBps:10000}],id:'se-conserva-en-formulario'};
 const edicion=datosDeProceso(proceso);edicion.sectores[0].pesoBps=5000;
 assert.equal(proceso.sectores[0].pesoBps,10000);assert.equal(edicion.vuelta,2);
 assert.equal(edicion.id,undefined);
});
