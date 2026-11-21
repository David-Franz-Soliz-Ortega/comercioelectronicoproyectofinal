import React, { useRef, useState } from 'react';
import { agruparCargos } from '../api/seleccionAdministracion.js';
import { candidatosPorCargo } from '../api/candidatosPorCargo.js';
import { nombresEstado } from './EstadoEleccion.jsx';
import ConfirmarEliminacion from './ConfirmarEliminacion.jsx';
import FotoCandidatoAdministracion from './FotoCandidatoAdministracion.jsx';

export default function CandidatosAdministracion({ organizacion, procesos, idProceso, ocupado, cargando, disponible, alProceso, alAgregarCargo, alEliminar, alReintentar, revision, children }) {
  const [editando, setEditando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [familia, setFamilia] = useState('');
  const titulo = useRef(null);
  const grupos = agruparCargos(procesos);
  const resumen = candidatosPorCargo(procesos, { busqueda, familia });
  function gestionar(id) {
    alProceso(id);
    setEditando(true);
    titulo.current?.scrollIntoView({ block: 'start' });
    titulo.current?.focus({ preventScroll: true });
  }
  return <section className="panel-admin candidatos-administracion" aria-labelledby="titulo-candidatos-institucion">
    <header className="cabecera-candidatos-institucion">
      <div><p className="etiqueta-panel">INSTITUCIÓN SELECCIONADA</p><h2 id="titulo-candidatos-institucion" ref={titulo} tabIndex={-1}>{editando ? 'Agregar candidatos y gestionar fotografías' : 'Todos los candidatos por cargo'}</h2><p>{editando ? 'Elige el cargo que quieres gestionar. Los cambios se guardan únicamente en ese cargo.' : 'Consulta los nombres de cada cargo, su facultad o grupo y su vuelta electoral.'}</p></div>
      <div className="vistas-candidatos" role="group" aria-label="Vista de candidatos">
        <button type="button" className="boton secundario ver-todos-candidatos" aria-pressed={!editando} disabled={ocupado} onClick={() => setEditando(false)}>Ver todos</button>
        <button type="button" className="boton secundario gestionar-candidatos" aria-pressed={editando} disabled={ocupado || !disponible || !procesos.length} onClick={() => gestionar(idProceso || procesos[0].id)}>Agregar y fotografías</button>
      </div>
    </header>
    {cargando ? <p role="status">Actualizando candidatos…</p> : !disponible ? <div><p role="alert">No se pudo cargar el listado de candidatos.</p><button type="button" className="boton secundario" disabled={ocupado} onClick={alReintentar}>Reintentar</button></div> : <>
      <dl className="totales-candidatos"><div><dt>Candidatos registrados</dt><dd data-total-candidatos>{resumen.totalCandidatos}</dd></div><div><dt>Cargos guardados</dt><dd data-total-cargos>{resumen.totalCargos}</dd></div><div><dt>Cargos sin candidatos</dt><dd data-cargos-sin-candidatos>{resumen.sinCandidatos}</dd></div></dl>
      <p className="estado-fotografias-candidatos">Fotografías: <strong data-candidatos-con-foto>{resumen.conFotografia}</strong> cargadas · <strong data-candidatos-sin-foto>{resumen.sinFotografia}</strong> pendientes.</p>
      {!procesos.length ? <div className="vacio-candidatos"><h3>Todavía no hay cargos creados</h3><p>Primero crea un cargo. Después podrás agregar sus candidatos o importarlos desde Excel.</p><button type="button" className="boton primario" disabled={ocupado} onClick={alAgregarCargo}>Crear un cargo</button></div> : editando ? <>
        <label className="selector-cargo-candidatos">Cargo que vas a gestionar<select aria-label="Cargo para gestionar candidatos" disabled={ocupado} value={idProceso} onChange={e => alProceso(e.target.value)}><option value="" disabled>Selecciona un cargo</option>{grupos.map(g => <optgroup key={g.id} label={g.nombre}>{g.procesos.map(p => <option key={p.id} value={p.id}>{p.cargo} · {p.ambito || p.facultad || 'Toda la institución'} · {p.vuelta === 2 ? 'Segunda' : 'Primera'} vuelta · {p.candidatos.length} candidatos · {nombresEstado[p.estado] ?? p.estado}</option>)}</optgroup>)}</select></label>
        {children}
      </> : <>
        <div className="filtros-candidatos"><label>Buscar<input type="search" aria-label="Buscar candidatos o cargos" placeholder="Nombre, facultad, grupo o cargo…" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></label><label>Tipo de cargo<select aria-label="Filtrar candidatos por tipo de cargo" value={familia} onChange={e => setFamilia(e.target.value)}><option value="">Todos los tipos</option>{grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}</select></label></div>
        <p className="resultado-filtro-candidatos" role="status">{resumen.cargosVisibles} de {resumen.totalCargos} cargos. Cada coincidencia muestra todos sus candidatos. Se incluyen los cargos archivados.</p>
        {resumen.grupos.length ? <div className="grupos-candidatos">{resumen.grupos.map(g => <details key={g.id} className="grupo-candidatos" data-grupo-candidatos={g.id} open>
          <summary><strong>{g.nombre}</strong><span>{g.procesos.length} cargos · {g.procesos.reduce((s, p) => s + p.candidatos.length, 0)} candidatos</span></summary>
          <div className="cargos-con-candidatos">{g.procesos.map(p => <article key={p.id} className="cargo-con-candidatos" data-candidatos-cargo={p.id}>
            <header><div><h3>{p.cargo}</h3><p>{p.ambito || p.facultad || 'Toda la institución'}</p><small>{p.vuelta === 2 ? 'Segunda' : 'Primera'} vuelta · {p.candidatos.length} {p.candidatos.length === 1 ? 'candidato' : 'candidatos'}</small></div><span className={`etiqueta-estado estado-${p.estado}`}>{nombresEstado[p.estado] ?? 'Estado no disponible'}</span></header>
            {p.candidatos.length ? <ul className="nombres-candidatos-cargo">{p.candidatos.map(c => <li key={c.id} data-candidato-listado={c.id}><FotoCandidatoAdministracion candidato={c} organizacion={organizacion} revision={revision} /><div><strong>{c.nombre}</strong><small>{c.tieneFoto || c.foto ? 'Fotografía cargada' : 'Sin fotografía'}</small></div>{p.estado==='borrador'&&alEliminar&&<ConfirmarEliminacion nombre={c.nombre+' · '+p.cargo} ocupado={ocupado} alConfirmar={()=>alEliminar(c)}/>}</li>)}</ul> : <p className="vacio-candidatos-cargo">Este cargo todavía no tiene candidatos registrados.</p>}
            <button type="button" className="boton secundario gestionar-cargo-candidatos" disabled={ocupado} onClick={() => gestionar(p.id)}>{p.estado === 'borrador' ? 'Agregar o cambiar fotografías' : 'Ver candidatos del cargo'}</button>
          </article>)}</div>
        </details>)}</div> : <div className="vacio-candidatos"><p>No hay coincidencias con esta búsqueda.</p><button type="button" className="boton secundario" onClick={() => { setBusqueda(''); setFamilia(''); }}>Mostrar todos</button></div>}
      </>}
    </>}
  </section>;
}
