import ModalFormulario from './ModalFormulario.jsx';
import {listarMesasInstitucion, siguienteCodigoMesa} from '../api/mesasCompartidas.js';
import { opcionesCreacionMesa } from '../api/creacionMesa.js';
import { agruparCargos } from '../api/seleccionAdministracion.js';
import React, { useEffect, useMemo, useState } from 'react';
import { solicitarRest } from '../api/clienteRest.js';
import ImportarExcel from './ImportarExcel.jsx';
import ListadoMesas from './ListadoMesas.jsx';

const vacia = () => ({ codigo: '', unidad: '', sector: 'general', usuario: '' });
export default function MesasCompartidas({ organizacion, nombreInstitucion, procesos, cuentas, idProceso, version, ocupado, guardar, alCargo, alImportar }) {
  const [creando,setCreando]=useState(false),[errorMesa,setErrorMesa]=useState(''),[grupoOriginal,setGrupoOriginal]=useState(''),[modoGrupo,setModoGrupo]=useState('select');
  const [asignaciones,setAsignaciones]=useState([]);
  useEffect(()=>{let vigente=true;solicitarRest('/configuracion/asignaciones',{organizacion}).then(r=>{if(vigente)setAsignaciones(r.elementos??[]);}).catch(()=>{if(vigente)setAsignaciones([]);});return()=>{vigente=false};},[organizacion,version]);
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
  const normalizarGrupo = v => String(v ?? '').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
  const carrerasConocidas = useMemo(() => new Set(procesos.flatMap(p => (p.carreras ?? []).map(c => normalizarGrupo(c)))), [procesos]);
  const esGrupoValido = v => { const t=String(v ?? '').trim(); if(!t)return false; if(carrerasConocidas.has(normalizarGrupo(t)))return false; if(['carrera','facultad','recinto','grupo'].includes(normalizarGrupo(t)))return false; return true; };
  const gruposExistentes = useMemo(() => {
    const nombres = new Set();
    const agregar = v => { const t=String(v ?? '').trim(); if(esGrupoValido(t)) nombres.add(t); };
    procesos.forEach(p => { agregar(p.facultad); if(p.facultad && p.grupoCarreras) agregar(`${p.facultad} · ${p.grupoCarreras}`); });
    listarMesasInstitucion(procesos).forEach(m => agregar(m.facultad || m.unidad));
    return [...nombres].sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
  }, [procesos, carrerasConocidas]);
  const operadores = cuentas.filter(c => c.activo && c.roles?.some(r => r.rol === 'OPERADOR' && r.idOrganizacion === organizacion) && !c.roles.some(r => r.rol === 'ADMINISTRADOR' && (r.idOrganizacion === null || r.idOrganizacion === organizacion)));
  function abrirFormulario(){
    setErrorMesa('');
    setGrupoOriginal('');setModoGrupo('select');
    setDatos({ ...vacia(), codigo: siguienteCodigoMesa(procesos), sector: opciones.sectores.length===1 ? opciones.sectores[0].codigo : 'general', usuario: operadores.length===1 ? operadores[0].usuario : '' });
    setCreando(true);
  }
  return <section className="mesas-compartidas">
    <header className="cabecera-mesas-clara"><div><h2>Mesas de recepción <span className="cantidad-total-mesas">{listarMesasInstitucion(procesos).length} mesas</span></h2>{nombreInstitucion&&<p className="nombre-institucion-mesas">{nombreInstitucion}</p>}<p>Mesas de toda la institución</p></div><div className="acciones-mesas-clara">

    <button type="button" className="boton primario crear-mesa-compartida" disabled={ocupado} onClick={abrirFormulario}>Crear mesa</button>
    <ImportarExcel ruta="/configuracion/mesas-compartidas/importacion" organizacion={organizacion} titulo="mesas" textoBoton="Importar Excel" alImportar={alImportar} />
    </div></header>
    <ListadoMesas procesos={procesos} sectores={sectores} ocupado={ocupado} asignaciones={asignaciones} cuentas={cuentas} alCargo={alCargo} alQuitar={idMesa=>guardar(()=>solicitarRest(`/configuracion/mesas/${idMesa}`,{metodo:'DELETE',organizacion,datos:{confirmar:true}}),'Mesa retirada de este cargo.')} alAgregarCargo={(idMesaFisica,idProceso)=>guardar(()=>solicitarRest(`/configuracion/mesas-fisicas/${idMesaFisica}/cargos`,{metodo:'POST',organizacion,datos:{idProceso}}),'Cargo agregado a la mesa.')} />
    <ModalFormulario abierto={creando} titulo="Crear mesa" ocupado={ocupado} alCerrar={()=>{setCreando(false);setDatos(vacia());setGrupoOriginal('');setModoGrupo('select');}} cerrarAbajo>
      <p>Marca un cargo para una mesa individual o varios para compartirla. El código y el operador se proponen automáticamente y puedes cambiarlos.</p>
      <form className="formulario-mesa-compartida" onSubmit={e => { e.preventDefault(); if(!puedeGuardar || ocupado)return; guardar(async () => { setErrorMesa('');const unidadFinal=datos.unidad.trim();try{if(modoGrupo === 'editar' && grupoOriginal && grupoOriginal !== unidadFinal && !gruposExistentes.includes(unidadFinal)){await solicitarRest('/configuracion/mesas-compartidas/grupos/renombrar',{metodo:'POST',organizacion,datos:{anterior:grupoOriginal,nuevo:unidadFinal}});}await solicitarRest('/configuracion/mesas-compartidas', { metodo: 'POST', organizacion, datos: { ...datos, unidad: unidadFinal, idProcesos: opciones.seleccionados.map(p=>p.id) } });}catch(e){setErrorMesa(e.message);throw e;} setDatos({...vacia(),sector:datos.sector,usuario:datos.usuario});setCreando(false);setGrupoOriginal('');setModoGrupo('select'); }, 'Mesa guardada correctamente.'); }}>
        <label>Código único de mesa<input required maxLength={60} placeholder="Ej.: Mesa 001" value={datos.codigo} disabled={ocupado} onChange={e => setDatos({ ...datos, codigo: e.target.value })} /></label>
        <label>Unidad, facultad o grupo{opciones.unidades === null ? (
          modoGrupo === 'select' ? <>
            <select aria-label="Unidad de la mesa" required value={datos.unidad} disabled={ocupado} onChange={e => {
              const valor = e.target.value;
              if (valor === '__nuevo__') { setModoGrupo('nuevo'); setDatos({ ...datos, unidad: '' }); return; }
              setDatos({ ...datos, unidad: valor });
              if (gruposExistentes.includes(valor)) setGrupoOriginal(valor);
            }}>
              <option value="">Selecciona un grupo existente</option>
              {gruposExistentes.map(u => <option key={u} value={u}>{u}</option>)}
              <option value="__nuevo__">＋ Agregar nuevo grupo…</option>
            </select>
            {datos.unidad && gruposExistentes.includes(datos.unidad) && <button type="button" className="boton secundario renombrar-grupo-boton" disabled={ocupado} onClick={() => { setGrupoOriginal(datos.unidad); setModoGrupo('editar'); }}>Renombrar grupo</button>}
          </> : <>
            <input aria-label={modoGrupo === 'nuevo' ? 'Nuevo grupo' : 'Nuevo nombre del grupo'} required maxLength={120} placeholder={modoGrupo === 'nuevo' ? 'Escribe el nuevo grupo' : 'Nuevo nombre del grupo'} value={datos.unidad} disabled={ocupado} onBlur={() => setModoGrupo('select')} onChange={e => setDatos({ ...datos, unidad: e.target.value })} />
          </>
        ) : <select aria-label="Unidad de la mesa" required value={datos.unidad} disabled={ocupado || !opciones.unidades.length} onChange={e=>setDatos({...datos,unidad:e.target.value})}><option value="">Selecciona una unidad compatible</option>{opciones.unidades.map(u=><option key={u} value={u}>{u}</option>)}</select>}<small>Se adapta a los cargos elegidos; un grupo de carreras puede atenderse en la misma mesa.</small></label>
        {opciones.sectores.length>1&&<label>Sector<select required value={datos.sector} disabled={ocupado} onChange={e => setDatos({ ...datos, sector: e.target.value })}><option value="" disabled>Selecciona sector</option>{opciones.sectores.map(s => <option key={s.codigo} value={s.codigo}>{s.nombre}</option>)}</select></label>}
        <label>Operador (opcional)<select value={datos.usuario} disabled={ocupado || !operadores.length} onChange={e => setDatos({ ...datos, usuario: e.target.value })}><option value="">Asignar después</option>{operadores.map(c => <option key={c.idUsuario} value={c.usuario}>{c.usuario}</option>)}</select><small>Si dejas «Asignar después», puedes repartir todas las mesas pendientes desde Asignar operadores.</small></label>
        <fieldset><legend>Cargos que se contarán en esta mesa</legend>{!borradores.length ? <p>No hay cargos en borrador.</p> : agruparCargos(borradores).map(g => <div key={g.id} className="grupo-cargos-mesa"><h5>{g.nombre}</h5><div className="cargos-mesa-compartida">{g.procesos.map(p => <label key={p.id}><input type="checkbox" value={p.id} disabled={ocupado || (!seleccion.includes(p.id) && opciones.seleccionados.length>=20)} checked={seleccion.includes(p.id)} onChange={e => { const marcado=e.target.checked; setSeleccion(prev=>{const vigentes=prev.filter(id=>borradores.some(c=>c.id===id));return marcado?[...vigentes,p.id]:vigentes.filter(id=>id!==p.id);}); }} /><span><strong>{p.cargo}</strong> · {p.ambito || 'Toda la institución'} · Vuelta {p.vuelta ?? 1}</span></label>)}</div></div>)}{borradores.length>0&&<p className="resumen-cargos-mesa">{opciones.seleccionados.length} cargo(s) seleccionado(s).</p>}</fieldset>
        <div className="resumen-creacion-mesa" role="status">{!opciones.seleccionados.length ? 'Selecciona al menos un cargo.' : opciones.seleccionados.length===1 ? '1 cargo seleccionado: mesa individual.' : opciones.seleccionados.length+' cargos seleccionados: una misma mesa para sus actas.'}{!opciones.sectores.length&&<p>No hay un sector compatible entre estos cargos. Revisa la selección.</p>}{opciones.unidades?.length===0&&<p>Los cargos elegidos no comparten una unidad. Crea mesas separadas o revisa sus grupos de carreras.</p>}{opciones.seleccionDesactualizada&&<p>Cambió la disponibilidad de un cargo. Vuelve a marcar los cargos antes de guardar.</p>}</div>
        {errorMesa&&<p className="aviso" role="alert">{errorMesa}</p>}
        <div className="acciones-formulario">
          <button type="button" className="boton secundario" disabled={ocupado} onClick={()=>{setCreando(false);setDatos(vacia());setGrupoOriginal('');setModoGrupo('select');}}>Cancelar</button>
          <button type="submit" className="boton primario" disabled={ocupado || !puedeGuardar}>Guardar mesa</button>
        </div>
      </form>
    </ModalFormulario>

  </section>;
}
