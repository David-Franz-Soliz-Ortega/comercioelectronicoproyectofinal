import { resumirInstitucion } from '../api/estadoInstitucion.js';
import React,{useEffect,useState} from 'react';
import { solicitarRest } from '../api/clienteRest.js';
import { notificarExito } from '../api/confirmaciones.js';

export default function ConteoInstitucion({organizacion,nombre,procesos,ocupado,alGuardar,alOcupado,revision}){
 const [accion,setAccion]=useState(''),[confirmado,setConfirmado]=useState(false),[guardando,setGuardando]=useState(false),[error,setError]=useState('');
 const [asignaciones,setAsignaciones]=useState(null),[errorAsignaciones,setErrorAsignaciones]=useState(''),[intento,setIntento]=useState(0);
 useEffect(()=>{let vigente=true;setAsignaciones(null);setErrorAsignaciones('');solicitarRest('/configuracion/asignaciones',{organizacion}).then(r=>{if(vigente)setAsignaciones(r.elementos);}).catch(e=>{if(vigente)setErrorAsignaciones(e.message);});return()=>{vigente=false;};},[organizacion,revision,intento]);
 const resumen=resumirInstitucion(procesos,asignaciones);
 const borradores=procesos.filter(p=>p.estado==='borrador'),abiertos=procesos.filter(p=>p.estado==='recepcion');
 const bloqueado=ocupado||guardando;
 async function guardar(){
  if(bloqueado||!confirmado)return;setGuardando(true);alOcupado?.(true);setError('');
  try{const r=await solicitarRest('/configuracion/institucion/'+accion,{metodo:'POST',organizacion,datos:{confirmar:true},mostrarDetalleValidacion:true});setAccion('');setConfirmado(false);alGuardar();notificarExito(r.actualizados+' cargos '+(accion==='iniciar'?'habilitados para recibir actas.':'cerrados; resultados conservados.'));}
  catch(e){setError(e.message);}finally{setGuardando(false);alOcupado?.(false);}
 }
 return <section className="panel-admin conteo-institucion"><header className="cabecera-revision-publicacion"><h2>Estado y publicación · Toda la organización</h2><p>{nombre}</p><span className="etiqueta-estado">{resumen.estado}</span></header>
 <div className="indicadores-estado-institucion">{[[resumen.cargos.length,'Cargos'],[resumen.candidaturas,'Candidaturas'],[resumen.mesasFisicas,'Mesas físicas'],[resumen.actasEsperadas,'Actas esperadas'],[resumen.operadores??'—','Operadores con asignación']].map(([valor,etiqueta])=><article key={etiqueta}><strong>{valor}</strong><span>{etiqueta}</span></article>)}</div>
 {errorAsignaciones?<p role="alert" className="aviso">{errorAsignaciones} <button type="button" className="boton secundario" onClick={()=>setIntento(v=>v+1)}>Reintentar asignaciones</button></p>:asignaciones===null?<p role="status">Consultando asignaciones de la organización…</p>:<p>{!resumen.actasEsperadas?'Aún no hay mesas configuradas.':resumen.mesasSinOperador===0?'Todas las actas esperadas tienen operador asignado.':resumen.mesasSinOperador+' actas por cargo sin operador asignado.'}</p>}
 <div className="tabla-preparacion-scroll"><table className="tabla-admin"><thead><tr><th>Cargo y ámbito</th><th>Candidaturas</th><th>Actas esperadas</th><th>Estado</th></tr></thead><tbody>{resumen.cargos.map(p=><tr key={p.id}><td><strong>{p.cargo}</strong>{p.ambito&&<span className="ambito-estado-institucion">{p.ambito}</span>}</td><td>{p.candidatos?.length??0}</td><td>{p.mesas?.length??0}</td><td>{{borrador:'En preparación',recepcion:'En recepción',cerrada:'Finalizada'}[p.estado]??p.estado}</td></tr>)}</tbody></table>{!resumen.cargos.length&&<p>No hay cargos configurados en esta organización.</p>}</div>
 <p>{borradores.length} cargos en preparación · {abiertos.length} en recepción. Los destacados de portada se eligen aparte.</p>
 <div className="acciones-estado"><button type="button" className="boton primario" disabled={bloqueado||!borradores.length} onClick={()=>{setAccion('iniciar');setConfirmado(false);setError('');}}>Iniciar conteo de la institución</button><button type="button" className="boton secundario" disabled={bloqueado||!abiertos.length} onClick={()=>{setAccion('terminar');setConfirmado(false);setError('');}}>Terminar conteo de la institución</button></div>
 {accion&&<div className="confirmacion-estado"><p>{accion==='iniciar'?'Se bloqueará la configuración de todos los cargos en borrador. Si falta configurar alguno, no se iniciará ninguno.':'Se detendrá la recepción de actas de todos los cargos abiertos de esta institución. Se conservarán sus datos y resultados.'}</p><label><input type="checkbox" disabled={bloqueado} checked={confirmado} onChange={e=>setConfirmado(e.target.checked)}/>Confirmo la acción para toda la institución.</label><div className="acciones-estado"><button type="button" className="boton primario" disabled={bloqueado||!confirmado} onClick={guardar}>{guardando?'Guardando…':'Confirmar'}</button><button type="button" className="boton secundario" disabled={bloqueado} onClick={()=>setAccion('')}>Cancelar</button></div></div>}
 {error&&<p className="aviso" role="alert">{error}</p>}
 </section>;
}
