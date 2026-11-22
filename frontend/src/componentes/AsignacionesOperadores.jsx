import EditarOperador from './EditarOperador.jsx';
import ImportarExcel from './ImportarExcel.jsx';
import { agruparMesasFisicas } from '../api/mesasCompartidas.js';
import React,{useEffect,useState} from 'react';
import {solicitarRest} from '../api/clienteRest.js';
import {nombresEstado} from './EstadoEleccion.jsx';
export default function AsignacionesOperadores({organizacion,cuentas,version,alCargo,procesos,nombreOrganizacion,alGuardar,alRevocar,idActual}){
 const [edicion,setEdicion]=useState(null),[soloPendientes,setSoloPendientes]=useState(false);
 const [asignaciones,setAsignaciones]=useState(null),[error,setError]=useState(''),[usuario,setUsuario]=useState(''),[busqueda,setBusqueda]=useState(''),[intento,setIntento]=useState(0);
 useEffect(()=>{let vigente=true;setAsignaciones(null);setError('');solicitarRest('/configuracion/asignaciones',{organizacion}).then(r=>{if(vigente)setAsignaciones(r.elementos);}).catch(e=>{if(vigente)setError(e.message);});return()=>{vigente=false};},[organizacion,version,intento]);
 const cuentasPorId=new Map(cuentas.filter(c=>c.roles?.some(r=>r.rol==='OPERADOR'&&r.idOrganizacion===organizacion)).map(c=>[c.idUsuario,c]));
 for(const a of asignaciones??[])if(!cuentasPorId.has(a.idUsuario))cuentasPorId.set(a.idUsuario,cuentas.find(c=>c.idUsuario===a.idUsuario)??{idUsuario:a.idUsuario,usuario:'Cuenta no disponible',activo:false});
 const operadores=[...cuentasPorId.values()].sort((a,b)=>a.usuario.localeCompare(b.usuario,'es'));
 const consulta=busqueda.trim().toLocaleLowerCase('es');
 const grupos=operadores.filter(c=>!usuario||usuario===c.idUsuario).map(c=>({cuenta:c,mesas:(asignaciones??[]).filter(a=>a.idUsuario===c.idUsuario)})).filter(g=>!soloPendientes||!g.mesas.length).sort((a,b)=>Number(Boolean(a.mesas.length))-Number(Boolean(b.mesas.length))||a.cuenta.usuario.localeCompare(b.cuenta.usuario,'es')).filter(g=>!consulta||[g.cuenta.usuario,...g.mesas.flatMap(m=>[m.codigo,m.cargo,m.ambito,m.unidad])].some(v=>String(v??'').toLocaleLowerCase('es').includes(consulta)));
 return <section className="panel-admin mesas-por-operador" aria-labelledby="titulo-mesas-operador"><h2 id="titulo-mesas-operador">Operadores de esta institución</h2><p>Crea operadores y consulta sus mesas. Las cuentas sin asignación quedan pendientes.</p>
 {error?<div role="alert"><p>{error}</p><button type="button" className="boton secundario" onClick={()=>setIntento(v=>v+1)}>Reintentar</button></div>:asignaciones===null?<p role="status">Cargando asignaciones…</p>:<><div className="filtros-mesas-operador"><label>Operador<select aria-label="Filtrar operador" value={usuario} onChange={e=>setUsuario(e.target.value)}><option value="">Todos los operadores</option>{operadores.map(c=><option key={c.idUsuario} value={c.idUsuario}>{c.usuario}</option>)}</select></label><label>Buscar mesa, cargo o carrera<input type="search" value={busqueda} onChange={e=>setBusqueda(e.target.value)}/></label><label className="filtro-pendientes-operador"><input type="checkbox" checked={soloPendientes} onChange={e=>setSoloPendientes(e.target.checked)}/>Solo sin mesa</label></div>
 {grupos.length?<div className="grupos-mesas-operador tabla-preparacion-scroll"><table className="tabla-admin tabla-operadores"><thead><tr><th>Usuario</th><th>Mesas asignadas</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{grupos.map(({cuenta,mesas})=>{
 const fisicas=agruparMesasFisicas(mesas);
 const autorizado=cuenta.activo&&cuenta.roles?.some(r=>r.rol==='OPERADOR'&&r.idOrganizacion===organizacion)&&!cuenta.roles.some(r=>r.rol==='ADMINISTRADOR'&&(r.idOrganizacion===null||r.idOrganizacion===organizacion));
 return <tr key={cuenta.idUsuario} data-operador={cuenta.idUsuario}><td><strong>{cuenta.usuario}</strong></td><td>{fisicas.length?<><span>{fisicas.length} mesas · {mesas.length} cargos</span><div className="mesas-fisicas-operador">{fisicas.map(g=><details key={g.id} data-asignacion-mesa-fisica={g.id}><summary>{g.codigo} · {g.unidad} · {g.sector}</summary><ul>{g.cargos.map(m=><li key={m.idMesa}><div><strong>{m.cargo}</strong><span>{m.ambito||'Toda la institución'}</span><small>{nombresEstado[m.estado]??m.estado}</small></div><button type="button" className="boton secundario" onClick={()=>alCargo(m.idProceso)}>Ver cargo</button></li>)}</ul></details>)}</div></>:<span>Sin mesa</span>}</td><td><span className={'insignia-estado '+(!cuenta.activo?'inactivo':mesas.length?'activo':'pendiente')}>{!cuenta.activo?'Inactivo':mesas.length?'Asignado':'Pendiente de asignación'}</span></td><td><div className="acciones-operador"><button type="button" className="boton secundario" disabled={!autorizado} onClick={()=>setEdicion(cuenta)}>Editar mesas</button>{cuenta.idUsuario!==idActual&&cuenta.roles?.some(r=>r.rol==='OPERADOR'&&r.idOrganizacion===organizacion)&&<button type="button" className="boton secundario" onClick={()=>{if(window.confirm('¿Revocar el rol de operador de esta institución?'))alRevocar(cuenta);}}>Revocar operador</button>}</div></td></tr>;
 })}</tbody></table></div>:<p>No hay operadores que coincidan con los filtros.</p>}

 </>}
 <div className="acciones-operadores"><button type="button" className="boton primario" disabled={asignaciones===null||!!error} onClick={()=>setEdicion('nuevo')}>Crear operador</button>
 <ImportarExcel ruta="/importaciones/operadores" organizacion={organizacion} titulo="operadores" operadores alImportar={alGuardar}/>
 <ImportarExcel general cargos={procesos} ruta="/configuracion/importaciones-generales/asignaciones" organizacion={organizacion} titulo="asignaciones" alImportar={alGuardar}/></div>
 {edicion&&<EditarOperador cuenta={edicion==='nuevo'?null:edicion} organizacion={organizacion} nombreOrganizacion={nombreOrganizacion} procesos={procesos} asignaciones={asignaciones??[]} alCerrar={()=>setEdicion(null)} alGuardar={alGuardar}/>}
 </section>;
}
