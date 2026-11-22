import React, { useState } from 'react';
import { listarMesasInstitucion, agruparMesasPorFacultad } from '../api/mesasCompartidas.js';
import { nombresEstado } from '../api/catalogos.js';
import ConfirmarEliminacion from './ConfirmarEliminacion.jsx';

const normalizar = texto => String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
const nombreMesa = codigo => /^mesa\b/i.test(codigo) ? codigo : 'Mesa '+codigo;

export default function ListadoMesas({ procesos, sectores, ocupado, alCargo, alQuitar }) {
 const [busqueda,setBusqueda]=useState(''),[sector,setSector]=useState(''),[busquedaUnidad,setBusquedaUnidad]=useState('');
 const [idGrupo,setIdGrupo]=useState(''),[idMesa,setIdMesa]=useState('');
 const mesas=listarMesasInstitucion(procesos);
 const visibles=mesas.filter(m=>(!sector||m.sector===sector)&&normalizar([m.codigo,m.facultad,m.unidad,m.recinto,m.sector,...m.cargos.map(c=>c.cargo)].join(' ')).includes(normalizar(busqueda.trim())));
 const idsVisibles=new Set(visibles.map(m=>m.id));
 const grupos=agruparMesasPorFacultad(mesas).map(g=>({...g,total:g.mesas.length,mesas:g.mesas.filter(m=>idsVisibles.has(m.id))})).filter(g=>g.mesas.length&&normalizar(g.nombre).includes(normalizar(busquedaUnidad.trim())));
 const grupo=grupos.find(g=>g.id===idGrupo)??grupos[0];
 const detalle=grupo?.mesas.find(m=>m.id===idMesa);
 const nombreSector=m=>sectores?.get(m.sector)||m.sector||'General';
 return <section className="listado-mesas-admin" aria-label="Mesas registradas">
  <div className="filtros-mesas-recepcion panel-admin">
   <label><span className="solo-lectores-cargos">Buscar mesa</span><input type="search" aria-label="Buscar mesa" placeholder="Buscar mesa, facultad, cargo o recinto…" value={busqueda} onChange={e=>setBusqueda(e.target.value)}/></label>
   <label><span className="solo-lectores-cargos">Sector de las mesas</span><select aria-label="Sector de las mesas" value={sector} onChange={e=>setSector(e.target.value)}><option value="">Todos los estamentos</option>{[...new Set(mesas.map(m=>m.sector).filter(Boolean))].map(s=><option key={s} value={s}>{sectores?.get(s)||s}</option>)}</select></label>
  </div>
  <div className="distribucion-mesas-recepcion">
   <aside className="facultades-mesas-recepcion panel-admin" aria-label="Facultades y unidades">
    <h3>Facultades y unidades</h3>
    <label><span className="solo-lectores-cargos">Buscar facultad o unidad</span><input type="search" aria-label="Buscar facultad o unidad" placeholder="Buscar facultad o unidad…" value={busquedaUnidad} onChange={e=>setBusquedaUnidad(e.target.value)}/></label>
    <ul>{grupos.map(g=><li key={g.id}><button type="button" data-facultad-mesas={g.nombre} aria-pressed={grupo?.id===g.id} onClick={()=>{setIdGrupo(g.id);setIdMesa('');}}><span>{g.nombre}</span><b>{g.mesas.length}</b><span aria-hidden="true">›</span></button></li>)}</ul>
    {!grupos.length&&<p>No hay unidades que coincidan.</p>}
   </aside>
   <section className="detalle-unidad-mesas panel-admin" aria-label="Mesas de la unidad seleccionada">
    <header><h3>{grupo?.nombre??'Mesas de recepción'}</h3><p>{grupo?grupo.mesas.length+(grupo.mesas.length===1?' mesa registrada':' mesas registradas'):'Selecciona una facultad o unidad.'}</p></header>
    {grupo&&<div className="tabla-mesas-recepcion-scroll"><table className="tabla-mesas-recepcion"><thead><tr><th>Mesa</th><th>Estamento</th><th>Cargos</th><th>Acciones</th></tr></thead><tbody>{grupo.mesas.map(m=><tr key={m.id} data-mesa-listado={m.id} data-mesa-fisica={m.idMesaFisica||undefined} className={detalle?.id===m.id?'mesa-seleccionada':''}>
     <td><strong>{nombreMesa(m.codigo)}</strong></td><td>{nombreSector(m)}</td><td>{m.cargos.length}</td><td><div className="acciones-fila-mesa"><button type="button" className="boton secundario" aria-expanded={detalle?.id===m.id} aria-controls="detalle-cargos-mesa" onClick={()=>setIdMesa(m.id)}>Ver cargos <span aria-hidden="true">→</span></button><details className="menu-mesa-recepcion"><summary aria-label={'Opciones de '+nombreMesa(m.codigo)}>⋮</summary><div>{m.cargos.filter(c=>c.estado==='borrador'&&!c.publicado&&!c.actual).map(c=><ConfirmarEliminacion key={c.idMesa} nombre={nombreMesa(m.codigo)+' · '+c.cargo} ocupado={ocupado} etiqueta={'Quitar de '+c.cargo} descripcion="Se retira únicamente de este cargo. Los otros cargos y el historial se conservan." alConfirmar={()=>alQuitar(c.idMesa)}/>)}{!m.cargos.some(c=>c.estado==='borrador'&&!c.publicado&&!c.actual)&&<p>Configuración bloqueada.</p>}</div></details></div></td>
    </tr>)}</tbody></table></div>}
    {detalle&&<section className="detalle-cargos-mesa" id="detalle-cargos-mesa" aria-label={'Cargos de '+nombreMesa(detalle.codigo)}>
     <header><h4>{nombreMesa(detalle.codigo)} · Cargos asignados</h4><button type="button" aria-label="Cerrar cargos de la mesa" onClick={()=>setIdMesa('')}>×</button></header>
     <div className="datos-fisicos-mesa"><span>{nombreSector(detalle)}</span><span>{detalle.recinto||'Sin recinto asignado'}</span>{(detalle.apellidoDesde||detalle.apellidoHasta)&&<span>Apellidos: {detalle.apellidoDesde||'Inicio'} – {detalle.apellidoHasta||'Final'}</span>}</div>
     <ul>{detalle.cargos.map(c=><li key={c.idMesa} data-mesa-cargo={c.idMesa}><div><strong>{c.cargo}</strong><span>{c.ambito||'Toda la institución'} · {c.vuelta===2?'2.ª':'1.ª'} vuelta</span><small>{nombresEstado[c.estado]||c.estado}</small></div><button type="button" className="boton secundario" disabled={ocupado} data-gestionar-proceso={c.idProceso} onClick={()=>alCargo(c.idProceso)}>Ver detalles</button></li>)}</ul>
    </section>}
    {!mesas.length?<p>No hay mesas registradas en esta institución.</p>:!grupo&&<p>No hay mesas que coincidan con tu búsqueda.</p>}
    <footer role="status">Mostrando {grupo?.mesas.length??0} de {grupo?.total??0} mesas{grupo&&grupo.mesas.length!==grupo.total?' en esta unidad':''}</footer>
   </section>
  </div>
 </section>;
}
