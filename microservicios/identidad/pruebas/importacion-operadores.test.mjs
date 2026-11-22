import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import { randomBytes,randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const habilitado=process.env.TUVOTO_PRUEBA_IMPORTACION==='SOLO_DATOS_EFIMEROS';
test('importación REST real: mesa opcional, UUID, bcrypt, transacción y controles de sesión', {skip:!habilitado},async t=>{
 const puerto=Number(process.env.TUVOTO_PRUEBA_PG_PUERTO);
 assert.ok(puerto>1024&&![5432,5433].includes(puerto));
 const db=new Pool({host:'127.0.0.1',port:puerto,user:'postgres',database:'tuvoto_roles_pruebas'});
 t.after(()=>db.end());
 assert.equal((await db.query('SELECT current_database() AS nombre')).rows[0].nombre,'tuvoto_roles_pruebas');
 const {migrarSeguridad,bootstrap,rutasSeguridad}=await import(pathToFileURL(resolve(process.env.TUVOTO_COMPILACION_IDENTIDAD,'seguridad.js')));
 await migrarSeguridad(db);
 const clave=randomBytes(24).toString('base64url');
 await bootstrap(db,{usuario:'admin.sintetico',contrasena:clave});
 const org=randomUUID();await db.query('INSERT INTO organizaciones VALUES($1,$2,true)',[org,'Institución sintética']);
 const app=express();app.use(express.json({limit:'3mb'}));rutasSeguridad(app,db);
 app.use((e,req,res,next)=>res.status(e.estado??422).json({detalle:'Error controlado de prueba'}));
 const servidor=await new Promise(ok=>{const s=app.listen(0,'127.0.0.1',()=>ok(s));});
 t.after(()=>new Promise(ok=>servidor.close(ok)));
 const url='http://127.0.0.1:'+servidor.address().port,jar=new Map();
 async function pedir(ruta,datos,{anonimo=false,csrf=true,organizacion=org}={}){
  const cabeceras={Origin:'http://localhost:8080','X-Organizacion':organizacion};
  if(!anonimo){cabeceras.Cookie=[...jar].map(([k,v])=>k+'='+v).join('; ');if(csrf)cabeceras['X-CSRF-Token']=jar.get('tuvoto-csrf')??'';}
  if(datos)cabeceras['Content-Type']='application/json';
  const r=await fetch(url+ruta,{method:datos?'POST':'GET',headers:cabeceras,...datos?{body:JSON.stringify(datos)}:{}});
  for(const c of r.headers.getSetCookie()){const par=c.split(';')[0],i=par.indexOf('=');jar.set(par.slice(0,i),par.slice(i+1));}
  const cuerpo=await r.json();return {estado:r.status,cuerpo};
 }
 await pedir('/autenticacion/csrf');assert.equal((await pedir('/autenticacion/login',{usuario:'admin.sintetico',contrasena:clave})).estado,200);
 async function archivo(filas,columnas=['usuario','contrasena','mesa']){const libro=new ExcelJS.Workbook(),hoja=libro.addWorksheet('Datos');hoja.addRow(columnas);for(const f of filas)hoja.addRow(f);return Buffer.from(await libro.xlsx.writeBuffer()).toString('base64');}
 const entrada={idOrganizacion:org,archivo:await archivo([['conmesa',clave,'A01'],['sinmesa',clave,''],['noexiste',clave,'NO-EXISTE']])};
 const previa=await pedir('/importaciones/operadores/previsualizar',entrada);
 assert.equal(previa.estado,200);assert.deepEqual(previa.cuerpo.errores,[]);
 assert.ok(previa.cuerpo.filas.every(f=>f.contrasena==='••••••••'));
 assert.ok(!JSON.stringify(previa.cuerpo).includes(clave));
 assert.equal((await db.query('SELECT count(*)::int n FROM usuarios')).rows[0].n,1,'Vista previa sin altas');
 assert.equal((await pedir('/importaciones/operadores/confirmar',{...entrada,huella:'incorrecta',confirmar:true})).estado,409);
 assert.equal((await pedir('/importaciones/operadores/confirmar',{...entrada,huella:previa.cuerpo.huella,confirmar:true},{anonimo:true})).estado,401);
 assert.equal((await pedir('/importaciones/operadores/confirmar',{...entrada,huella:previa.cuerpo.huella,confirmar:true},{csrf:false})).estado,403);
 assert.equal((await pedir('/importaciones/operadores/previsualizar',entrada,{organizacion:randomUUID()})).estado,403);
 const confirmada=await pedir('/importaciones/operadores/confirmar',{...entrada,huella:previa.cuerpo.huella,confirmar:true});
 assert.equal(confirmada.estado,201);assert.equal(confirmada.cuerpo.importados,3);
 assert.deepEqual(confirmada.cuerpo.operadores.map(u=>u.mesa),['A01','','NO-EXISTE']);
 assert.ok(!JSON.stringify(confirmada.cuerpo).includes(clave));
 for(const cuenta of confirmada.cuerpo.operadores){const persistida=(await db.query('SELECT u.clave_hash,r.rol,r.id_organizacion FROM usuarios u JOIN asignaciones_roles r ON r.id_usuario=u.id WHERE u.id=$1',[cuenta.idUsuario])).rows[0];assert.equal(persistida.rol,'OPERADOR');assert.equal(persistida.id_organizacion,org);assert.ok(await bcrypt.compare(clave,persistida.clave_hash));assert.equal(bcrypt.getRounds(persistida.clave_hash),12);}
 assert.equal((await pedir('/importaciones/operadores/confirmar',{...entrada,huella:previa.cuerpo.huella,confirmar:true})).estado,409);
 assert.equal((await db.query('SELECT count(*)::int n FROM usuarios')).rows[0].n,4,'No duplica usuarios');
 const antiguo={idOrganizacion:org,archivo:await archivo([['formatoantiguo',clave]],['usuario','contrasena'])};
 const vistaAntigua=await pedir('/importaciones/operadores/previsualizar',antiguo);assert.equal(vistaAntigua.estado,200);
 assert.equal((await pedir('/importaciones/operadores/confirmar',{...antiguo,confirmar:true,huella:vistaAntigua.cuerpo.huella})).estado,201);
 const fallido={idOrganizacion:org,archivo:await archivo([['nuevouno',clave,'A01'],['nuevodos',clave,'']])};
 const vistaFallida=await pedir('/importaciones/operadores/previsualizar',fallido);
 await db.query(`CREATE FUNCTION impedir_alta() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.usuario='nuevodos' THEN RAISE EXCEPTION 'Fallo sintético'; END IF; RETURN NEW; END $$; CREATE TRIGGER impedir_alta BEFORE INSERT ON usuarios FOR EACH ROW EXECUTE FUNCTION impedir_alta();`);
 assert.equal((await pedir('/importaciones/operadores/confirmar',{...fallido,confirmar:true,huella:vistaFallida.cuerpo.huella})).estado,503);
 assert.equal((await db.query("SELECT count(*)::int n FROM usuarios WHERE usuario IN ('nuevouno','nuevodos')")).rows[0].n,0,'Sin altas parciales ante fallo');
 assert.equal((await db.query("SELECT count(*)::int n FROM auditoria_seguridad WHERE accion='operadores_importados'")).rows[0].n,2,'Sin auditoría de éxito del lote revertido');
});
