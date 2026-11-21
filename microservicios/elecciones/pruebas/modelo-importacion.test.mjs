import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { Pool } from 'pg';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const carpeta=process.env.TUVOTO_COMPILACION_ELECCIONES;
const {esquemaProceso,sectorValido,unidadValida,ESQUEMA,exigirBorrador,validarTransicion}=await import(pathToFileURL(resolve(carpeta,'modelo.js')));
const {leerExcel,plantillaExcel}=await import(pathToFileURL(resolve(carpeta,'excel.js')));
const base={nombre:'Elección sintética',cargo:'Rector',tipo:'universidad',unidad:'Carrera'};
test('conteo histórico sin opciones conserva votos iguales; pesos no quedan fijados en 50/50',()=>{
 assert.deepEqual(esquemaProceso.parse(base).sectores,[]);assert.equal(esquemaProceso.parse(base).ponderacion,false);
 const sectores=[{codigo:'docentes',nombre:'Docentes',pesoBps:3000},{codigo:'estudiantes',nombre:'Estudiantes',pesoBps:7000}];
 assert.equal(esquemaProceso.parse({...base,sectores,ponderacion:true}).sectores[0].pesoBps,3000);
 assert.equal(esquemaProceso.safeParse({...base,sectores:[sectores[0]],ponderacion:true}).success,false);
 assert.equal(esquemaProceso.safeParse({...base,vuelta:2}).success,false);
 assert.equal(sectorValido({sectores},'general'),false);assert.equal(sectorValido({},'general'),true);
});
test('una mesa del Director puede abarcar el grupo completo, pero no carreras de otro grupo',()=>{
 const c={facultad:'Facultad sintética',grupoCarreras:'Grupo A',carreras:['Sistemas','Diseño']};
 assert.equal(unidadValida(c,'Facultad sintética · Grupo A'),true);assert.equal(unidadValida(c,'Sistemas'),true);assert.equal(unidadValida(c,'Facultad sintética · Grupo B'),false);assert.equal(unidadValida(c,'Otra carrera'),false);
});
test('XLSX real: plantilla, columnas, contraseñas en texto y fórmulas rechazadas',async()=>{
 const plantilla=await plantillaExcel(['usuario','contrasena']);const libro=new ExcelJS.Workbook();await libro.xlsx.load(plantilla);libro.worksheets[0].addRow(['operador-sintetico','Valor-ficticio-123']);
 let archivo=Buffer.from(await libro.xlsx.writeBuffer()).toString('base64');let r=await leerExcel(archivo,['usuario','contrasena'],['usuario','contrasena'],100);assert.equal(r.filas[0].datos.usuario,'operador-sintetico');
 libro.worksheets[0].getCell('B2').value={formula:'1+1',result:2};archivo=Buffer.from(await libro.xlsx.writeBuffer()).toString('base64');await assert.rejects(leerExcel(archivo,['usuario','contrasena'],['usuario','contrasena'],100));
 await assert.rejects(leerExcel(Buffer.from('no-es-xlsx').toString('base64'),['nombre'],['nombre']));
});
test('Excel conjunto en importación individual se rechaza por columnas; el mismo archivo sí cumple el formato general',async()=>{
 const columnas=['cargo','ambito','vuelta','nombre','orden'];
 const libro=new ExcelJS.Workbook();await libro.xlsx.load(await plantillaExcel(columnas));libro.worksheets[0].addRow(['Rector','Universidad sintética',1,'Postulante sintético',1]);
 const archivo=Buffer.from(await libro.xlsx.writeBuffer()).toString('base64');
 await assert.rejects(leerExcel(archivo,['nombre','orden'],['nombre'],100),e=>e.estado===422&&e.detalle.includes('Columnas incorrectas')&&e.detalle.includes('nombre, orden')&&!e.detalle.includes('Máximo'));
 const general=await leerExcel(archivo,columnas,['cargo','ambito','nombre'],2000);assert.equal(general.filas.length,1);
 const individual=new ExcelJS.Workbook();await individual.xlsx.load(await plantillaExcel(['nombre','orden']));
 for(let n=0;n<101;n++)individual.worksheets[0].addRow(['Prueba '+n,n+1]);
 await assert.rejects(leerExcel(Buffer.from(await individual.xlsx.writeBuffer()).toString('base64'),['nombre','orden'],['nombre'],100),/Máximo 100 filas/);
});
test('migración real desde las tablas anteriores conserva filas, IDs y asignaciones', {skip:process.env.TUVOTO_PRUEBA_MODELO!=='SOLO_DATOS_EFIMEROS'},async t=>{
 const puerto=Number(process.env.TUVOTO_PRUEBA_PG_PUERTO);assert.ok(puerto>1024&&puerto!==5432);
 const db=new Pool({host:'127.0.0.1',port:puerto,user:'postgres',database:'tuvoto_modelo_pruebas'});t.after(()=>db.end());assert.equal((await db.query('SELECT current_database() AS nombre')).rows[0].nombre,'tuvoto_modelo_pruebas');
 await db.query(`CREATE TABLE tuvoto_procesos(id UUID PRIMARY KEY,id_organizacion UUID NOT NULL,nombre TEXT NOT NULL,cargo TEXT NOT NULL,tipo TEXT NOT NULL,unidad TEXT NOT NULL,actual BOOLEAN NOT NULL DEFAULT false,archivado BOOLEAN NOT NULL DEFAULT false,creado_en TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE TABLE tuvoto_candidatos(id UUID PRIMARY KEY,id_proceso UUID NOT NULL REFERENCES tuvoto_procesos(id),nombre TEXT NOT NULL,orden SERIAL,foto BYTEA,mime TEXT,UNIQUE(id_proceso,nombre));
 CREATE TABLE tuvoto_mesas(id UUID PRIMARY KEY,id_proceso UUID NOT NULL REFERENCES tuvoto_procesos(id),codigo TEXT NOT NULL,unidad TEXT NOT NULL,UNIQUE(id_proceso,codigo));
 CREATE TABLE tuvoto_asignaciones(id_mesa UUID NOT NULL REFERENCES tuvoto_mesas(id),id_usuario UUID NOT NULL,PRIMARY KEY(id_mesa,id_usuario));
 INSERT INTO tuvoto_procesos VALUES('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','Proceso histórico sintético','Rector','universidad','Carrera',true,false,now());
 INSERT INTO tuvoto_candidatos(id,id_proceso,nombre) VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Candidatura histórica');
 INSERT INTO tuvoto_mesas VALUES('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','Mesa histórica','Unidad sintética');
 INSERT INTO tuvoto_asignaciones VALUES('44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555');`);
 await db.query('BEGIN');await db.query(ESQUEMA);await db.query('COMMIT');await db.query(ESQUEMA);
 const p=(await db.query('SELECT * FROM tuvoto_procesos')).rows[0];assert.equal(p.nombre,'Proceso histórico sintético');assert.equal(p.publicado,true);assert.equal(p.estado,'recepcion');assert.equal(p.eliminada,false);await db.query("UPDATE tuvoto_procesos SET estado='cerrada'");await db.query(ESQUEMA);assert.equal((await db.query('SELECT estado FROM tuvoto_procesos')).rows[0].estado,'cerrada');assert.deepEqual(p.configuracion,{});
 assert.equal((await db.query('SELECT * FROM tuvoto_mesas')).rows[0].sector,'general');assert.equal((await db.query('SELECT * FROM tuvoto_asignaciones')).rowCount,1);assert.equal((await db.query('SELECT nombre FROM tuvoto_candidatos')).rows[0].nombre,'Candidatura histórica');
});

test('estados: configuración únicamente en borrador; sin reapertura ni saltos',()=>{
 exigirBorrador({estado:'borrador'});
 for(const estado of ['recepcion','cerrada','archivada'])assert.throws(()=>exigirBorrador({estado}));
 for(const [a,b] of [['borrador','recepcion'],['recepcion','cerrada'],['cerrada','archivada']])validarTransicion(a,b);
 for(const [a,b] of [['cerrada','recepcion'],['archivada','borrador'],['borrador','archivada']])assert.throws(()=>validarTransicion(a,b));
});
