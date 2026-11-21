import React from 'react';
import ConfirmarEliminacion from './ConfirmarEliminacion.jsx';
import { nombresEstado } from './EstadoEleccion.jsx';
import { agruparCargos } from '../api/seleccionAdministracion.js';
export default function SeleccionAdministracion({organizacion,procesos,idProceso,ocupado,cargando,disponible,alProceso,alAgregar,alEliminar,alReintentar}) {
 if (!organizacion) return null;
 const grupos=agruparCargos(procesos);
 return <section id="cargos-de-institucion" className="panel-admin seleccion-administracion" aria-labelledby="titulo-seleccion-administracion">
  <header className="cabecera-lista-cargos"><div><p className="etiqueta-panel">INSTITUCIÓN SELECCIONADA</p><h2 id="titulo-seleccion-administracion">Elegir o crear un cargo</h2><p>Crea uno nuevo o abre un grupo para elegir un cargo ya guardado.</p></div><button type="button" className="boton primario agregar-cargo" disabled={ocupado||!disponible} onClick={alAgregar}>+ Crear nuevo cargo</button></header>
  {cargando ? <p role="status">Cargando cargos…</p> : !disponible ? <div><p role="alert">No se pudo cargar el listado de cargos.</p><button type="button" className="boton secundario" disabled={ocupado} onClick={alReintentar}>Reintentar</button></div> : procesos.length ? <><h3 className="titulo-cargos-existentes">Cargos existentes</h3><p className="total-cargos-agrupados">{procesos.length} {procesos.length===1?'cargo':'cargos'} · {grupos.length} {grupos.length===1?'grupo':'grupos'}. Se incluyen los cargos archivados.</p><div className="grupos-cargos-institucion">{grupos.map(g=><details key={organizacion+':'+g.id} className="grupo-cargos-institucion" data-grupo-cargos={g.id}>
   <summary aria-label={`${g.nombre}: ${g.cantidad} ${g.cantidad===1?'cargo':'cargos'}`}><span className="nombre-grupo-cargos">{g.nombre}</span><span className="cantidad-grupo-cargos" data-cantidad={g.cantidad}>{g.cantidad}<small>{g.cantidad===1?'cargo':'cargos'}</small></span><span className="flecha-grupo-cargos" aria-hidden="true">⌄</span></summary>
   <ul className="lista-cargos-institucion">{g.procesos.map(p=><li key={p.id}>
   <button type="button" className="cargo-institucion" data-cargo={p.id} aria-pressed={p.id===idProceso} disabled={ocupado} onClick={()=>alProceso(p.id)}>
    <div className="nombre-cargo-listado"><strong>{p.cargo}</strong><span>{p.ambito||'Sin ámbito adicional'} · {p.vuelta===2?'Segunda vuelta':'Primera vuelta'}</span><small>{p.nombre}</small></div>
    <div className="datos-cargo-listado"><span>{p.candidatos.length} candidatos · {p.mesas.length} mesas</span><span className={`etiqueta-estado estado-${p.estado}`}>{nombresEstado[p.estado]??'Estado no disponible'}</span><span className="abrir-cargo">{p.estado==='borrador'?'Continuar preparación':'Ver cargo'} →</span></div>
   </button>
   {p.estado==='borrador'&&alEliminar&&<ConfirmarEliminacion nombre={p.cargo+' · '+(p.ambito||p.nombre)} ocupado={ocupado} descripcion="Se retirará este cargo con su catálogo del panel. Los registros se conservan; no se eliminan resultados publicados." alConfirmar={()=>alEliminar(p)}/>}
  </li>)}</ul>
  </details>)}</div></> : <div className="sin-cargos-institucion"><h3>Todavía no has agregado cargos</h3><p>Pulsa «Crear nuevo cargo» para registrar Rector, Vicerrector, Decano u otro cargo.</p></div>}
 </section>;
}
