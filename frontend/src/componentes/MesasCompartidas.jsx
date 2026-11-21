import React, { useEffect, useState } from 'react';
import { solicitarRest } from '../api/clienteRest.js';
import ImportarExcel from './ImportarExcel.jsx';
import ConfirmarEliminacion from './ConfirmarEliminacion.jsx';
import { nombresEstado } from './EstadoEleccion.jsx';

const vacia = () => ({ codigo: '', unidad: '', sector: 'general', recinto: '', apellidoDesde: '', apellidoHasta: '', usuario: '' });
export default function MesasCompartidas({ organizacion, procesos, cuentas, idProceso, version, ocupado, guardar, alCargo, alImportar }) {
  const [datos, setDatos] = useState(vacia), [seleccion, setSeleccion] = useState(() => procesos.some(p => p.id === idProceso && p.estado === 'borrador') ? [idProceso] : []);
  const [mesas, setMesas] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    let vigente = true; setMesas(null); setError('');
    solicitarRest('/configuracion/mesas-compartidas', { organizacion }).then(r => { if (vigente) setMesas(r.elementos); }).catch(e => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [organizacion, version]);
  const borradores = procesos.filter(p => p.estado === 'borrador');
  const sectores = new Map([['general', 'General'], ...procesos.flatMap(p => (p.sectores ?? []).map(s => [s.codigo, s.nombre]))]);
  const operadores = cuentas.filter(c => c.activo && c.roles?.some(r => r.rol === 'OPERADOR' && r.idOrganizacion === organizacion) && !c.roles.some(r => r.rol === 'ADMINISTRADOR' && (r.idOrganizacion === null || r.idOrganizacion === organizacion)));
  return <section className="panel-admin mesas-compartidas">
    <header><h2>Una mesa, varios cargos</h2><p>En la misma mesa puedes recibir actas de Rector, Vicerrector, Decano o Director. Cada cargo conserva sus candidatos y su conteo.</p></header>
    <details className="crear-mesa-compartida"><summary>Crear una mesa para varios cargos</summary>
      <form className="formulario-mesa-compartida" onSubmit={e => { e.preventDefault(); guardar(async () => { await solicitarRest('/configuracion/mesas-compartidas', { metodo: 'POST', organizacion, datos: { ...datos, idProcesos: seleccion } }); setDatos(vacia()); }, 'Mesa física y cargos vinculados correctamente.'); }}>
        <label>Código único de mesa<input required maxLength={60} placeholder="TEC-GA-EST-001" value={datos.codigo} disabled={ocupado} onChange={e => setDatos({ ...datos, codigo: e.target.value })} /></label>
        <label>Unidad, facultad o grupo<input required maxLength={120} placeholder="Tecnología · Grupo A" value={datos.unidad} disabled={ocupado} onChange={e => setDatos({ ...datos, unidad: e.target.value })} /><small>Si el Director abarca varias carreras, usa exactamente Facultad · Grupo configurado en su cargo.</small></label>
        <label>Sector<select value={datos.sector} disabled={ocupado} onChange={e => setDatos({ ...datos, sector: e.target.value })}>{[...sectores].map(([codigo, nombre]) => <option key={codigo} value={codigo}>{nombre}</option>)}</select></label>
        <label>Recinto o ubicación (opcional)<input maxLength={120} value={datos.recinto} disabled={ocupado} onChange={e => setDatos({ ...datos, recinto: e.target.value })} /></label>
        <label>Apellidos desde (opcional)<input maxLength={80} placeholder="A" value={datos.apellidoDesde} disabled={ocupado} onChange={e => setDatos({ ...datos, apellidoDesde: e.target.value })} /></label>
        <label>Apellidos hasta (opcional)<input maxLength={80} placeholder="L" value={datos.apellidoHasta} disabled={ocupado} onChange={e => setDatos({ ...datos, apellidoHasta: e.target.value })} /></label>
        <label>Operador para los cargos elegidos (opcional)<select value={datos.usuario} disabled={ocupado} onChange={e => setDatos({ ...datos, usuario: e.target.value })}><option value="">Asignar después</option>{operadores.map(c => <option key={c.idUsuario} value={c.usuario}>{c.usuario}</option>)}</select></label>
        <fieldset><legend>Cargos que se contarán en esta mesa</legend><div className="cargos-mesa-compartida">{borradores.map(p => <label key={p.id}><input type="checkbox" value={p.id} disabled={ocupado} checked={seleccion.includes(p.id)} onChange={e => { const marcado=e.target.checked; setSeleccion(prev=>marcado?[...prev,p.id]:prev.filter(id=>id!==p.id)); }} /><span><strong>{p.cargo}</strong> · {p.ambito || 'Toda la institución'} · Vuelta {p.vuelta ?? 1}</span></label>)}</div>{!borradores.length && <p>No hay cargos en borrador.</p>}</fieldset>
        <button type="submit" className="boton primario" disabled={ocupado || !seleccion.length}>Guardar mesa y cargos</button>
      </form>
    </details>
    <ImportarExcel ruta="/configuracion/mesas-compartidas/importacion" organizacion={organizacion} titulo="mesas compartidas" alImportar={alImportar} ayuda={<><p><strong>Una fila por mesa y cargo.</strong> Repite código, unidad, sector, recinto y rango de apellidos para los cargos de la misma mesa. Puedes asignar el operador en la columna <strong>usuario</strong>.</p><p>Docentes y estudiantes tienen códigos de mesa distintos. Los sectores deben estar configurados en los cargos. Las mesas ya registradas con esos mismos datos se vinculan sin duplicarlas.</p><p><a href="/plantillas/mesas-compartidas-ejemplo-sintetico.xlsx" download>Descargar ejemplo sintético: dos mesas con tres cargos cada una</a>. Cambia los ámbitos por los de tus cargos antes de importar.</p></>} />
    {error ? <p className="aviso" role="alert">{error}</p> : mesas === null ? <p role="status">Consultando mesas compartidas…</p> : mesas.length ? <div className="lista-mesas-compartidas">{mesas.map(m => <article key={m.id} data-mesa-fisica={m.id}><header><strong>Mesa {m.codigo}</strong><span>{m.cargos.length} cargos / actas esperadas</span></header><p>{m.unidad} · {m.sector}{m.recinto ? ' · ' + m.recinto : ''}{m.apellidoDesde || m.apellidoHasta ? ` · Apellidos ${m.apellidoDesde || 'inicio'} – ${m.apellidoHasta || 'fin'}` : ''}</p><ul>{m.cargos.map(c => <li key={c.idMesa}><span>{c.cargo} · {c.ambito || 'Toda la institución'} · {nombresEstado[c.estado]}</span><button type="button" className="boton secundario" disabled={ocupado} data-gestionar-proceso={c.idProceso} onClick={() => alCargo(c.idProceso)}>Gestionar cargo</button>{c.estado==='borrador'&&<ConfirmarEliminacion nombre={'Mesa '+m.codigo+' · '+c.cargo} ocupado={ocupado} etiqueta="Quitar de este cargo" descripcion="Se retirará la mesa de este cargo." alConfirmar={()=>guardar(()=>solicitarRest(`/configuracion/mesas/${c.idMesa}`,{metodo:'DELETE',organizacion,datos:{confirmar:true}}),'Mesa retirada de este cargo.')}/>}</li>)}</ul></article>)}</div> : <p className="vacio-candidatos-cargo">Todavía no has vinculado una mesa a varios cargos. Las mesas individuales existentes se conservan.</p>}
  </section>;
}
