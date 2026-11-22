import ModalFormulario from './ModalFormulario.jsx';
import { opcionesCreacionMesa } from '../api/creacionMesa.js';
import React, { useEffect, useMemo, useState } from 'react';
import { solicitarRest } from '../api/clienteRest.js';
import ImportarExcel from './ImportarExcel.jsx';
import ListadoMesas from './ListadoMesas.jsx';

const vacia = () => ({ codigo: '', unidad: '', sector: 'general', recinto: '', apellidoDesde: '', apellidoHasta: '', usuario: '' });
export default function MesasCompartidas({ organizacion, procesos, cuentas, idProceso, version, ocupado, guardar, alCargo, alImportar }) {
  const [creando,setCreando]=useState(false),[errorMesa,setErrorMesa]=useState('');
  const [datos, setDatos] = useState(vacia), [seleccion, setSeleccion] = useState(() => procesos.some(p => p.id === idProceso && p.estado === 'borrador' && !p.actual && !p.publicado) ? [idProceso] : []);
  const opciones = useMemo(() => opcionesCreacionMesa(procesos,seleccion), [procesos,seleccion]);
  const { borradores } = opciones;
  const unidadValida = opciones.unidades === null ? Boolean(datos.unidad.trim()) : opciones.unidades.includes(datos.unidad);
  const puedeGuardar = Boolean(datos.codigo.trim()) && opciones.seleccionados.length > 0 && opciones.seleccionados.length <= 20 && !opciones.seleccionDesactualizada && opciones.sectores.some(s=>s.codigo===datos.sector) && unidadValida;
  useEffect(() => { setDatos(d => {
    const sector = opciones.sectores.some(s=>s.codigo===d.sector) ? d.sector : opciones.sectores.length===1 ? opciones.sectores[0].codigo : '';
    const unidad = opciones.unidades !== null && !opciones.unidades.includes(d.unidad) ? '' : d.unidad;
    return sector===d.sector && unidad===d.unidad ? d : {...d,sector,unidad};
  }); }, [opciones]);
  const sectores = new Map([['general', 'General'], ...procesos.flatMap(p => (p.sectores ?? []).map(s => [s.codigo, s.nombre]))]);
  const operadores = cuentas.filter(c => c.activo && c.roles?.some(r => r.rol === 'OPERADOR' && r.idOrganizacion === organizacion) && !c.roles.some(r => r.rol === 'ADMINISTRADOR' && (r.idOrganizacion === null || r.idOrganizacion === organizacion)));
  return <section className="panel-admin mesas-compartidas">
    <header><h2>Mesas de la institución</h2></header>
    <ListadoMesas procesos={procesos} sectores={sectores} ocupado={ocupado} alCargo={alCargo} alQuitar={idMesa=>guardar(()=>solicitarRest(`/configuracion/mesas/${idMesa}`,{metodo:'DELETE',organizacion,datos:{confirmar:true}}),'Mesa retirada de este cargo.')} />
    <button type="button" className="boton primario crear-mesa-compartida" disabled={ocupado} onClick={()=>{setErrorMesa('');setCreando(true);}}>Crear mesa</button>
    <ModalFormulario abierto={creando} titulo="Crear mesa" ocupado={ocupado} alCerrar={()=>{setCreando(false);setDatos(vacia());}}>
      <p>Marca un cargo para una mesa individual o varios para compartirla. Solo se registran juntos si admiten la misma unidad y sector.</p>
      <form className="formulario-mesa-compartida" onSubmit={e => { e.preventDefault(); if(!puedeGuardar || ocupado)return; guardar(async () => { setErrorMesa('');try{await solicitarRest('/configuracion/mesas-compartidas', { metodo: 'POST', organizacion, datos: { ...datos, idProcesos: opciones.seleccionados.map(p=>p.id) } });}catch(e){setErrorMesa(e.message);throw e;} setDatos({...vacia(),sector:datos.sector});setCreando(false); }, 'Mesa guardada correctamente.'); }}>
        <label>Código único de mesa<input required maxLength={60} placeholder="Ej.: Mesa 001" value={datos.codigo} disabled={ocupado} onChange={e => setDatos({ ...datos, codigo: e.target.value })} /></label>
        <label>Unidad, facultad o grupo{opciones.unidades === null ? <input aria-label="Unidad de la mesa" required maxLength={120} placeholder="Facultad, distrito o comunidad" value={datos.unidad} disabled={ocupado} onChange={e=>setDatos({...datos,unidad:e.target.value})}/> : <select aria-label="Unidad de la mesa" required value={datos.unidad} disabled={ocupado || !opciones.unidades.length} onChange={e=>setDatos({...datos,unidad:e.target.value})}><option value="">Selecciona una unidad compatible</option>{opciones.unidades.map(u=><option key={u} value={u}>{u}</option>)}</select>}<small>Se adapta a los cargos elegidos; un grupo de carreras puede atenderse en la misma mesa.</small></label>
        <label>Sector<select required value={datos.sector} disabled={ocupado || !opciones.sectores.length} onChange={e => setDatos({ ...datos, sector: e.target.value })}><option value="" disabled>Selecciona sector</option>{opciones.sectores.map(s => <option key={s.codigo} value={s.codigo}>{s.nombre}</option>)}</select></label>
        <label>Recinto o ubicación (opcional)<input maxLength={120} value={datos.recinto} disabled={ocupado} onChange={e => setDatos({ ...datos, recinto: e.target.value })} /></label>
        <label>Apellidos desde (opcional)<input maxLength={80} placeholder="A" value={datos.apellidoDesde} disabled={ocupado} onChange={e => setDatos({ ...datos, apellidoDesde: e.target.value })} /></label>
        <label>Apellidos hasta (opcional)<input maxLength={80} placeholder="L" value={datos.apellidoHasta} disabled={ocupado} onChange={e => setDatos({ ...datos, apellidoHasta: e.target.value })} /></label>
        <label>Operador para los cargos elegidos (opcional)<select value={datos.usuario} disabled={ocupado} onChange={e => setDatos({ ...datos, usuario: e.target.value })}><option value="">Asignar después</option>{operadores.map(c => <option key={c.idUsuario} value={c.usuario}>{c.usuario}</option>)}</select></label>
        <fieldset><legend>Cargos que se contarán en esta mesa</legend><div className="cargos-mesa-compartida">{borradores.map(p => <label key={p.id}><input type="checkbox" value={p.id} disabled={ocupado || (!seleccion.includes(p.id) && opciones.seleccionados.length>=20)} checked={seleccion.includes(p.id)} onChange={e => { const marcado=e.target.checked; setSeleccion(prev=>{const vigentes=prev.filter(id=>borradores.some(c=>c.id===id));return marcado?[...vigentes,p.id]:vigentes.filter(id=>id!==p.id);}); }} /><span><strong>{p.cargo}</strong> · {p.ambito || 'Toda la institución'} · Vuelta {p.vuelta ?? 1}</span></label>)}</div>{!borradores.length && <p>No hay cargos en borrador.</p>}</fieldset>
        <div className="resumen-creacion-mesa" role="status">{!opciones.seleccionados.length ? 'Selecciona al menos un cargo.' : opciones.seleccionados.length===1 ? '1 cargo seleccionado: mesa individual.' : opciones.seleccionados.length+' cargos seleccionados: una misma mesa para sus actas.'}{!opciones.sectores.length&&<p>No hay un sector compatible entre estos cargos. Revisa la selección.</p>}{opciones.unidades?.length===0&&<p>Los cargos elegidos no comparten una unidad. Crea mesas separadas o revisa sus grupos de carreras.</p>}{opciones.seleccionDesactualizada&&<p>Cambió la disponibilidad de un cargo. Vuelve a marcar los cargos antes de guardar.</p>}</div>
        {errorMesa&&<p className="aviso" role="alert">{errorMesa}</p>}
        <button type="submit" className="boton primario" disabled={ocupado || !puedeGuardar}>Guardar mesa</button>
      </form>
    </ModalFormulario>
    <ImportarExcel ruta="/configuracion/mesas-compartidas/importacion" organizacion={organizacion} titulo="mesas" alImportar={alImportar} ayuda={<>
      <p>Una plantilla para cualquier tipo de elección. Usa una fila por mesa y cargo; repite el código y los datos físicos cuando la misma mesa atienda varios cargos.</p>
      <p>En <strong>unidad</strong> indica la facultad, grupo, distrito o comunidad que corresponda al cargo. Si no separas sectores, deja <strong>sector</strong> vacío; si los configuraste, usa su código exacto. {borradores.some(p=>p.tipo==='universidad') && 'Docentes y estudiantes usan mesas con códigos diferentes.'}</p>
      <details className="referencias-plantilla-mesas"><summary>Cargos y sectores de esta institución ({borradores.length})</summary>
        {borradores.length ? <ul>{borradores.map(p=><li key={p.id}><strong>{p.cargo}</strong><span>Ámbito: {p.ambito || 'vacío'} · Vuelta: {p.vuelta ?? 1}</span><span>Unidad: {p.facultad && p.grupoCarreras ? p.facultad+' · '+p.grupoCarreras : (p.carreras?.join('; ') || p.unidad)}</span><span>Sectores: {p.sectores?.length ? p.sectores.map(s=>s.codigo+' ('+s.nombre+')').join(', ') : 'General (deja la celda vacía)'}</span></li>)}</ul> : <p>Crea primero un cargo en borrador desde Elección.</p>}
      </details>
    </>} />

  </section>;
}
