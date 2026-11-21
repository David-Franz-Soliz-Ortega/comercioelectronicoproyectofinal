import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const carpeta=process.env.TUVOTO_COMPILACION_ELECCIONES;
const {prepararCargoUniversitario,planificarImportacionCargos,configuracionReemplazo}=await import(pathToFileURL(resolve(carpeta,'cargos-universitarios.js')));
const {unidadValida}=await import(pathToFileURL(resolve(carpeta,'modelo.js')));
test('cargos universitarios: rector y vice abarcan toda la universidad',()=>{
 for(const cargo of ['rector','Vicerrector']){const p=prepararCargoUniversitario({cargo},'USFX sintética');assert.equal(p.ambito,'Toda la universidad');assert.deepEqual(p.carreras,[]);assert.equal(p.unidad,'Facultad');}
 assert.throws(()=>prepararCargoUniversitario({cargo:'Alcalde'},'USFX'),/Cargo permitido/);
 assert.throws(()=>prepararCargoUniversitario({cargo:'Rector',facultad:'Tecnología'},'USFX'),/toda la universidad/);
});

const existente=(otros={})=>({id:'director-a',nombre:'Universidad sintética original',cargo:'Director',tipo:'universidad',unidad:'Carrera',estado:'borrador',configuracion:{ambito:'Tecnología · A',facultad:'Tecnología',grupoCarreras:'A',carreras:['Sistemas'],vuelta:1,idPrimeraVuelta:null,sectores:[{codigo:'docentes',nombre:'Docentes',pesoBps:3000},{codigo:'estudiantes',nombre:'Estudiantes',pesoBps:7000}],ponderacion:true,reglaSegundaVuelta:{modo:'por_sector',umbral:50,estricto:true}},...otros});
const filaDirector={fila:2,datos:{cargo:'Director',facultad:'Tecnología',grupoCarreras:'A',carreras:'Sistemas; Civil'}};
test('duplicados existentes: mantener por defecto, aun si el cargo está cerrado',()=>{
 const actual=existente({estado:'cerrada'}),copia=structuredClone(actual);
 const plan=planificarImportacionCargos([filaDirector],[actual],'Otro nombre');
 assert.deepEqual(plan.errores,[]);assert.equal(plan.registros[0].accion,'mantener');assert.equal(plan.coincidencias[0].puedeReemplazar,false);assert.deepEqual(actual,copia);
 assert.equal(planificarImportacionCargos([filaDirector],[actual],'Otro nombre',{'2':'reemplazar'}).errores.length,1);
});
test('reemplazar conserva ámbito, sectores, ponderación y regla sin mutar datos existentes',()=>{
 const actual=existente(),copia=structuredClone(actual);
 const plan=planificarImportacionCargos([filaDirector],[actual],'Otro nombre',{'2':'reemplazar'});
 assert.deepEqual(plan.errores,[]);assert.equal(plan.registros[0].accion,'reemplazar');
 const d=configuracionReemplazo(actual,plan.registros[0].datos);
 assert.deepEqual(d.configuracion.carreras,['Sistemas','Civil']);
 for(const campo of ['ambito','sectores','ponderacion','reglaSegundaVuelta','vuelta','idPrimeraVuelta'])assert.deepEqual(d.configuracion[campo],actual.configuracion[campo]);
 assert.deepEqual(actual,copia);assert.equal(actual.nombre,'Universidad sintética original');
 for(const estado of ['recepcion','cerrada','archivada'])assert.throws(()=>configuracionReemplazo({...actual,estado},plan.registros[0].datos),/borrador/);
 assert.throws(()=>configuracionReemplazo({...actual,tieneReferencia:true},plan.registros[0].datos),/Otra vuelta/);
});
test('duplicados en el archivo, destinos ambiguos y carreras de otros Directores siguen rechazados',()=>{
 const actual=existente();
 assert.equal(planificarImportacionCargos([filaDirector,{...filaDirector,fila:3}],[],'Sintética').errores.length,1);
 assert.equal(planificarImportacionCargos([filaDirector],[actual,{...actual,id:'otra-coincidencia'}],'Sintética').errores.length,1);
 const otro=existente({id:'director-b',configuracion:{facultad:'Tecnología',grupoCarreras:'B',ambito:'Tecnología · B',carreras:['Civil'],vuelta:1}});
 assert.equal(planificarImportacionCargos([filaDirector],[actual,otro],'Sintética',{'2':'reemplazar'}).errores.length,1);
});
test('cada decano necesita facultad y cada director un grupo con carreras únicas',()=>{
 assert.throws(()=>prepararCargoUniversitario({cargo:'Decano'},'USFX'),/facultad/);
 assert.throws(()=>prepararCargoUniversitario({cargo:'Director',facultad:'Tecnología'},'USFX'),/grupoCarreras/);
 const a=prepararCargoUniversitario({cargo:'Director',facultad:'Tecnología',grupoCarreras:'Grupo A',carreras:'Sistemas; Civil'},'USFX');
 const b=prepararCargoUniversitario({cargo:'Director',facultad:'Tecnología',grupoCarreras:'Grupo B',carreras:'Química; Industrial'},'USFX');
 assert.notEqual(a.ambito,b.ambito);assert.deepEqual(a.carreras,['Sistemas','Civil']);assert.equal(unidadValida(a,'Sistemas'),true);assert.equal(unidadValida(b,'Sistemas'),false);assert.equal(unidadValida({},'Unidad anterior'),true);
 assert.throws(()=>prepararCargoUniversitario({cargo:'Director',facultad:'Tecnología',grupoCarreras:'A',carreras:'Sistemas; sistemas'},'USFX'));
});
