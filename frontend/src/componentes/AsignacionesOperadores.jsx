import EditarOperador from './EditarOperador.jsx';
import ImportarExcel from './ImportarExcel.jsx';
import { agruparMesasFisicas } from '../api/mesasCompartidas.js';
import { asignarMesasOperador, distribuirMesasPendientes, listarOperadoresInstitucion } from '../api/operadores.js';
import { notificarExito } from '../api/confirmaciones.js';
import React,{useEffect,useState} from 'react';
import {solicitarRest} from '../api/clienteRest.js';
import {nombresEstado} from '../api/catalogos.js';

export default function AsignacionesOperadores({organizacion,cuentas,version,alCargo,procesos,nombreOrganizacion,alGuardar,alRevocar,idActual,ocupado=false}){
 const [edicion,setEdicion]=useState(null),[soloPendientes,setSoloPendientes]=useState(false);
 const [asignaciones,setAsignaciones]=useState(null),[error,setError]=useState(''),[usuario,setUsuario]=useState(''),[busqueda,setBusqueda]=useState(''),[intento,setIntento]=useState(0);
 const [pagina,setPagina]=useState(1),[limite,setLimite]=useState(10),[expandidos,setExpandidos]=useState(new Set()),[distribuyendo,setDistribuyendo]=useState(false);
 useEffect(()=>{let vigente=true;setAsignaciones(null);setError('');solicitarRest('/configuracion/asignaciones',{organizacion}).then(r=>{if(vigente)setAsignaciones(r.elementos);}).catch(e=>{if(vigente)setError(e.message);});return()=>{vigente=false};},[organizacion,version,intento]);
 const operadores=listarOperadoresInstitucion({cuentas,asignaciones:asignaciones??[],organizacion});
 const grupos=listarOperadoresInstitucion({cuentas,asignaciones:asignaciones??[],organizacion,busqueda,idUsuario:usuario,soloPendientes});
 const paginas=Math.max(1,Math.ceil(grupos.length/limite)),actual=Math.min(pagina,paginas),inicio=(actual-1)*limite;
 const cargando=asignaciones===null,deshabilitado=ocupado||cargando||!!error;
 function alternar(id){setExpandidos(prev=>{const siguiente=new Set(prev);if(siguiente.has(id))siguiente.delete(id);else siguiente.add(id);return siguiente;});}
 async function distribuir(){
  if(deshabilitado||distribuyendo)return;
  const grupos=distribuirMesasPendientes({cuentas,asignaciones:asignaciones??[],procesos,organizacion});
  const total=grupos.reduce((n,g)=>n+g.mesas.length,0);
  if(!total){setError('No hay mesas pendientes ni operadores activos para distribuir.');return;}
  if(!window.confirm(`Se repartirán ${total} mesas pendientes entre ${grupos.length} operadores activos. ¿Continuar?`))return;
  setDistribuyendo(true);setError('');
  try{
   for(const grupo of grupos)await asignarMesasOperador({pedir:solicitarRest,organizacion,idUsuario:grupo.idUsuario,mesas:grupo.mesas,completadas:new Set()});
   alGuardar();notificarExito(`${total} mesas distribuidas entre ${grupos.length} operadores.`);
  }catch(e){setError(e.message);}
  finally{setDistribuyendo(false);}
 }
 return <section className="operadores-recepcion" aria-label="Asignar operadores">
  <header className="cabecera-operadores-recepcion"><div><h2>Asignar operadores</h2><p>{nombreOrganizacion}</p></div><div className="acciones-cabecera-operadores">
   <details className="menu-importar-operadores"><summary className="boton secundario">Importar Excel <span aria-hidden="true">⌄</span></summary><div>
    <ImportarExcel ruta="/importaciones/operadores" organizacion={organizacion} titulo="operadores" textoBoton="Operadores y mesas" operadores alImportar={alGuardar}/>
    <ImportarExcel general cargos={procesos} ruta="/configuracion/importaciones-generales/asignaciones" organizacion={organizacion} titulo="asignaciones" textoBoton="Asignaciones existentes" alImportar={alGuardar}/>
   </div></details>
   <button type="button" className="boton secundario" disabled={deshabilitado||distribuyendo} onClick={distribuir}>{distribuyendo?'Distribuyendo…':'Distribuir mesas pendientes'}</button>
   <button type="button" className="boton primario" disabled={deshabilitado} onClick={()=>setEdicion('nuevo')}>＋ Crear operador</button>
  </div></header>
  <div className="filtros-operadores-recepcion panel-admin">
   <label><span className="solo-lectores-cargos">Buscar operador o mesa</span><input type="search" aria-label="Buscar operador o mesa" placeholder="Buscar operador, mesa, cargo o carrera…" value={busqueda} onChange={e=>{setBusqueda(e.target.value);setPagina(1);}}/></label>
   <label><span className="solo-lectores-cargos">Filtrar operador</span><select aria-label="Filtrar operador" value={usuario} onChange={e=>{setUsuario(e.target.value);setPagina(1);}}><option value="">Todos los operadores</option>{operadores.map(g=><option key={g.cuenta.idUsuario} value={g.cuenta.idUsuario}>{g.cuenta.usuario}</option>)}</select></label>
   <label className="filtro-sin-mesa"><input type="checkbox" checked={soloPendientes} onChange={e=>{setSoloPendientes(e.target.checked);setPagina(1);}}/>Solo sin mesa</label>
  </div>
  <section className="directorio-operadores-recepcion panel-admin" aria-labelledby="titulo-mesas-operador"><h3 id="titulo-mesas-operador">Operadores y asignaciones</h3>
   {error?<div role="alert"><p>{error}</p><button type="button" className="boton secundario" onClick={()=>setIntento(v=>v+1)}>Reintentar</button></div>:cargando?<p role="status">Cargando asignaciones…</p>:<>
    <div className="tabla-operadores-scroll"><table className="tabla-operadores-recepcion"><thead><tr><th>Operador</th><th>Mesas</th><th>Cargos</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{grupos.slice(inicio,inicio+limite).map(({cuenta,mesas})=>{
     const fisicas=agruparMesasFisicas(mesas),abierto=expandidos.has(cuenta.idUsuario);
     const autorizado=cuenta.activo&&cuenta.roles?.some(r=>r.rol==='OPERADOR'&&r.idOrganizacion===organizacion)&&!cuenta.roles.some(r=>r.rol==='ADMINISTRADOR'&&(r.idOrganizacion===null||r.idOrganizacion===organizacion));
     return <React.Fragment key={cuenta.idUsuario}><tr data-operador={cuenta.idUsuario} className={abierto?'operador-expandido':''}>
      <td><strong>{cuenta.usuario}</strong></td><td>{fisicas.length?<div className="resumen-mesas-operador"><button type="button" className="desplegar-mesas-operador" aria-label={'Ver mesas de '+cuenta.usuario} aria-expanded={abierto} aria-controls={'mesas-operador-'+cuenta.idUsuario} onClick={()=>alternar(cuenta.idUsuario)}>{abierto?'⌄':'›'}</button><span className="codigo-mesa-operador">{fisicas[0].codigo}</span><span className="cantidad-mesas-operador">{fisicas.length} {fisicas.length===1?'mesa':'mesas'}</span></div>:'Sin mesa'}</td>
      <td>{mesas.length?mesas.length+(mesas.length===1?' cargo':' cargos'):'—'}</td><td><span className={'estado-operador-recepcion '+(!cuenta.activo?'inactivo':mesas.length?'asignado':'pendiente')}>{!cuenta.activo?'Inactivo':mesas.length?'Asignado':'Sin asignar'}</span></td>
      <td><div className="acciones-fila-operador"><button type="button" className="boton secundario" disabled={deshabilitado||!autorizado} onClick={()=>setEdicion(cuenta)}>{mesas.length?'Editar mesas':'Asignar mesas'}</button>
       {cuenta.idUsuario!==idActual&&cuenta.roles?.some(r=>r.rol==='OPERADOR'&&r.idOrganizacion===organizacion)&&<details className="menu-operador-recepcion"><summary aria-label={'Opciones de '+cuenta.usuario}>⋯</summary><div><button type="button" className="boton boton-peligro" disabled={deshabilitado} onClick={()=>{if(window.confirm('¿Revocar el rol de operador de esta institución?'))alRevocar(cuenta);}}>Revocar operador</button></div></details>}
      </div></td>
     </tr>{abierto&&fisicas.length>0&&<tr className="detalle-fila-operador" id={'mesas-operador-'+cuenta.idUsuario}><td colSpan={5}><div className="mesas-detalle-operador">{fisicas.map(g=><section key={g.id} data-asignacion-mesa-fisica={g.id}><strong>{g.codigo} · {g.sector||'General'}</strong><p>{g.unidad}</p><ul>{g.cargos.map(m=><li key={m.idMesa}><div><strong>{m.cargo}</strong><span>{m.ambito||'Toda la institución'} · {nombresEstado[m.estado]??m.estado}</span></div><button type="button" className="boton secundario" disabled={ocupado} onClick={()=>alCargo(m.idProceso)}>Ver cargo</button></li>)}</ul></section>)}</div></td></tr>}</React.Fragment>;
    })}</tbody></table></div>
    {!grupos.length&&<p>No hay operadores que coincidan con los filtros.</p>}
    <footer className="paginacion-operadores"><label>Filas por página<select aria-label="Filas por página" value={limite} onChange={e=>{setLimite(Number(e.target.value));setPagina(1);}}>{[10,25,50].map(n=><option key={n} value={n}>{n}</option>)}</select></label><span role="status">{grupos.length?inicio+1:0}–{Math.min(inicio+limite,grupos.length)} de {grupos.length}</span><nav aria-label="Páginas de operadores"><button type="button" className="boton secundario" disabled={actual===1} onClick={()=>setPagina(actual-1)}>‹ Anterior</button><span aria-current="page">{actual}</span><button type="button" className="boton secundario" disabled={actual===paginas} onClick={()=>setPagina(actual+1)}>Siguiente ›</button></nav></footer>
   </>}
  </section>
  {edicion&&<EditarOperador cuenta={edicion==='nuevo'?null:edicion} organizacion={organizacion} nombreOrganizacion={nombreOrganizacion} procesos={procesos} asignaciones={asignaciones} alCerrar={()=>setEdicion(null)} alGuardar={alGuardar}/>}
 </section>;
}
