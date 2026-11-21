import type { Express, Request } from 'express';
import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { leerExcel, plantillaExcel, huellaExcel } from './excel.js';
const entrada=z.object({idOrganizacion:z.string().uuid(),archivo:z.string(),huella:z.string().optional(),confirmar:z.boolean().optional()}).strict();
const fila=z.object({usuario:z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,80}$/),contrasena:z.string().min(12).refine(v=>Buffer.byteLength(v,'utf8')<=72)});
export function rutasImportacionOperadores(app:Express,pool:Pool,puedeAdministrar:(actor:any,org:string)=>boolean,revalidar:(req:Request,db:PoolClient)=>Promise<any>){
 async function validar(actor:any,org:string,c:Pool|PoolClient){if(!puedeAdministrar(actor,org)||!(await c.query('SELECT 1 FROM organizaciones WHERE id=$1 AND activa',[org])).rowCount)throw Object.assign(new Error(),{estado:403});}
 app.get('/importaciones/operadores/plantilla',async(req,res)=>{const org=z.string().uuid().parse(req.header('X-Organizacion'));await validar(res.locals.actor,org,pool);res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment('operadores.xlsx').send(await plantillaExcel(['usuario','contrasena']));});
 for(const accion of ['previsualizar','confirmar'])app.post('/importaciones/operadores/'+accion,async(req,res)=>{
  const d=entrada.parse(req.body);await validar(res.locals.actor,d.idOrganizacion,pool);
  if(req.header('X-Organizacion')&&req.header('X-Organizacion')!==d.idOrganizacion){res.status(403).json({detalle:'Organización no coincide'});return;}
  const {filas,buffer}=await leerExcel(d.archivo,['usuario','contrasena'],['usuario','contrasena'],100);
  const huella=huellaExcel(buffer,res.locals.actor.id+':'+d.idOrganizacion+':operadores');
  const errores:{fila:number;mensaje:string}[]=[],registros:{fila:number;usuario:string;contrasena:string}[]=[],vistos=new Set<string>();
  for(const f of filas){const r=fila.safeParse(f.datos);if(!r.success){errores.push({fila:f.fila,mensaje:'Usuario o contraseña inválidos: mínimo 12 caracteres, máximo 72 bytes de contraseña'});continue;}if(vistos.has(r.data.usuario))errores.push({fila:f.fila,mensaje:'Usuario repetido en el archivo'});vistos.add(r.data.usuario);registros.push({fila:f.fila,...r.data});}
  const existentes=registros.length?(await pool.query('SELECT usuario FROM usuarios WHERE usuario=ANY($1::text[])',[registros.map(r=>r.usuario)])).rows:[];
  for(const r of registros)if(existentes.some(e=>e.usuario===r.usuario))errores.push({fila:r.fila,mensaje:'El usuario ya existe; no se modificará su contraseña'});
  if(accion==='previsualizar'){res.json({huella,total:filas.length,errores,filas:registros.map(r=>({fila:r.fila,usuario:r.usuario,rol:'OPERADOR',contrasena:'••••••••'}))});return;}
  if(!d.confirmar||d.huella!==huella||errores.length){res.status(409).json({detalle:'Revisa la vista previa; no se importó ningún usuario',errores});return;}
  const hashes=[];for(const r of registros)hashes.push(await bcrypt.hash(r.contrasena,12));
  const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT id FROM usuarios WHERE id=$1 FOR SHARE',[res.locals.actor.id]);const actor=await revalidar(req,c);if(!actor)throw Object.assign(new Error(),{estado:401});await validar(actor,d.idOrganizacion,c);
   for(let i=0;i<registros.length;i++){const id=randomUUID();await c.query('INSERT INTO usuarios(id,usuario,clave_hash) VALUES($1,$2,$3)',[id,registros[i].usuario,hashes[i]]);await c.query("INSERT INTO asignaciones_roles VALUES($1,$2,'OPERADOR',$3)",[randomUUID(),id,d.idOrganizacion]);}
   await c.query("INSERT INTO auditoria_seguridad VALUES($1,$2,$3,'operadores_importados',$4,now())",[randomUUID(),actor.id,d.idOrganizacion,String(registros.length)]);await c.query('COMMIT');res.status(201).json({importados:registros.length});
  }catch(e:any){await c.query('ROLLBACK');res.status(e.code==='23505'?409:e.estado??503).json({detalle:'No se importó ningún usuario. Revisa duplicados y permisos.'});}finally{c.release();}
 });
}
