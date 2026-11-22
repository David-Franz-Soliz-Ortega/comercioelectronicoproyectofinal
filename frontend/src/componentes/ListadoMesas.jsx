import React, { useState } from 'react';
import { listarMesasInstitucion, agruparMesasPorFacultad } from '../api/mesasCompartidas.js';
import { nombresEstado } from './EstadoEleccion.jsx';
import ConfirmarEliminacion from './ConfirmarEliminacion.jsx';

export default function ListadoMesas({ procesos, sectores, ocupado, alCargo, alQuitar }) {
 const [busqueda, setBusqueda] = useState('');
 const mesas = listarMesasInstitucion(procesos);
 const normalizar = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
 const visibles = mesas.filter(m => normalizar([m.codigo,m.facultad,m.unidad,m.recinto,m.sector,...m.cargos.map(c => c.cargo)].filter(Boolean).join(' ')).includes(normalizar(busqueda.trim())));
 const idsVisibles = new Set(visibles.map(m => m.id));
 const grupos = agruparMesasPorFacultad(mesas).map(g => ({...g,total:g.mesas.length,mesas:g.mesas.filter(m=>idsVisibles.has(m.id))})).filter(g=>g.mesas.length);
 return <section className="listado-mesas-admin" aria-labelledby="titulo-listado-mesas">
  <div className="cabecera-listado-mesas"><h3 id="titulo-listado-mesas">Mesas registradas <span>{mesas.length}</span></h3><label>Buscar mesa<input type="search" placeholder="Nombre, facultad o recinto…" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></label></div>
  <p>Abre una facultad o unidad y pulsa el nombre de la mesa para ver sus cargos y acciones.</p>
  <div className="grupos-mesas-facultad">{grupos.map(grupo => <details key={grupo.id} className="grupo-mesas-facultad" data-facultad-mesas={grupo.nombre} open={Boolean(busqueda.trim())}>
   <summary><strong>{grupo.nombre}</strong><span className="cantidad-mesas-facultad">{grupo.mesas.length !== grupo.total ? grupo.mesas.length+' de ' : ''}{grupo.total} {grupo.total === 1 ? 'mesa' : 'mesas'}</span></summary>
   <div className="lista-mesas-compartidas mesas-en-facultad">{grupo.mesas.map(m => <details className="mesa-admin-desplegable" key={m.id} data-mesa-listado={m.id} data-mesa-fisica={m.idMesaFisica || undefined}>
   <summary><strong>Mesa {m.codigo}</strong><span>{m.unidad} · {sectores?.get(m.sector) || m.sector || 'General'}</span><small>{m.cargos.length} {m.cargos.length === 1 ? 'cargo' : 'cargos'}</small></summary>
   <div className="contenido-mesa-admin">
    <dl><div><dt>Recinto</dt><dd>{m.recinto || 'Sin recinto asignado'}</dd></div><div><dt>Sector</dt><dd>{sectores?.get(m.sector) || m.sector || 'General'}</dd></div>{(m.apellidoDesde || m.apellidoHasta) && <div><dt>Apellidos</dt><dd>{m.apellidoDesde || 'Inicio'} – {m.apellidoHasta || 'Final'}</dd></div>}</dl>
    <ul>{m.cargos.map(c => <li key={c.idMesa} data-mesa-cargo={c.idMesa}>
     <div className="datos-cargo-mesa"><strong>{c.cargo}</strong><span>{c.ambito || 'Toda la institución'}{c.vuelta === 2 ? ' · Segunda vuelta' : ''}</span><span className={`etiqueta-estado estado-${c.estado}`}>{nombresEstado[c.estado] || c.estado}</span></div>
     <div className="acciones-cargo-mesa"><button type="button" className="boton secundario" disabled={ocupado} data-gestionar-proceso={c.idProceso} onClick={() => alCargo(c.idProceso)}>Gestionar cargo</button>{c.estado === 'borrador' && !c.publicado && !c.actual && <ConfirmarEliminacion nombre={'Mesa '+m.codigo+' · '+c.cargo} ocupado={ocupado} etiqueta="Quitar de este cargo" descripcion="Se retira esta mesa únicamente del cargo elegido. Los otros cargos y el historial se conservan." alConfirmar={() => alQuitar(c.idMesa)} />}</div>
    </li>)}</ul>
   </div>
  </details>)}</div>
  </details>)}</div>
  {!mesas.length ? <p>No hay mesas registradas en esta institución.</p> : !visibles.length && <p>No hay mesas que coincidan con tu búsqueda.</p>}
 </section>;
}
