import type { Express, Request } from 'express';
import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { leerExcel, plantillaExcel, huellaExcel } from './excel.js';
import { buscarOperador } from './importaciones.js';
import { exigirBorrador, sectorValido, unidadValida } from './modelo.js';

export const columnasMesasCompartidas=['codigo','unidad','sector','recinto','apellidoDesde','apellidoHasta','cargo','ambito','vuelta','usuario'];
const normalizar=(v:string)=>v.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
const datosMesa=z.object({codigo:z.string().trim().min(1).max(60),unidad:z.string().trim().min(1).max(120),sector:z.string().trim().max(32).default('general'),recinto:z.string().trim().max(120).default(''),apellidoDesde:z.string().trim().max(80).default(''),apellidoHasta:z.string().trim().max(80).default('')}).strict();
type Mesa=z.infer<typeof datosMesa>;
type Fila=Mesa&{fila:number;idProceso?:string;cargo?:string;ambito?:string;vuelta:number;usuario:string};
type Registro=Mesa&{fila:number;idProceso:string;cargo:string;ambito:string;vuelta:number;usuario:string;idUsuario:string|null;idFisica:string|null;mesa:any;configuracion:any;nombreEleccion:string;accion:string};

export function rutasMesasCompartidas(app:Express,db:Pool){
 const base='/api/v1/configuracion/mesas-compartidas';
 async function procesos(c:Pool|PoolClient,org:string){return (await c.query('SELECT id,nombre,cargo,estado,configuracion,eliminada FROM tuvoto_procesos WHERE id_organizacion=$1 AND NOT eliminada AND NOT archivado ORDER BY id',[org])).rows;}
 async function operadores(req:Request,org:string,filas:Fila[]){
  const nombres=[...new Set(filas.map(f=>f.usuario).filter(Boolean))];
  if(nombres.length>100)throw Object.assign(new Error(),{estado:422,detalle:'Máximo 100 operadores diferentes por archivo'});
  const resultado=new Map<string,any>();
  for(const nombre of nombres)if(/^[a-z0-9._-]{3,80}$/.test(nombre))resultado.set(nombre,await buscarOperador(req,org,{usuario:nombre}));
  return resultado;
 }
 async function validar(c:Pool|PoolClient,org:string,filas:Fila[],usuarios:Map<string,any>){
  const ps=await procesos(c,org),fisicas=(await c.query('SELECT * FROM tuvoto_mesas_fisicas WHERE id_organizacion=$1',[org])).rows;
  const mesas=(await c.query('SELECT id,id_proceso,codigo,unidad,sector,eliminada,id_mesa_fisica FROM tuvoto_mesas WHERE id_proceso=ANY($1::uuid[])',[ps.map(p=>p.id)])).rows;
  const registros:Registro[]=[],errores:{fila:number;mensaje:string}[]=[],vistos=new Set<string>(),grupos=new Map<string,Registro>(),cargosMesa=new Map<string,string>();
  for(const f of filas){try{
   const coincidencias=ps.filter(p=>f.idProceso?p.id===f.idProceso:normalizar(p.cargo)===normalizar(f.cargo??'')&&normalizar(p.configuracion.ambito??'')===normalizar(f.ambito??'')&&(p.configuracion.vuelta??1)===f.vuelta);
   if(coincidencias.length!==1)throw Error('Cargo y ámbito ambiguos o inexistentes: corrige los cargos duplicados antes de importar');
   const p=coincidencias[0];exigirBorrador(p);
   const config=p.configuracion;
   const sectoresLista=config.sectores?.length?config.sectores:[{codigo:'docentes',nombre:'Docentes',pesoBps:5000},{codigo:'estudiantes',nombre:'Estudiantes',pesoBps:5000}];
   const coincidenciasSector=sectoresLista.filter((s:any)=>normalizar(s.codigo)===normalizar(f.sector)||normalizar(s.nombre)===normalizar(f.sector));
   const sector=coincidenciasSector.length===1?coincidenciasSector[0].codigo:f.sector||'general';
   if(!sectorValido(config,sector)&&!sectorValido({sectores:sectoresLista},sector))throw Error('Configura el mismo sector en todos los cargos de esta mesa; no se mezclan docentes y estudiantes');
   if(!unidadValida(config,f.unidad))throw Error('La unidad debe ser una carrera del cargo o Facultad · Grupo de carreras');
   const usuario=f.usuario?usuarios.get(f.usuario):null;
   if(f.usuario&&!usuario)throw Error('Operador inexistente, inactivo o fuera de esta institución');
   const fisica=fisicas.find(m=>normalizar(m.codigo)===normalizar(f.codigo)),existente=mesas.find(m=>m.id_proceso===p.id&&normalizar(m.codigo)===normalizar(f.codigo));
   const clave=normalizar(f.codigo),duplicado=p.id+':'+clave;
   if(vistos.has(duplicado))throw Error('La misma mesa y cargo aparecen dos veces en el archivo');
   vistos.add(duplicado);
   const cargoEnMesa=JSON.stringify([clave,normalizar(p.cargo),normalizar(config.ambito??''),config.vuelta??1]);
   if(cargosMesa.has(cargoEnMesa)&&cargosMesa.get(cargoEnMesa)!==p.id)throw Error('Hay dos registros del mismo cargo y ámbito. Elige uno o retira el duplicado antes de vincular la mesa');
   cargosMesa.set(cargoEnMesa,p.id);
   if(fisica&&[fisica.unidad,fisica.sector,fisica.recinto,fisica.apellido_desde,fisica.apellido_hasta].join('\0')!==[f.unidad,sector,f.recinto,f.apellidoDesde,f.apellidoHasta].join('\0'))throw Error('El código físico ya existe con otra unidad, sector, recinto o rango de apellidos');
   if(existente&&(existente.unidad!==f.unidad||existente.sector!==sector||(existente.id_mesa_fisica&&existente.id_mesa_fisica!==fisica?.id)))throw Error('La mesa existente tiene otra configuración o ya está vinculada a otra mesa física');
   const r:Registro={...f,sector,idProceso:p.id,cargo:p.cargo,ambito:config.ambito??'',vuelta:config.vuelta??1,idUsuario:usuario?.idUsuario??null,idFisica:fisica?.id??null,mesa:existente??null,configuracion:config,nombreEleccion:p.nombre,accion:existente?.eliminada?'Restaurar':existente?.id_mesa_fisica?'Mantener':'Vincular'};
   const grupo=grupos.get(clave);
   if(grupo&&[grupo.unidad,grupo.sector,grupo.recinto,grupo.apellidoDesde,grupo.apellidoHasta,grupo.nombreEleccion,grupo.vuelta].join('\0')!==[r.unidad,r.sector,r.recinto,r.apellidoDesde,r.apellidoHasta,r.nombreEleccion,r.vuelta].join('\0'))throw Error('Repite los mismos datos físicos y la misma vuelta en todas las filas de una mesa');
   grupos.set(clave,r);registros.push(r);
  }catch(e:any){errores.push({fila:f.fila,mensaje:e.detalle??e.message});}}
  return {registros,errores};
 }
 async function guardar(c:PoolClient,org:string,actor:string,registros:Registro[]){
  const ids=new Map<string,string>();
  for(const r of registros){
   const clave=normalizar(r.codigo);let fisica=ids.get(clave)??r.idFisica;
   if(!fisica){fisica=randomUUID();await c.query('INSERT INTO tuvoto_mesas_fisicas(id,id_organizacion,codigo,unidad,sector,recinto,apellido_desde,apellido_hasta) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[fisica,org,r.codigo,r.unidad,r.sector,r.recinto,r.apellidoDesde,r.apellidoHasta]);}
   ids.set(clave,fisica);
   const mesa=r.mesa?.id??randomUUID();
   if(r.mesa)await c.query('UPDATE tuvoto_mesas SET id_mesa_fisica=$2,eliminada=false WHERE id=$1',[mesa,fisica]);
   else await c.query('INSERT INTO tuvoto_mesas(id,id_proceso,codigo,unidad,sector,id_mesa_fisica) VALUES($1,$2,$3,$4,$5,$6)',[mesa,r.idProceso,r.codigo,r.unidad,r.sector,fisica]);
   if(r.idUsuario)await c.query('INSERT INTO tuvoto_asignaciones(id_mesa,id_usuario) VALUES($1,$2) ON CONFLICT DO NOTHING',[mesa,r.idUsuario]);
   if(r.accion!=='Mantener')await c.query('INSERT INTO historial_catalogo(id,id_proceso,id_actor,tipo,id_recurso,accion,anterior) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),r.idProceso,actor,'mesas',mesa,'mesa física: '+r.accion,r.mesa??{}]);
  }
  return {importados:registros.length,mesasFisicas:ids.size,actasEsperadas:registros.length};
 }
 async function bloquear(c:PoolClient,org:string){
  await c.query('SELECT pg_advisory_xact_lock(hashtext($1),607005)',[org]);
  await c.query("SELECT id FROM tuvoto_procesos WHERE id_organizacion=$1 AND estado='borrador' AND NOT eliminada ORDER BY id FOR UPDATE",[org]);
 }
 app.get(base,async(_req,res)=>{
  const r=await db.query(`SELECT f.id,f.codigo,f.unidad,f.sector,f.recinto,f.apellido_desde AS "apellidoDesde",f.apellido_hasta AS "apellidoHasta",json_agg(json_build_object('idMesa',m.id,'idProceso',p.id,'cargo',p.cargo,'ambito',COALESCE(p.configuracion->>'ambito',''),'estado',p.estado,'vuelta',COALESCE((p.configuracion->>'vuelta')::int,1)) ORDER BY p.cargo,p.id) AS cargos FROM tuvoto_mesas_fisicas f JOIN tuvoto_mesas m ON m.id_mesa_fisica=f.id JOIN tuvoto_procesos p ON p.id=m.id_proceso WHERE f.id_organizacion=$1 AND p.id_organizacion=$1 AND NOT m.eliminada AND NOT p.eliminada AND NOT p.archivado GROUP BY f.id ORDER BY f.unidad,f.codigo`,[res.locals.actor.idOrganizacion]);res.json({elementos:r.rows});
 });
 app.post(base,async(req,res)=>{
  const d=datosMesa.extend({idProcesos:z.array(z.string().uuid()).min(1).max(20),usuario:z.string().trim().toLowerCase().max(80).default('')}).parse(req.body);
  const org=res.locals.actor.idOrganizacion,filas:Fila[]=d.idProcesos.map((idProceso,i)=>({...d,idProceso,fila:i+1,vuelta:1}));
  const us=await operadores(req,org,filas),c=await db.connect();
  try{await c.query('BEGIN');await bloquear(c,org);const v=await validar(c,org,filas,us);if(v.errores.length)throw Object.assign(new Error(),{estado:422,detalle:v.errores[0].mensaje});const resultado=await guardar(c,org,res.locals.actor.idUsuario,v.registros);await c.query('COMMIT');res.status(201).json(resultado);}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 });
 app.get(base+'/importacion/plantilla',async(_req,res)=>res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment('mesas-compartidas.xlsx').send(await plantillaExcel(columnasMesasCompartidas)));
 for(const accion of ['previsualizar','confirmar'])app.post(base+'/importacion/'+accion,async(req,res)=>{
  const d=z.object({archivo:z.string(),confirmar:z.boolean().optional(),huella:z.string().optional()}).strict().parse(req.body),actor=res.locals.actor,org=actor.idOrganizacion;
  const {filas:originales,buffer}=await leerExcel(d.archivo,columnasMesasCompartidas,['codigo','unidad','cargo','ambito'],2000);
  const erroresIniciales:{fila:number;mensaje:string}[]=[],filas:Fila[]=[];
  for(const f of originales){try{const e=f.datos;filas.push({...datosMesa.parse({codigo:e.codigo,unidad:e.unidad,sector:e.sector?.trim()||'general',recinto:e.recinto??'',apellidoDesde:e.apellidoDesde??'',apellidoHasta:e.apellidoHasta??''}),fila:f.fila,cargo:z.string().trim().min(1).max(100).parse(e.cargo),ambito:e.ambito?.trim()??'',vuelta:e.vuelta?.trim()?z.coerce.number().int().min(1).max(2).parse(e.vuelta):1,usuario:e.usuario?.trim().toLowerCase()??''});}catch{erroresIniciales.push({fila:f.fila,mensaje:'Revisa código, unidad, cargo, ámbito y vuelta'});}}
  const us=await operadores(req,org,filas);
  const huella=(v:Awaited<ReturnType<typeof validar>>)=>huellaExcel(buffer,JSON.stringify([actor.idUsuario,org,v.registros]));
  if(accion==='previsualizar'){
   const v=await validar(db,org,filas,us);res.json({total:originales.length,errores:[...erroresIniciales,...v.errores],huella:huella(v),filas:v.registros.map(r=>({fila:r.fila,codigo:r.codigo,unidad:r.unidad,sector:r.sector,recinto:r.recinto,apellidoDesde:r.apellidoDesde,apellidoHasta:r.apellidoHasta,cargo:r.cargo,ambito:r.ambito,vuelta:r.vuelta,usuario:r.usuario,accion:r.accion}))});return;
  }
  const c=await db.connect();try{
   await c.query('BEGIN');await bloquear(c,org);const v=await validar(c,org,filas,us);
   if(!d.confirmar||d.huella!==huella(v)||erroresIniciales.length||v.errores.length)throw Object.assign(new Error(),{estado:409,detalle:'El archivo o sus destinos cambiaron. Revisa de nuevo; no se importó nada'});
   const resultado=await guardar(c,org,actor.idUsuario,v.registros);await c.query('COMMIT');res.status(201).json(resultado);
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 });
}
