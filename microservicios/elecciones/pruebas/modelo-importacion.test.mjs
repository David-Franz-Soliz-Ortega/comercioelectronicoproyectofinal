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

test('portada persistente: selección múltiple, ámbito propio, reemplazo atómico y concurrencia', {skip:process.env.TUVOTO_PRUEBA_MODELO!=='SOLO_DATOS_EFIMEROS'}, async t=>{
 const puerto=Number(process.env.TUVOTO_PRUEBA_PG_PUERTO);assert.ok(puerto>1024&&puerto!==5432);
 const db=new Pool({host:'127.0.0.1',port:puerto,user:'postgres',database:'tuvoto_modelo_pruebas'});t.after(()=>db.end());
 assert.equal((await db.query('SELECT current_database() AS nombre')).rows[0].nombre,'tuvoto_modelo_pruebas');
 const {guardarPortada,esquemaPortada}=await import(pathToFileURL(resolve(carpeta,'portada.js')));
 const {randomUUID}=await import('node:crypto');
 const org=randomUUID(),otra=randomUUID(),ids=Array.from({length:5},()=>randomUUID());
 for(let i=0;i<ids.length;i++)await db.query("INSERT INTO tuvoto_procesos(id,id_organizacion,nombre,cargo,tipo,unidad,estado,archivado) VALUES($1,$2,'Prueba sintética',$3,'otra','Unidad',$4,$5)",[ids[i],i===3?otra:org,'Cargo '+i,i===4?'archivada':'borrador',i===4]);
 const lectura=async()=> (await db.query('SELECT id FROM tuvoto_procesos WHERE id_organizacion=$1 AND destacado_portada ORDER BY id',[org])).rows.map(p=>p.id).sort();
 const originales=(await db.query('SELECT id,estado,publicado,actual,configuracion FROM tuvoto_procesos WHERE id=ANY($1::uuid[]) ORDER BY id',[ids])).rows;
 assert.deepEqual(await lectura(),[]);
 assert.equal(esquemaPortada.safeParse({idProcesos:[ids[0]],confirmar:false}).success,false);
 assert.equal(esquemaPortada.safeParse({idProcesos:[ids[0],ids[0]],confirmar:true}).success,false);
 await guardarPortada(db,org,[ids[0],ids[1]]);assert.deepEqual(await lectura(),ids.slice(0,2).sort());
 for(const ajeno of [ids[3],ids[4],randomUUID()]){
  await assert.rejects(guardarPortada(db,org,[ids[2],ajeno]),e=>e.estado===422);
  assert.deepEqual(await lectura(),ids.slice(0,2).sort(),'Un lote inválido no cambia parcialmente la portada');
 }
 await guardarPortada(db,otra,[ids[3]]);
 await Promise.all([guardarPortada(db,org,[ids[0],ids[1]]),guardarPortada(db,org,[ids[2]])]);
 const concurrentes=await lectura();assert.ok(JSON.stringify(concurrentes)===JSON.stringify(ids.slice(0,2).sort())||JSON.stringify(concurrentes)===JSON.stringify([ids[2]]),'Persistir una selección completa, sin mezclar dos solicitudes');
 await guardarPortada(db,org,[]);assert.deepEqual(await lectura(),[]);
 assert.equal((await db.query('SELECT destacado_portada FROM tuvoto_procesos WHERE id=$1',[ids[3]])).rows[0].destacado_portada,true);
 assert.deepEqual((await db.query('SELECT id,estado,publicado,actual,configuracion FROM tuvoto_procesos WHERE id=ANY($1::uuid[]) ORDER BY id',[ids])).rows,originales,'La selección no publica ni inicia cargos');
});

test('editar candidato conserva foto e ID, audita y rechaza duplicados, otro ámbito y cargos bloqueados', {skip:process.env.TUVOTO_PRUEBA_MODELO!=='SOLO_DATOS_EFIMEROS'}, async t=>{
 const puerto=Number(process.env.TUVOTO_PRUEBA_PG_PUERTO);assert.ok(puerto>1024&&puerto!==5432);
 const db=new Pool({host:'127.0.0.1',port:puerto,user:'postgres',database:'tuvoto_modelo_pruebas'});t.after(()=>db.end());
 assert.equal((await db.query('SELECT current_database() AS nombre')).rows[0].nombre,'tuvoto_modelo_pruebas');
 const {editarNombreCandidato,esquemaNombreCandidato}=await import(pathToFileURL(resolve(carpeta,'candidatos.js')));
 const {randomUUID}=await import('node:crypto');
 const org=randomUUID(),actor=randomUUID(),proceso=randomUUID(),id=randomUUID(),otro=randomUUID();
 for(const entrada of [{nombre:''},{nombre:'   '},{nombre:'a'.repeat(121)},{nombre:'Válido',foto:'no-permitida'}])assert.equal(esquemaNombreCandidato.safeParse(entrada).success,false);
 await db.query("INSERT INTO tuvoto_procesos(id,id_organizacion,nombre,cargo,tipo,unidad) VALUES($1,$2,'Proceso sintético','Rector','universidad','Facultad')",[proceso,org]);
 await db.query("INSERT INTO tuvoto_candidatos(id,id_proceso,nombre,foto,mime) VALUES($1,$2,'Nombre anterior',$3,'image/png'),($4,$2,'Nombre ocupado',null,null)",[id,proceso,Buffer.from('imagen-sintética'),otro]);
 const leer=async()=> (await db.query('SELECT id,id_proceso,nombre,foto,mime,orden FROM tuvoto_candidatos WHERE id=$1',[id])).rows[0];
 const anterior=await leer();
 await editarNombreCandidato(db,id,org,actor,esquemaNombreCandidato.parse({nombre:'  Nombre corregido  '}).nombre);
 assert.deepEqual(await leer(),{...anterior,nombre:'Nombre corregido'});
 assert.deepEqual((await db.query("SELECT anterior FROM historial_catalogo WHERE id_recurso=$1 AND accion='nombre_editado'",[id])).rows,[{anterior:{nombre:'Nombre anterior'}}]);
 await assert.rejects(editarNombreCandidato(db,id,randomUUID(),actor,'Ajeno'),e=>e.estado===404);
 await assert.rejects(editarNombreCandidato(db,id,org,actor,'Nombre ocupado'),e=>e.code==='23505');
 assert.equal((await leer()).nombre,'Nombre corregido');
 for(const estado of ['recepcion','cerrada','archivada']){
  await db.query('UPDATE tuvoto_procesos SET estado=$2 WHERE id=$1',[proceso,estado]);
  await assert.rejects(editarNombreCandidato(db,id,org,actor,'Bloqueado'),e=>e.estado===409);
 }
 await db.query("UPDATE tuvoto_procesos SET estado='borrador',publicado=true WHERE id=$1",[proceso]);
 await assert.rejects(editarNombreCandidato(db,id,org,actor,'Publicado'),e=>e.estado===409);
 await db.query('UPDATE tuvoto_procesos SET publicado=false WHERE id=$1',[proceso]);
 const registro=randomUUID();await db.query('INSERT INTO registros_en_curso(id,id_proceso,id_usuario) VALUES($1,$2,$3)',[registro,proceso,actor]);
 await assert.rejects(editarNombreCandidato(db,id,org,actor,'En curso'),e=>e.estado===409);
 await db.query('DELETE FROM registros_en_curso WHERE id=$1',[registro]);
 await db.query('UPDATE tuvoto_candidatos SET id_candidato_origen=$2 WHERE id=$1',[otro,id]);
 await assert.rejects(editarNombreCandidato(db,id,org,actor,'Otra vuelta'),e=>e.estado===409);
 await db.query('UPDATE tuvoto_candidatos SET id_candidato_origen=null WHERE id=$1',[otro]);
 await db.query('UPDATE tuvoto_candidatos SET eliminada=true WHERE id=$1',[id]);
 await assert.rejects(editarNombreCandidato(db,id,org,actor,'Retirado'),e=>e.estado===404);
 assert.deepEqual(await leer(),{...anterior,nombre:'Nombre corregido'});
 assert.equal((await db.query('SELECT count(*)::int AS n FROM historial_catalogo WHERE id_recurso=$1',[id])).rows[0].n,1);
});

test('inicio y cierre institucional atómicos, concurrentes e independientes de la portada', {skip:process.env.TUVOTO_PRUEBA_MODELO!=='SOLO_DATOS_EFIMEROS'},async t=>{
 const {randomUUID}=await import('node:crypto');
 const {cambiarConteoInstitucion}=await import(pathToFileURL(resolve(carpeta,'conteo-institucion.js')));
 const db=new Pool({host:'127.0.0.1',port:Number(process.env.TUVOTO_PRUEBA_PG_PUERTO),user:'postgres',database:'tuvoto_modelo_pruebas'});t.after(()=>db.end());
 assert.equal((await db.query('SELECT current_database() AS nombre')).rows[0].nombre,'tuvoto_modelo_pruebas');await db.query(ESQUEMA);
 const org=randomUUID(),otra=randomUUID(),actor=randomUUID(),ids=[randomUUID(),randomUUID(),randomUUID()],mesas=[];
 for(let i=0;i<3;i++){
  await db.query('INSERT INTO tuvoto_procesos(id,id_organizacion,nombre,cargo,tipo,unidad,destacado_portada,configuracion) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[ids[i],i===2?otra:org,'Proceso sintético',['Rector','Vicerrector','Decano'][i],'universidad','Facultad',i===0,JSON.stringify({vuelta:1,sectores:[]})]);
  await db.query('INSERT INTO tuvoto_candidatos(id,id_proceso,nombre) VALUES($1,$2,$3)',[randomUUID(),ids[i],'Candidato sintético']);
  const mesa=randomUUID();mesas.push(mesa);await db.query('INSERT INTO tuvoto_mesas(id,id_proceso,codigo,unidad) VALUES($1,$2,$3,$4)',[mesa,ids[i],'Mesa sintética','Facultad sintética']);
  if(i!==1)await db.query('INSERT INTO tuvoto_asignaciones VALUES($1,$2)',[mesa,actor]);
 }
 await assert.rejects(cambiarConteoInstitucion(db,org,actor,'iniciar'),e=>e.estado===422&&e.faltantes[0].id===ids[1]);
 assert.deepEqual((await db.query('SELECT estado FROM tuvoto_procesos WHERE id=ANY($1::uuid[])',[ids.slice(0,2)])).rows.map(p=>p.estado),['borrador','borrador']);
 await db.query('INSERT INTO tuvoto_asignaciones VALUES($1,$2)',[mesas[1],actor]);
 const r=await Promise.all([cambiarConteoInstitucion(db,org,actor,'iniciar'),cambiarConteoInstitucion(db,org,actor,'iniciar')]);assert.equal(r.reduce((s,v)=>s+v.actualizados,0),2);
 for(const id of ids.slice(0,2)){const p=(await db.query('SELECT estado,publicado,actual,destacado_portada FROM tuvoto_procesos WHERE id=$1',[id])).rows[0];assert.equal(p.estado,'recepcion');assert.equal(p.publicado,true);assert.equal(p.actual,false);assert.equal(p.destacado_portada,id===ids[0]);}
 assert.equal((await db.query('SELECT estado FROM tuvoto_procesos WHERE id=$1',[ids[2]])).rows[0].estado,'borrador');
 const registro=randomUUID();await db.query('INSERT INTO registros_en_curso(id,id_proceso,id_usuario) VALUES($1,$2,$3)',[registro,ids[1],actor]);
 await assert.rejects(cambiarConteoInstitucion(db,org,actor,'terminar'),e=>e.estado===409);
 assert.equal((await db.query("SELECT count(*)::int n FROM tuvoto_procesos WHERE id=ANY($1::uuid[]) AND estado='recepcion'",[ids.slice(0,2)])).rows[0].n,2);
 await db.query('DELETE FROM registros_en_curso WHERE id=$1',[registro]);
 assert.equal((await cambiarConteoInstitucion(db,org,actor,'terminar')).actualizados,2);
 assert.equal((await cambiarConteoInstitucion(db,org,actor,'iniciar')).actualizados,0,'No reabre ni vacía conteos cerrados');
 assert.equal((await db.query('SELECT count(*)::int n FROM historial_procesos WHERE id_proceso=ANY($1::uuid[])',[ids.slice(0,2)])).rows[0].n,4,'Una transición por cargo e intento');
 assert.equal((await db.query('SELECT count(*)::int n FROM tuvoto_candidatos WHERE id_proceso=ANY($1::uuid[])',[ids])).rows[0].n,3,'Conserva candidatos');
});
