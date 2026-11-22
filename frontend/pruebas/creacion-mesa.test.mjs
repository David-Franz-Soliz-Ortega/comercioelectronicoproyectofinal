import test from 'node:test';
import assert from 'node:assert/strict';
import { opcionesCreacionMesa } from '../src/api/creacionMesa.js';

const base = {estado:'borrador',sectores:[],carreras:[]};
test('un solo formulario admite uno o varios cargos sin fijar un tipo de elección',()=>{
 const procesos=[{...base,id:'a',cargo:'Alcalde'},{...base,id:'c',cargo:'Concejal'}];
 assert.equal(opcionesCreacionMesa(procesos,['a']).seleccionados.length,1);
 const opciones=opcionesCreacionMesa(procesos,['a','c']);
 assert.equal(opciones.seleccionados.length,2);assert.equal(opciones.unidades,null);
 assert.deepEqual(opciones.sectores,[{codigo:'general',nombre:'General'}]);
});
test('las carreras y grupos compatibles se calculan entre los cargos elegidos',()=>{
 const procesos=[{...base,id:'r',cargo:'Rector'},{...base,id:'d',cargo:'Director',facultad:'Tecnología',grupoCarreras:'Grupo A',carreras:['Sistemas','Diseño']},{...base,id:'b',cargo:'Director',facultad:'Tecnología',grupoCarreras:'Grupo B',carreras:['Química']}];
 const copia=structuredClone(procesos);
 assert.deepEqual(opcionesCreacionMesa(procesos,['r','d']).unidades,['Tecnología · Grupo A','Sistemas','Diseño']);
 assert.deepEqual(opcionesCreacionMesa(procesos,['d','b']).unidades,[]);
 assert.deepEqual(procesos,copia);
});
test('solo ofrece sectores comunes y no impone sectores de cargos ajenos a la selección',()=>{
 const docentes={codigo:'docentes',nombre:'Docentes'},estudiantes={codigo:'estudiantes',nombre:'Estudiantes'};
 const procesos=[{...base,id:'r',sectores:[docentes,estudiantes]},{...base,id:'v',sectores:[estudiantes]},{...base,id:'d',sectores:[docentes]},{...base,id:'a',cargo:'Alcalde'}];
 assert.deepEqual(opcionesCreacionMesa(procesos,['r','v']).sectores,[estudiantes]);
 assert.deepEqual(opcionesCreacionMesa(procesos,['v','d']).sectores,[]);
 assert.deepEqual(opcionesCreacionMesa(procesos,['a']).sectores,[{codigo:'general',nombre:'General'}]);
});
test('un cargo iniciado, publicado o retirado de borradores no se agrega silenciosamente',()=>{
 const procesos=[{...base,id:'r'},{...base,id:'v',estado:'recepcion'},{...base,id:'p',publicado:true},{...base,id:'a',actual:true}];
 const opciones=opcionesCreacionMesa(procesos,['r','v','p','a']);
 assert.deepEqual(opciones.borradores.map(p=>p.id),['r']);
 assert.deepEqual(opciones.seleccionados.map(p=>p.id),['r']);assert.equal(opciones.seleccionDesactualizada,true);
});
