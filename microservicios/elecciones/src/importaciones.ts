import type { Express, Request } from 'express';
import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { leerExcel, plantillaExcel, huellaExcel, type FilaExcel } from './excel.js';
import { sectorValido, unidadValida, exigirBorrador } from './modelo.js';
export const tipos=['candidatos','mesas','asignaciones'] as const;
export const columnas={candidatos:['nombre','orden'],mesas:['codigo','unidad','sector'],asignaciones:['usuario','codigoMesa']};
export type Tipo=typeof tipos[number];
export async function buscarOperador(req:Request,org:string,filtro:{usuario?:string;idUsuario?:string}){
 const qs=new URLSearchParams(filtro as Record<string,string>);const resp=await fetch((process.env.IDENTIDAD_URL??'http://identidad:3000')+'/api/v1/usuarios?'+qs,{headers:{Cookie:req.header('Cookie')??'','X-Organizacion':org},signal:AbortSignal.timeout(4000)});
 if(!resp.ok)throw Object.assign(new Error(),{estado:503});
 const lista=await resp.json();return lista.elementos.find((u:any)=>u.activo&&u.roles?.some((r:any)=>r.rol==='OPERADOR'&&r.idOrganizacion===org)&&!u.roles.some((r:any)=>r.rol==='ADMINISTRADOR'&&(r.idOrganizacion===null||r.idOrganizacion===org)));
}
export async function validarFilasProceso(c:Pool|PoolClient,p:any,filas:FilaExcel[],tipo:Tipo,operadores:Map<string,any>){
 exigirBorrador(p);
 const errores:{fila:number;mensaje:string}[]=[],registros:any[]=[],vistos=new Set<string>();
   const candidatos=(await c.query('SELECT * FROM tuvoto_candidatos WHERE id_proceso=$1 AND NOT eliminada',[p.id])).rows;
   const mesas=(await c.query('SELECT * FROM tuvoto_mesas WHERE id_proceso=$1 AND NOT eliminada',[p.id])).rows;
   const origenes=p.configuracion.vuelta===2?(await c.query('SELECT * FROM tuvoto_candidatos WHERE id_proceso=$1 AND NOT eliminada FOR SHARE',[p.configuracion.idPrimeraVuelta])).rows:[];
   for(const f of filas){try{
    const d=f.datos;let registro:any;
    if(tipo==='candidatos'){
     
     const nombre=z.string().trim().min(1).max(120).parse(d.nombre),orden=d.orden?.trim()?z.coerce.number().int().min(1).max(10000).parse(d.orden):null;
     const clave=nombre.toLocaleLowerCase();if(vistos.has(clave)||candidatos.some(c=>c.nombre.toLocaleLowerCase()===clave))throw Error('Candidato duplicado');vistos.add(clave);
     if(candidatos.length+filas.length>100)throw Error('Máximo 100 candidatos por elección');
     const coincidencias=origenes.filter(c=>c.nombre.toLocaleLowerCase()===clave);const origen=coincidencias.length===1?coincidencias[0]:undefined;
     if(p.configuracion.vuelta===2&&(!origen||candidatos.length+filas.length>2))throw Error('Segunda vuelta: selecciona dos nombres de la primera vuelta');
     registro={nombre,orden,origen};
    }else if(tipo==='mesas'){
     const codigo=z.string().trim().min(1).max(60).parse(d.codigo),unidad=z.string().trim().min(1).max(120).parse(d.unidad);let sector=d.sector?.trim()||'general';const coincidencias=(p.configuracion.sectores??[]).filter((s:any)=>s.codigo===sector.toLowerCase()||s.nombre.toLocaleLowerCase()===sector.toLocaleLowerCase());if(coincidencias.length===1)sector=coincidencias[0].codigo;
     if(!sectorValido(p.configuracion,sector))throw Error('Sector no configurado para esta elección');
     if(!unidadValida(p.configuracion,unidad))throw Error('La carrera no pertenece a este cargo');
     if(vistos.has(codigo)||mesas.some(m=>m.codigo===codigo))throw Error('Código de mesa duplicado');vistos.add(codigo);registro={codigo,unidad,sector};
    }else{
     const usuario=d.usuario?.trim().toLowerCase(),mesa=mesas.find(m=>m.codigo===d.codigoMesa?.trim()),operador=operadores.get(usuario);
     if(!mesa||!operador)throw Error('Mesa inexistente u operador no autorizado en esta organización');
     const clave=mesa.id+':'+operador.idUsuario;
     if(vistos.has(clave)||(await c.query('SELECT 1 FROM tuvoto_asignaciones WHERE id_mesa=$1 AND id_usuario=$2',[mesa.id,operador.idUsuario])).rowCount)throw Error('Asignación duplicada; no se sobrescribirá');
     vistos.add(clave);registro={usuario,codigoMesa:mesa.codigo,idMesa:mesa.id,idUsuario:operador.idUsuario};
    }
    registros.push({fila:f.fila,...registro});
   }catch(e:any){errores.push({fila:f.fila,mensaje:e instanceof z.ZodError?'Campos inválidos: revisa formato, longitud y valores':e.message});}}
 return {errores,registros};
}
export async function guardarFilasProceso(c:PoolClient,idProceso:string,tipo:Tipo,registros:any[]){
   for(const r of registros){
    if(tipo==='candidatos'){const rguardado=await c.query('INSERT INTO tuvoto_candidatos(id,id_proceso,nombre,orden,foto,mime,id_candidato_origen) VALUES($1,$2,$3,COALESCE($4,(SELECT COALESCE(max(orden),0)+1 FROM tuvoto_candidatos WHERE id_proceso=$2)),$5,$6,$7) ON CONFLICT(id_proceso,nombre) DO UPDATE SET eliminada=false WHERE tuvoto_candidatos.eliminada RETURNING id',[randomUUID(),idProceso,r.nombre,r.orden,r.origen?.foto??null,r.origen?.mime??null,r.origen?.id??null]);if(!rguardado.rowCount)throw Object.assign(new Error(),{estado:409});}
    else if(tipo==='mesas'){const rguardado=await c.query('INSERT INTO tuvoto_mesas(id,id_proceso,codigo,unidad,sector) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id_proceso,codigo) DO UPDATE SET eliminada=false WHERE tuvoto_mesas.eliminada AND tuvoto_mesas.unidad=EXCLUDED.unidad AND tuvoto_mesas.sector=EXCLUDED.sector RETURNING id',[randomUUID(),idProceso,r.codigo,r.unidad,r.sector]);if(!rguardado.rowCount)throw Object.assign(new Error(),{estado:409});}
    else await c.query('INSERT INTO tuvoto_asignaciones(id_mesa,id_usuario) VALUES($1,$2)',[r.idMesa,r.idUsuario]);
   }
}
export async function resolverOperadores(req:Request,org:string,filas:FilaExcel[],tipo:Tipo){
 const operadores=new Map<string,any>();
 if(tipo==='asignaciones'){
  const nombres=[...new Set(filas.map(f=>f.datos.usuario?.trim().toLowerCase()))];
  if(nombres.length>100)throw Object.assign(new Error(),{estado:422,detalle:'Máximo 100 operadores distintos por archivo'});
  for(const nombre of nombres){if(!/^[a-z0-9._-]{3,80}$/.test(nombre??''))continue;operadores.set(nombre,await buscarOperador(req,org,{usuario:nombre}));}
 }
 return operadores;
}
export function rutasImportaciones(app:Express,db:Pool){
 const base='/api/v1/configuracion/procesos/:id/importaciones/:tipo';
 async function propio(id:string,org:string,c:Pool|PoolClient){const r=await c.query('SELECT * FROM tuvoto_procesos WHERE id=$1 AND id_organizacion=$2 AND NOT archivado AND NOT eliminada',[z.string().uuid().parse(id),org]);if(!r.rowCount)throw Object.assign(new Error(),{estado:404});return r.rows[0];}
 app.get(base+'/plantilla',async(req,res)=>{const tipo=z.enum(tipos).parse(req.params.tipo);await propio(z.string().uuid().parse(req.params.id),res.locals.actor.idOrganizacion,db);res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment(tipo+'.xlsx').send(await plantillaExcel(columnas[tipo]));});
 for(const accion of ['previsualizar','confirmar'])app.post(base+'/'+accion,async(req,res)=>{
  const tipo=z.enum(tipos).parse(req.params.tipo),org=res.locals.actor.idOrganizacion;
  const entrada=z.object({archivo:z.string(),huella:z.string().optional(),confirmar:z.boolean().optional()}).strict().parse(req.body);
  await propio(z.string().uuid().parse(req.params.id),org,db);
  const {filas,buffer}=await leerExcel(entrada.archivo,columnas[tipo],tipo==='candidatos'?['nombre']:tipo==='mesas'?['codigo','unidad']:['usuario','codigoMesa'],tipo==='candidatos'?100:2000);
  const huella=huellaExcel(buffer,res.locals.actor.idUsuario+':'+org+':'+req.params.id+':'+tipo);
  const operadores=await resolverOperadores(req,org,filas,tipo);
  async function validar(c:Pool|PoolClient){return validarFilasProceso(c,await propio(z.string().uuid().parse(req.params.id),org,c),filas,tipo,operadores);}
  if(accion==='previsualizar'){const v=await validar(db);res.json({huella,total:filas.length,errores:v.errores,filas:v.registros.map(({origen,idMesa,idUsuario,...r})=>r)});return;}
  if(!entrada.confirmar||entrada.huella!==huella){res.status(409).json({detalle:'Confirma la vista previa del mismo archivo'});return;}
  const c=await db.connect();try{await c.query('BEGIN');await c.query('SELECT id FROM tuvoto_procesos WHERE id=$1 FOR UPDATE',[req.params.id]);const v=await validar(c);
   if(v.errores.length){await c.query('ROLLBACK');res.status(409).json({detalle:'Cambió la configuración o hay errores; no se importó nada',errores:v.errores});return;}
   await guardarFilasProceso(c,req.params.id as string,tipo,v.registros);
   await c.query('COMMIT');res.status(201).json({importados:v.registros.length});
  }catch(e:any){await c.query('ROLLBACK');res.status(e.code==='23505'?409:e.estado??503).json({detalle:'No se importó ningún registro; vuelve a previsualizar'});}finally{c.release();}
 });
}
