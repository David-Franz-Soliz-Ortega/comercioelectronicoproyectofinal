import { agruparMesasFisicas } from '../api/mesasCompartidas.js';
import React,{useEffect,useState} from 'react';
import {solicitarRest} from '../api/clienteRest.js';
import {nombresEstado} from './EstadoEleccion.jsx';
export default function AsignacionesOperadores({organizacion,cuentas,version,alCargo}){
 const [asignaciones,setAsignaciones]=useState(null),[error,setError]=useState(''),[usuario,setUsuario]=useState(''),[busqueda,setBusqueda]=useState(''),[intento,setIntento]=useState(0);
 useEffect(()=>{let vigente=true;setAsignaciones(null);setError('');solicitarRest('/configuracion/asignaciones',{organizacion}).then(r=>{if(vigente)setAsignaciones(r.elementos);}).catch(e=>{if(vigente)setError(e.message);});return()=>{vigente=false};},[organizacion,version,intento]);
 const cuentasPorId=new Map(cuentas.filter(c=>c.roles?.some(r=>r.rol==='OPERADOR'&&r.idOrganizacion===organizacion)).map(c=>[c.idUsuario,c]));
 for(const a of asignaciones??[])if(!cuentasPorId.has(a.idUsuario))cuentasPorId.set(a.idUsuario,cuentas.find(c=>c.idUsuario===a.idUsuario)??{idUsuario:a.idUsuario,usuario:'Cuenta no disponible',activo:false});
 const operadores=[...cuentasPorId.values()].sort((a,b)=>a.usuario.localeCompare(b.usuario,'es'));
 const consulta=busqueda.trim().toLocaleLowerCase('es');
 const grupos=operadores.filter(c=>!usuario||usuario===c.idUsuario).map(c=>({cuenta:c,mesas:(asignaciones??[]).filter(a=>a.idUsuario===c.idUsuario)})).filter(g=>!consulta||[g.cuenta.usuario,...g.mesas.flatMap(m=>[m.codigo,m.cargo,m.ambito,m.unidad])].some(v=>String(v??'').toLocaleLowerCase('es').includes(consulta)));
 return <section className="panel-admin mesas-por-operador" aria-labelledby="titulo-mesas-operador"><h2 id="titulo-mesas-operador">Mesas de cada operador</h2><p>Consulta las asignaciones de esta institución. Cada mesa indica su cargo, ámbito y estado; los cargos archivados se conservan en su historial.</p>
 {error?<div role="alert"><p>{error}</p><button type="button" className="boton secundario" onClick={()=>setIntento(v=>v+1)}>Reintentar</button></div>:asignaciones===null?<p role="status">Cargando asignaciones…</p>:<><div className="filtros-mesas-operador"><label>Operador<select aria-label="Filtrar operador" value={usuario} onChange={e=>setUsuario(e.target.value)}><option value="">Todos los operadores</option>{operadores.map(c=><option key={c.idUsuario} value={c.idUsuario}>{c.usuario}</option>)}</select></label><label>Buscar mesa, cargo o carrera<input type="search" value={busqueda} onChange={e=>setBusqueda(e.target.value)}/></label></div>
 {grupos.length?<div className="grupos-mesas-operador">{grupos.map(({cuenta,mesas})=><article key={cuenta.idUsuario} data-operador={cuenta.idUsuario}><header><strong>{cuenta.usuario}</strong><span>{cuenta.activo?'Activo':'Inactivo'} · {agruparMesasFisicas(mesas).length} mesas · {mesas.length} cargos</span></header>{mesas.length?<div className="mesas-fisicas-operador">{agruparMesasFisicas(mesas).map(g=><section key={g.id} data-asignacion-mesa-fisica={g.id}><h3>Mesa {g.codigo} · {g.cargos.length} cargos</h3><p>{g.unidad} · {g.sector}</p><ul>{g.cargos.map(m=><li key={m.idMesa}><div><strong>{m.codigo} · {m.cargo}</strong><span>{m.ambito||'Sin ámbito adicional'} · {m.unidad} · {m.sector}</span><small>{nombresEstado[m.estado]??m.estado}</small></div><button type="button" className="boton secundario" onClick={()=>alCargo(m.idProceso)}>Ver cargo</button></li>)}</ul></section>)}</div>:<p>Sin mesas asignadas.</p>}</article>)}</div>:<p>No hay operadores que coincidan con los filtros.</p>}
 </>}
 </section>;
}
