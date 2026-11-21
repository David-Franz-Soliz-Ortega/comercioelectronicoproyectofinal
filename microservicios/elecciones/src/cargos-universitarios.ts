import type { Express } from 'express';
import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { leerExcel, plantillaExcel, huellaExcel, type FilaExcel } from './excel.js';
import { esquemaProceso, opciones, unidadValida } from './modelo.js';
export const cargosUniversitarios = ['Rector','Vicerrector','Decano','Director'];
const columnas=['cargo','facultad','grupoCarreras','carreras'];
const normalizar=(v:string)=>v.normalize('NFKC').trim().toLocaleLowerCase('es');
export function prepararCargoUniversitario(d:Record<string,string>,nombre:string){
 const cargo=cargosUniversitarios.find(c=>normalizar(c)===normalizar(d.cargo??''));
 if(!cargo)throw Error('Cargo permitido: Rector, Vicerrector, Decano o Director');
 const facultad=(d.facultad??'').trim(),grupoCarreras=(d.grupoCarreras??'').trim();
 const carreras=(d.carreras??'').split(';').map(c=>c.trim()).filter(Boolean);
 if((cargo==='Decano'||cargo==='Director')&&!facultad)throw Error('Indica la facultad del cargo');
 if(cargo==='Director'&&(!grupoCarreras||!carreras.length))throw Error('Director requiere grupoCarreras y carreras separadas por punto y coma');
 if((cargo==='Rector'||cargo==='Vicerrector')&&(facultad||grupoCarreras||carreras.length))throw Error('Rector y Vicerrector corresponden a toda la universidad; deja vacías las demás columnas');
 if(cargo==='Decano'&&grupoCarreras)throw Error('Decano abarca la facultad; los grupos de carreras corresponden a Director');
 return esquemaProceso.parse({nombre,cargo,tipo:'universidad',unidad:cargo==='Rector'||cargo==='Vicerrector'?'Facultad':'Carrera',ambito:cargo==='Director'?`${facultad} · ${grupoCarreras}`:facultad||'Toda la universidad',facultad,grupoCarreras,carreras});
}
export async function comprobarGrupoDirector(c:Pool|PoolClient,org:string,p:ReturnType<typeof prepararCargoUniversitario>,excepto:string|null=null){
 if(p.cargo!=='Director'||!p.facultad||!p.carreras.length)return;
 const otros=(await c.query("SELECT configuracion FROM tuvoto_procesos WHERE id_organizacion=$1 AND cargo='Director' AND NOT eliminada AND estado<>'archivada' AND ($2::uuid IS NULL OR id<>$2)",[org,excepto])).rows;
 if(otros.some(r=>normalizar(r.configuracion.facultad??'')===normalizar(p.facultad)&&(r.configuracion.vuelta??1)===p.vuelta&&(normalizar(r.configuracion.grupoCarreras??'')===normalizar(p.grupoCarreras)||r.configuracion.carreras?.some((carrera:string)=>p.carreras.some(v=>normalizar(v)===normalizar(carrera))))))throw Object.assign(Error('Una carrera ya pertenece a otro Director de esta facultad y vuelta'),{estado:409});
}
type AccionExistente='mantener'|'reemplazar';
type CargoExistente={id:string;nombre:string;cargo:string;tipo:string;unidad:string;estado:string;configuracion:any;tieneReferencia?:boolean};
type RegistroCargo={fila:number;datos:ReturnType<typeof prepararCargoUniversitario>;accion:'crear'|AccionExistente;existente?:CargoExistente};
const claveCargo=(cargo:string,ambito:string)=>JSON.stringify([normalizar(cargo),['rector','vicerrector'].includes(normalizar(cargo))?'universidad':normalizar(ambito)]);
export function motivoBloqueoReemplazo(p:CargoExistente){
 if(p.estado!=='borrador')return 'Solo puedes reemplazar la configuración de un cargo en borrador';
 if(p.tipo!=='universidad')return 'Este cargo no pertenece a una configuración universitaria';
 if(p.tieneReferencia)return 'Otra vuelta depende de este cargo; conserva su configuración';
 return null;
}
export function configuracionReemplazo(actual:CargoExistente,datos:ReturnType<typeof prepararCargoUniversitario>){
 const motivo=motivoBloqueoReemplazo(actual);if(motivo)throw Error(motivo);
 if((actual.configuracion.vuelta??1)!==1||claveCargo(actual.cargo,actual.configuracion.ambito??'')!==claveCargo(datos.cargo,datos.ambito))throw Error('El cargo o ámbito no corresponde al registro existente');
 // El Excel no redefine estado, nombre del proceso, sectores, pesos, reglas, vuelta ni referencias.
 return {unidad:datos.carreras.length?'Carrera':actual.unidad,configuracion:{...actual.configuracion,facultad:datos.facultad,grupoCarreras:datos.grupoCarreras,carreras:datos.carreras}};
}
export function planificarImportacionCargos(filas:FilaExcel[],existentes:CargoExistente[],nombre:string,resoluciones:Record<string,AccionExistente>={}){
 const registros:RegistroCargo[]=[],errores:{fila:number;mensaje:string}[]=[],coincidencias:any[]=[],vistos=new Set<string>();
 for(const f of filas){try{
  const p=prepararCargoUniversitario(f.datos,nombre),k=claveCargo(p.cargo,p.ambito);
  if(vistos.has(k))throw Error('El cargo y ámbito se repiten dentro del archivo');vistos.add(k);
  const encontrados=existentes.filter(e=>(e.configuracion.vuelta??1)===1&&claveCargo(e.cargo,e.configuracion.ambito??'')===k);
  if(encontrados.length>1)throw Error('Varios cargos existentes coinciden; no se puede elegir uno automáticamente');
  const existente=encontrados[0],accion=existente?(resoluciones[String(f.fila)]??'mantener'):'crear';
  if(existente){
   const motivo=motivoBloqueoReemplazo(existente);
   coincidencias.push({fila:f.fila,cargo:p.cargo,ambito:existente.configuracion.ambito??'',estado:existente.estado,accion,puedeReemplazar:!motivo,motivo});
   if(accion==='reemplazar')configuracionReemplazo(existente,p);
  }
  registros.push({fila:f.fila,datos:p,accion,existente});
 }catch(e:any){errores.push({fila:f.fila,mensaje:e instanceof z.ZodError?'Revisa longitud, carreras repetidas y configuración del cargo':e.message});}}
 // Comprobar el catálogo final, permitiendo liberar carreras sin mezclar Directores.
 const reemplazados=new Set(registros.filter(r=>r.accion==='reemplazar').map(r=>r.existente!.id));
 const catalogo=existentes.filter(e=>!reemplazados.has(e.id)&&(e.configuracion.vuelta??1)===1).map(e=>({id:e.id,cargo:e.cargo,configuracion:e.configuracion}));
 for(const r of registros.filter(r=>r.accion!=='mantener'))catalogo.push({id:r.existente?.id??'fila:'+r.fila,cargo:r.datos.cargo,configuracion:opciones(r.datos)});
 for(const r of registros.filter(r=>r.accion!=='mantener'&&r.datos.cargo==='Director')){
  const p=r.datos,id=r.existente?.id??'fila:'+r.fila;
  if(catalogo.some(e=>e.id!==id&&e.cargo==='Director'&&normalizar(e.configuracion.facultad??'')===normalizar(p.facultad)&&(normalizar(e.configuracion.grupoCarreras??'')===normalizar(p.grupoCarreras)||e.configuracion.carreras?.some((v:string)=>p.carreras.some(c=>normalizar(c)===normalizar(v))))))errores.push({fila:r.fila,mensaje:'Una carrera o grupo ya está asignado a otro Director de esta facultad'});
 }
 return {registros,errores,coincidencias};
}
export function rutasCargosUniversitarios(app:Express,db:Pool){
 const base='/api/v1/configuracion/importaciones/cargos';
 app.get(base+'/plantilla',async(_req,res)=>{res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment('cargos.xlsx').send(await plantillaExcel(columnas));});
 for(const accion of ['previsualizar','confirmar'])app.post(base+'/'+accion,async(req,res)=>{
  const entrada=z.object({nombre:z.string().trim().min(1).max(120),archivo:z.string(),resoluciones:z.record(z.string().regex(/^[0-9]{1,3}$/),z.enum(['mantener','reemplazar'])).default({}),huella:z.string().optional(),confirmar:z.boolean().optional()}).strict().parse(req.body);
  const actor=res.locals.actor,org=actor.idOrganizacion;
  const {filas,buffer}=await leerExcel(entrada.archivo,columnas,['cargo'],100);
  if(Object.keys(entrada.resoluciones).some(f=>!filas.some(r=>String(r.fila)===f))){res.status(422).json({detalle:'Las decisiones deben corresponder a filas del archivo'});return;}
  async function validar(c:Pool|PoolClient){
   const existentes=(await c.query("SELECT p.*,EXISTS(SELECT 1 FROM tuvoto_procesos v WHERE v.configuracion->>'idPrimeraVuelta'=p.id::text AND NOT v.eliminada) AS \"tieneReferencia\" FROM tuvoto_procesos p WHERE p.id_organizacion=$1 AND NOT p.eliminada AND p.estado<>'archivada' ORDER BY p.id",[org])).rows as CargoExistente[];
   const v=planificarImportacionCargos(filas,existentes,entrada.nombre,entrada.resoluciones);
   for(const r of v.registros.filter(r=>r.accion==='reemplazar')){
    const siguiente=configuracionReemplazo(r.existente!,r.datos);
    const mesas=(await c.query('SELECT unidad FROM tuvoto_mesas WHERE id_proceso=$1 AND NOT eliminada',[r.existente!.id])).rows;
    if(mesas.some(m=>!unidadValida(siguiente.configuracion,m.unidad)))v.errores.push({fila:r.fila,mensaje:'No puedes retirar una carrera que ya tiene mesas; no se modificará ningún registro'});
   }
   const contexto=v.registros.map(r=>[r.fila,r.accion,r.existente??null]);
   const huella=huellaExcel(buffer,JSON.stringify([actor.idUsuario,org,entrada.nombre,'cargos',contexto]));
   const resumen={creados:v.registros.filter(r=>r.accion==='crear').length,actualizados:v.registros.filter(r=>r.accion==='reemplazar').length,mantenidos:v.registros.filter(r=>r.accion==='mantener').length};
   return {...v,huella,resumen};
  }
  const previo=await validar(db);
  if(accion==='previsualizar'){
   res.json({huella:previo.huella,total:filas.length,errores:previo.errores,coincidencias:previo.coincidencias,resumen:previo.resumen,filas:previo.registros.map(({fila,datos:p,accion})=>({fila,cargo:p.cargo,facultad:p.facultad,grupoCarreras:p.grupoCarreras,carreras:p.carreras.join('; '),accion}))});return;
  }
  if(!entrada.confirmar||entrada.huella!==previo.huella||previo.errores.length){res.status(409).json({detalle:'Revisa y confirma el mismo archivo y las decisiones válidas',errores:previo.errores});return;}
  const c=await db.connect();try{
   await c.query('BEGIN');
   // Mismo orden que la edición manual: primero filas y después el bloqueo por institución.
   const ids=[...new Set(previo.registros.flatMap(r=>r.existente?[r.existente.id]:[]))].sort();
   for(const id of ids)await c.query('SELECT id FROM tuvoto_procesos WHERE id=$1 AND id_organizacion=$2 FOR UPDATE',[id,org]);
   await c.query('SELECT pg_advisory_xact_lock(hashtext($1),607004)',[org]);const v=await validar(c);
   if(v.errores.length||v.huella!==entrada.huella){await c.query('ROLLBACK');res.status(409).json({detalle:'Cambió el catálogo o hay errores; no se modificó ningún cargo',errores:v.errores});return;}
   for(const r of v.registros){const p=r.datos;
    if(r.accion==='crear')await c.query('INSERT INTO tuvoto_procesos(id,id_organizacion,nombre,cargo,tipo,unidad,configuracion) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),org,p.nombre,p.cargo,p.tipo,p.unidad,JSON.stringify(opciones(p))]);
    else if(r.accion==='reemplazar'){
     const siguiente=configuracionReemplazo(r.existente!,p);
     await c.query('UPDATE tuvoto_procesos SET unidad=$3,configuracion=$4 WHERE id=$1 AND id_organizacion=$2',[r.existente!.id,org,siguiente.unidad,JSON.stringify(siguiente.configuracion)]);
    }
   }
   await c.query('COMMIT');res.status(201).json({importados:v.resumen.creados+v.resumen.actualizados,...v.resumen});
  }catch(e:any){await c.query('ROLLBACK');res.status(e.estado??503).json({detalle:'No se modificó ningún cargo; vuelve a revisar el archivo'});}finally{c.release();}
 });
}
