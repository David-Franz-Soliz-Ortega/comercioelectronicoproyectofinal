import test from 'node:test';
import assert from 'node:assert/strict';
import {eventosDeProcesos,procesoInicialDeEvento,completarNombreEleccion,agruparCargos,tiposCargoUniversitarios} from '../src/api/seleccionAdministracion.js';
const procesos=[{id:'rector',nombre:'Universitarias 2027',cargo:'Rector',estado:'cerrada',actual:true},{id:'vice',nombre:'Universitarias 2027',cargo:'Vicerrector',estado:'borrador'},{id:'alcalde',nombre:'Municipales 2028',cargo:'Alcalde',estado:'recepcion'}];
test('institución cargada: agrupa cargos por nombre exacto de evento sin mezclarlos',()=>{
 const eventos=eventosDeProcesos(procesos);assert.equal(eventos.length,2);assert.deepEqual(eventos[0].procesos.map(p=>p.id),['rector','vice']);assert.deepEqual(eventos[1].procesos.map(p=>p.id),['alcalde']);assert.equal(procesos[0].estado,'cerrada');
});

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
test('cambiar evento selecciona un cargo suyo y no reutiliza el ID de otro evento',()=>{
 assert.equal(procesoInicialDeEvento(procesos,'Municipales 2028'),'alcalde');assert.equal(procesoInicialDeEvento([...procesos].reverse(),'Universitarias 2027'),'rector');assert.equal(procesoInicialDeEvento(procesos,'Desconocido'),'');assert.deepEqual(eventosDeProcesos([]),[]);
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
