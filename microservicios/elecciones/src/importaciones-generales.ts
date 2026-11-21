import type { Express } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { leerExcel, plantillaExcel, huellaExcel, type FilaExcel } from './excel.js';
import { tipos, columnas, resolverOperadores, validarFilasProceso, guardarFilasProceso, type Tipo } from './importaciones.js';

const normalizar=(v:string)=>v.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
type Proceso={id:string;cargo:string;estado:string;configuracion:{ambito?:string;vuelta?:number}};
type Referencia={referencia:string;cargo:string;ambito:string;vuelta:number;idProceso:string|null};
export const columnasGenerales=(tipo:Tipo)=>['cargo','ambito','vuelta',...columnas[tipo]];

// Solo coincidencias inequívocas; la selección explícita nunca cruza cargo, vuelta u organización.
export function resolverDestinos(filas:FilaExcel[],procesos:Proceso[],asociaciones:Record<string,string>={}){
 const referencias=new Map<string,Referencia>(),grupos=new Map<string,FilaExcel[]>(),errores:{fila:number;mensaje:string}[]=[];
 for(const f of filas){
  try{
   const cargo=z.string().trim().min(1).max(100).parse(f.datos.cargo);
   const ambito=z.string().trim().max(160).parse(f.datos.ambito??'');
   const vuelta=f.datos.vuelta?.trim()?z.coerce.number().int().min(1).max(2).parse(f.datos.vuelta):1;
   const referencia=JSON.stringify([normalizar(cargo),normalizar(ambito),vuelta]);
   let r=referencias.get(referencia);
   if(!r){
    const posibles=procesos.filter(p=>normalizar(p.cargo)===normalizar(cargo)&&(p.configuracion.vuelta??1)===vuelta);
    const exactos=posibles.filter(p=>normalizar(p.configuracion.ambito??'')===normalizar(ambito));
    const elegido=asociaciones[referencia];
    const destino=elegido?posibles.find(p=>p.id===elegido):exactos.length===1?exactos[0]:undefined;
    r={referencia,cargo,ambito,vuelta,idProceso:destino?.id??null};referencias.set(referencia,r);
   }
   if(!r.idProceso)throw Error('Selecciona un cargo existente de esta institución para este ámbito y vuelta; no se ha encontrado un destino único');
   const p=procesos.find(p=>p.id===r.idProceso)!;
   if(p.estado!=='borrador')throw Error('El cargo de destino ya salió de borrador; no se modificará');
   const grupo=grupos.get(p.id)??[];grupo.push(f);grupos.set(p.id,grupo);
  }catch(e){errores.push({fila:f.fila,mensaje:e instanceof z.ZodError?'Revisa cargo, ámbito y vuelta (1 o 2)':(e as Error).message});}
 }
 if(referencias.size>200)throw Object.assign(new Error(),{estado:422,detalle:'Máximo 200 destinos por archivo'});
 return {referencias:[...referencias.values()],grupos,errores};
}

export function rutasImportacionesGenerales(app:Express,db:Pool){
 const base='/api/v1/configuracion/importaciones-generales/:tipo';
 app.get(base+'/plantilla',async(req,res)=>{
  const tipo=z.enum(tipos).parse(req.params.tipo);
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment(tipo+'-todos-los-cargos.xlsx').send(await plantillaExcel(columnasGenerales(tipo)));
 });
 for(const accion of ['previsualizar','confirmar'])app.post(base+'/'+accion,async(req,res)=>{
  const tipo=z.enum(tipos).parse(req.params.tipo),actor=res.locals.actor,org=actor.idOrganizacion;
  const entrada=z.object({archivo:z.string(),asociaciones:z.record(z.string().max(400),z.string().uuid()).default({}),huella:z.string().optional(),confirmar:z.boolean().optional()}).strict().parse(req.body);
  if(Object.keys(entrada.asociaciones).length>200){res.status(422).json({detalle:'Máximo 200 asociaciones'});return;}
  const necesarias=tipo==='candidatos'?['nombre']:tipo==='mesas'?['codigo','unidad']:['usuario','codigoMesa'];
  const {filas,buffer}=await leerExcel(entrada.archivo,columnasGenerales(tipo),['cargo','ambito',...necesarias],2000);
  const operadores=await resolverOperadores(req,org,filas,tipo);
  async function cargar(c:Pool|PoolClient){return (await c.query('SELECT id,cargo,estado,configuracion FROM tuvoto_procesos WHERE id_organizacion=$1 AND NOT archivado AND NOT eliminada',[org])).rows as Proceso[];}
  function huellaDe(destinos:ReturnType<typeof resolverDestinos>,procesos:Proceso[]){
   // Vincula la confirmación a los IDs y al contexto realmente revisados, sin confiar en etiquetas del cliente.
   const contexto=destinos.referencias.map(r=>{const p=procesos.find(p=>p.id===r.idProceso);return [r.referencia,r.idProceso,p?.cargo,p?.configuracion.ambito??'',p?.configuracion.vuelta??1];}).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
   return huellaExcel(buffer,JSON.stringify([actor.idUsuario,org,tipo,contexto]));
  }
  async function validar(c:Pool|PoolClient,procesos:Proceso[]){
   const destinos=resolverDestinos(filas,procesos,entrada.asociaciones),errores=[...destinos.errores],registros=new Map<string,any[]>(),vista:any[]=[];
   for(const [id,grupo] of destinos.grupos){
    const p=procesos.find(p=>p.id===id)!;
    const v=await validarFilasProceso(c,p,grupo,tipo,operadores);errores.push(...v.errores);registros.set(id,v.registros);
    for(const {origen,idMesa,idUsuario,...r} of v.registros)vista.push({fila:r.fila,cargo:p.cargo,ambito:p.configuracion.ambito??'',vuelta:p.configuracion.vuelta??1,...r});
   }
   return {destinos,errores,registros,vista:vista.sort((a,b)=>a.fila-b.fila),huella:huellaDe(destinos,procesos)};
  }
  const procesos=await cargar(db);
  if(accion==='previsualizar'){
   const v=await validar(db,procesos);
   res.json({huella:v.huella,total:filas.length,errores:v.errores,filas:v.vista,referencias:v.destinos.referencias});return;
  }
  const previo=resolverDestinos(filas,procesos,entrada.asociaciones);
  if(!entrada.confirmar||entrada.huella!==huellaDe(previo,procesos)||previo.errores.length){res.status(409).json({detalle:'Revisa y confirma el archivo completo con sus destinos válidos'});return;}
  const c=await db.connect();
  try{
   await c.query('BEGIN');
   const ids=[...previo.grupos.keys()].sort();
   // Orden estable entre lotes: serializa con edición, inicio y otras importaciones.
   for(const id of ids)await c.query('SELECT id FROM tuvoto_procesos WHERE id=$1 AND id_organizacion=$2 FOR UPDATE',[id,org]);
   const actuales=await cargar(c),v=await validar(c,actuales);
   if(v.huella!==entrada.huella||v.errores.length||[...v.destinos.grupos.keys()].some(id=>!ids.includes(id))){
    await c.query('ROLLBACK');res.status(409).json({detalle:'Cambió un destino o hay errores; no se importó nada',errores:v.errores});return;
   }
   for(const [id,registros] of v.registros)await guardarFilasProceso(c,id,tipo,registros);
   await c.query('COMMIT');res.status(201).json({importados:filas.length,cargos:v.registros.size});
  }catch(e:any){await c.query('ROLLBACK');res.status(e.code==='23505'?409:e.estado??503).json({detalle:'No se importó ningún registro; vuelve a previsualizar'});}finally{c.release();}
 });
}
