import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const {migrarSeguridad,roles}=await import(pathToFileURL(resolve(process.env.TUVOTO_COMPILACION_IDENTIDAD,'seguridad.js')));
const habilitado=process.env.TUVOTO_PRUEBA_ROLES==='SOLO_DATOS_EFIMEROS';
test('solo se asignan tres roles TUVOTO',()=>assert.deepEqual(roles,['ADMINISTRADOR','OPERADOR','AUDITOR']));
test('migración SQL real conserva alcance, claves y usuarios; revoca sesiones una sola vez', {skip:!habilitado}, async t=>{
 const puerto=Number(process.env.TUVOTO_PRUEBA_PG_PUERTO);
 assert.ok(puerto>1024&&puerto!==5432&&puerto!==5433);
 const db=new Pool({host:'127.0.0.1',port:puerto,user:'postgres',database:'tuvoto_roles_pruebas'});
 t.after(()=>db.end());
 assert.equal((await db.query('SELECT current_database() AS nombre')).rows[0].nombre,'tuvoto_roles_pruebas');
 await migrarSeguridad(db);
 // Recrear únicamente el esquema histórico dentro de esta base efímera.
 await db.query(`ALTER TABLE asignaciones_roles DROP CONSTRAINT asignaciones_roles_rol_check;
 ALTER TABLE asignaciones_roles DROP CONSTRAINT asignaciones_roles_check;
 ALTER TABLE asignaciones_roles ADD CONSTRAINT asignaciones_roles_rol_check CHECK(rol IN ('SUPERADMIN','ADMIN_ELECTORAL','OPERADOR','AUDITOR','ELECTOR'));
 ALTER TABLE asignaciones_roles ADD CONSTRAINT asignaciones_roles_check CHECK((rol='SUPERADMIN')=(id_organizacion IS NULL));`);
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333',org='44444444-4444-4444-8444-444444444444';
 await db.query('INSERT INTO organizaciones VALUES($1,$2,true)',[org,'Organización sintética']);
 for(const [id,rol,alcance] of [[a,'SUPERADMIN',null],[b,'ADMIN_ELECTORAL',org],[c,'OPERADOR',org]]){
  await db.query('INSERT INTO usuarios(id,usuario,clave_hash) VALUES($1,$2,$3)',[id,'sintetico-'+rol,'hash-sintetico-no-utilizable']);
  await db.query('INSERT INTO asignaciones_roles VALUES($1,$2,$3,$4)',[id,id,rol,alcance]);
  await db.query("INSERT INTO sesiones(hash,id_usuario,csrf_hash,expira_en) VALUES($1,$2,'no-utilizable',now()+interval '1 hour')",[id,id]);
  await db.query("INSERT INTO recuperaciones VALUES($1,$2,now()+interval '1 hour',false)",[id,id]);
 }
 // Un fallo a mitad de la migración debe revertir también roles y sesiones.
 await db.query(`CREATE FUNCTION impedir_migracion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Fallo sintético'; END $$;
 CREATE TRIGGER fallo_sintetico BEFORE UPDATE ON sesiones FOR EACH ROW EXECUTE FUNCTION impedir_migracion();`);
 await assert.rejects(migrarSeguridad(db));
 assert.equal((await db.query('SELECT rol FROM asignaciones_roles WHERE id=$1',[a])).rows[0].rol,'SUPERADMIN');
 assert.equal((await db.query('SELECT revocada FROM sesiones WHERE hash=$1',[a])).rows[0].revocada,false);
 await db.query('DROP TRIGGER fallo_sintetico ON sesiones; DROP FUNCTION impedir_migracion()');
 await migrarSeguridad(db);
 const asignadas=(await db.query('SELECT id,rol,id_organizacion FROM asignaciones_roles ORDER BY id')).rows;
 assert.deepEqual(asignadas,[{id:a,rol:'ADMINISTRADOR',id_organizacion:null},{id:b,rol:'ADMINISTRADOR',id_organizacion:org},{id:c,rol:'OPERADOR',id_organizacion:org}]);
 assert.deepEqual((await db.query('SELECT revocada FROM sesiones ORDER BY id_usuario')).rows.map(r=>r.revocada),[true,true,false]);
 assert.equal((await db.query("SELECT count(*)::int AS n FROM usuarios WHERE clave_hash='hash-sintetico-no-utilizable'")).rows[0].n,3);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM recuperaciones WHERE NOT usada')).rows[0].n,3);
 await db.query('UPDATE sesiones SET revocada=false WHERE id_usuario=$1',[a]);
 await migrarSeguridad(db);
 assert.equal((await db.query('SELECT revocada FROM sesiones WHERE hash=$1',[a])).rows[0].revocada,false);
 await assert.rejects(db.query("UPDATE asignaciones_roles SET rol='SUPERADMIN' WHERE id=$1",[a]),e=>e.code==='23514');
 await assert.rejects(db.query('UPDATE asignaciones_roles SET id_organizacion=NULL WHERE id=$1',[c]),e=>e.code==='23514');
});
