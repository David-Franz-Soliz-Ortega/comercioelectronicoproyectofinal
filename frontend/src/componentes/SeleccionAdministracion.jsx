import React, { useEffect, useState } from 'react';
import ConfirmarEliminacion from './ConfirmarEliminacion.jsx';
import ModalFormulario from './ModalFormulario.jsx';
import CamposCargo from './CamposCargo.jsx';
import { nombresEstado } from '../api/catalogos.js';
import { IconoTuvoto, IconoEdificio, IconoUsuarios, IconoEngranaje } from './Iconos.jsx';
import { agruparCargos, filtrarCargos, datosDeProceso } from '../api/seleccionAdministracion.js';

export default function SeleccionAdministracion({
  organizacion,
  procesos,
  idProceso,
  ocupado,
  cargando,
  disponible,
  alProceso,
  alAgregar,
  alEliminar,
  alGuardarEdicion,
  alReintentar,
  nombreInstitucion,
  acciones
}) {
  const [expandidos,setExpandidos]=useState(new Set());
  const [busqueda,setBusqueda]=useState(''),[estado,setEstado]=useState(''),[archivados,setArchivados]=useState(false),[familia,setFamilia]=useState('');
  const catalogo=filtrarCargos(procesos,{archivados});
  const grupos=agruparCargos(catalogo);
  const coincidencias=agruparCargos(filtrarCargos(procesos,{busqueda,estado,archivados})).filter(g=>!familia||g.id===familia);
  const total=coincidencias.reduce((s,g)=>s+g.cantidad,0);
  useEffect(()=>{setBusqueda('');setEstado('');setArchivados(false);setFamilia('');setExpandidos(new Set());setCargoModal(null);},[organizacion]);

  const [cargoModal, setCargoModal] = useState(null);
  const [modoModal, setModoModal] = useState('detalle'); // 'detalle' | 'editar'
  const [datosEdicion, setDatosEdicion] = useState(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState('');

  const abrirDetalle = (p) => {
    setCargoModal(p);
    setModoModal('detalle');
    setDatosEdicion(datosDeProceso(p));
    setErrorEdicion('');
  };

  const iniciarEdicion = (p) => {
    setCargoModal(p);
    setModoModal('editar');
    setDatosEdicion(datosDeProceso(p));
    setErrorEdicion('');
  };

  const cerrarModal = () => {
    if (guardandoEdicion) return;
    setCargoModal(null);
    setModoModal('detalle');
    setErrorEdicion('');
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!alGuardarEdicion || !cargoModal || guardandoEdicion) return;
    setGuardandoEdicion(true);
    setErrorEdicion('');
    try {
      const actualizado = await alGuardarEdicion(cargoModal.id, datosEdicion);
      if (actualizado) {
        setCargoModal(actualizado);
      }
      setModoModal('detalle');
    } catch (err) {
      setErrorEdicion(err.message || 'Error al guardar los cambios del cargo.');
    } finally {
      setGuardandoEdicion(false);
    }
  };

  if (!organizacion) return null;
  return (
    <section id="cargos-de-institucion" className="seleccion-administracion catalogo-claro" aria-labelledby="titulo-seleccion-administracion">
      <header className="cabecera-lista-cargos">
        <div><h2 id="titulo-seleccion-administracion">Cargos electorales</h2><p>{nombreInstitucion||'Cargos de la organización'}</p></div>
        <div className="acciones-lista-cargos">{acciones}<button type="button" className="boton primario agregar-cargo" disabled={ocupado||!disponible} onClick={alAgregar}>＋ Crear cargo</button></div>
      </header>
      {cargando?<p role="status">Cargando cargos…</p>:!disponible?<div className="panel-admin"><p role="alert">No se pudo cargar el listado de cargos.</p><button type="button" className="boton secundario" disabled={ocupado} onClick={alReintentar}>Reintentar</button></div>:<>
      {!!grupos.length&&<div className="metricas-familias-cargos">{grupos.map(g=>{const Icono=g.id==='rectorado'?IconoEngranaje:g.id==='vicerrectorado'?IconoTuvoto:g.id==='decanos'?IconoEdificio:IconoUsuarios;return <article key={g.id}><span className="icono-familia-cargo"><Icono tamano={27}/></span><div><span>{g.nombre}</span><strong>{g.cantidad}</strong></div></article>;})}</div>}
      <div className="panel-admin directorio-cargos-claro">
       <nav className="pestanas-familias-cargos" aria-label="Filtrar grupo de cargos"><button type="button" aria-pressed={!familia} onClick={()=>setFamilia('')}>Todos <span>{catalogo.length}</span></button>{grupos.map(g=><button type="button" key={g.id} aria-pressed={familia===g.id} onClick={()=>setFamilia(g.id)}>{g.nombre}<span>{g.cantidad}</span></button>)}</nav>
       <div className="filtros-directorio-cargos"><label className="buscar-cargo"><span className="solo-lectores-cargos">Buscar cargo o facultad</span><input type="search" aria-label="Buscar cargo o facultad" placeholder="Buscar cargo o facultad…" value={busqueda} onChange={e=>setBusqueda(e.target.value)}/></label><label><span className="solo-lectores-cargos">Estado de los cargos</span><select aria-label="Estado de los cargos" value={estado} onChange={e=>setEstado(e.target.value)}><option value="">Todos los estados</option>{Object.entries(nombresEstado).map(([id,nombre])=><option key={id} value={id}>{nombre}</option>)}</select></label><label className="mostrar-archivados-cargos"><input type="checkbox" checked={archivados} onChange={e=>{setArchivados(e.target.checked);setFamilia('');}}/>Mostrar archivados</label></div>
       <div className="scroll-directorio-cargos"><div className="columnas-directorio-cargos" aria-hidden="true"><span>Cargo y alcance</span><span>Estado</span><span>Vuelta</span><span>Candidatos</span><span>Mesas</span><span>Acciones</span></div>
       <div className="grupos-cargos-institucion">{coincidencias.map(g=><details key={organizacion+':'+g.id} className="grupo-cargos-institucion" data-grupo-cargos={g.id} open={g.id!=='directores'||!!busqueda||familia===g.id}>
        <summary aria-label={g.nombre+': '+g.cantidad+' cargos'}><span className="flecha-grupo-cargos" aria-hidden="true">›</span><span className="nombre-grupo-cargos">{g.nombre}</span><span className="cantidad-grupo-cargos" data-cantidad={g.cantidad}>{g.cantidad}</span></summary>
        <table className="lista-cargos-institucion"><colgroup><col style={{width:'36%'}}/><col style={{width:'12%'}}/><col style={{width:'10%'}}/><col style={{width:'10%'}}/><col style={{width:'10%'}}/><col style={{width:'22%'}}/></colgroup><thead className="solo-lectores-cargos"><tr>{['Cargo y alcance','Estado','Vuelta','Candidatos','Mesas','Acciones'].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{g.procesos.map((p,indice)=><tr hidden={!busqueda&&!familia&&!expandidos.has(g.id)&&indice>=3} key={p.id} className="item-cargo-institucion"><td><strong>{p.cargo}</strong><span className="alcance-fila-cargo">{p.ambito||p.facultad||'Toda la institución'}</span></td><td><span className={'insignia-estado estado-'+p.estado}>{nombresEstado[p.estado]??p.estado}</span></td><td><span className="vuelta-fila-cargo">{p.vuelta===2?'2.ª vuelta':'1.ª vuelta'}</span></td><td>{p.candidatos?.length??'—'}</td><td>{p.mesas?.length??'—'}</td><td><div className="acciones-fila-cargo"><button type="button" className="ver-detalles-cargo" data-cargo={p.id} aria-pressed={p.id===idProceso} disabled={ocupado} onClick={()=>abrirDetalle(p)}>Ver detalles <span aria-hidden="true">→</span></button><details className="menu-fila-cargo"><summary aria-label={'Opciones de '+p.cargo}>⋮</summary><div><button type="button" disabled={ocupado} onClick={()=>{alProceso(p.id);}}>Gestionar cargo</button>{p.estado==='borrador'&&<button type="button" disabled={ocupado||!alGuardarEdicion} onClick={()=>iniciarEdicion(p)}>Editar cargo</button>}{p.estado==='borrador'&&alEliminar&&<ConfirmarEliminacion nombre={p.cargo+' · '+(p.ambito||p.nombre)} ocupado={ocupado} descripcion="Se retirará el cargo del panel conservando sus registros." alConfirmar={()=>alEliminar(p)}/>}</div></details></div></td></tr>)}</tbody></table>{g.cantidad>3&&!busqueda&&!familia&&<button type="button" className="ver-todos-grupo-cargos" onClick={()=>setExpandidos(prev=>{const siguiente=new Set(prev);if(siguiente.has(g.id))siguiente.delete(g.id);else siguiente.add(g.id);return siguiente;})}>{expandidos.has(g.id)?'Mostrar menos':'Ver los '+g.cantidad+' cargos →'}</button>}
       </details>)}</div></div>
       {!total&&<div className="sin-cargos-institucion"><h3>{procesos.length?'No hay coincidencias':'Todavía no hay cargos'}</h3><p>{procesos.length?'Prueba otro filtro o muestra los archivados.':'Crea el primer cargo para comenzar.'}</p></div>}
       <footer className="total-cargos-agrupados">{total} cargos en {coincidencias.length} grupos</footer>
      </div></>}

      {/* Modal superpuesto del cargo (Detalle y Edición en el mismo modal) */}
      {cargoModal && (
        <ModalFormulario
          abierto={Boolean(cargoModal)}
          titulo={modoModal === 'editar' ? `Editar cargo: ${cargoModal.cargo}` : `${cargoModal.cargo} · Información`}
          ocupado={ocupado || guardandoEdicion}
          alCerrar={cerrarModal}
        >
          {modoModal === 'detalle' ? (
            <div className="modal-cargo-contenido">
              <div className="cabecera-detalle-modal">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span className={`insignia-estado estado-${cargoModal.estado}`}>
                    {nombresEstado[cargoModal.estado] ?? cargoModal.estado}
                  </span>
                  <span className="insignia-vuelta-tarjeta">
                    {cargoModal.vuelta === 2 ? 'Segunda vuelta' : 'Primera vuelta'}
                  </span>
                </div>
                <h3 style={{ margin: '0 0 4px', fontSize: 20, color: 'var(--azul-oscuro)' }}>{cargoModal.cargo}</h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--secundario)' }}>{cargoModal.nombre}</p>
              </div>

              <dl className="grilla-detalle-cargo-modal">
                <div>
                  <dt>Ámbito / Facultad</dt>
                  <dd>{cargoModal.facultad || cargoModal.ambito || 'Toda la institución'}</dd>
                </div>
                <div>
                  <dt>Tipo de organización</dt>
                  <dd>{cargoModal.tipo || 'Universidad'}</dd>
                </div>
                {cargoModal.carreras?.length > 0 && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <dt>Carreras participantes</dt>
                    <dd>{cargoModal.carreras.join('; ')}</dd>
                  </div>
                )}
                <div>
                  <dt>Agrupación de mesas</dt>
                  <dd>{cargoModal.unidad || 'Facultad'}</dd>
                </div>
                <div>
                  <dt>Sistema de conteo</dt>
                  <dd>{cargoModal.ponderacion ? 'Ponderación activada' : cargoModal.sectores?.length ? 'Sectores separados' : 'Voto directo'}</dd>
                </div>
                <div>
                  <dt>Candidatos inscritos</dt>
                  <dd>{cargoModal.candidatos.length} candidato(s)</dd>
                </div>
                <div>
                  <dt>Mesas registradas</dt>
                  <dd>{cargoModal.mesas.length} mesa(s)</dd>
                </div>
              </dl>

              {cargoModal.sectores?.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--azul-oscuro)' }}>Sectores configurados</h4>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--secundario)' }}>
                    {cargoModal.sectores.map(s => (
                      <li key={s.codigo}>{s.nombre} {cargoModal.ponderacion ? `· ${(s.pesoBps / 100).toFixed(2)} %` : ''}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pie-acciones-modal-cargo">
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="boton primario"
                    onClick={() => {
                      alProceso(cargoModal.id);
                      cerrarModal();
                    }}
                  >
                    Seleccionar este cargo →
                  </button>

                  {cargoModal.estado === 'borrador' && (
                    <button
                      type="button"
                      className="boton secundario"
                      onClick={() => iniciarEdicion(cargoModal)}
                    >
                      Editar cargo
                    </button>
                  )}

                  {cargoModal.estado === 'borrador' && alEliminar && (
                    <ConfirmarEliminacion
                      nombre={cargoModal.cargo + ' · ' + (cargoModal.ambito || cargoModal.nombre)}
                      ocupado={ocupado}
                      descripcion="Se retirará este cargo con su catálogo del panel. Los registros se conservan."
                      alConfirmar={async () => {
                        await alEliminar(cargoModal);
                        cerrarModal();
                      }}
                    />
                  )}
                </div>

                <button type="button" className="boton secundario" onClick={cerrarModal}>
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            <form className="modal-cargo-contenido" onSubmit={guardar}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--secundario)' }}>
                Modifica los datos y opciones de este cargo. Los cambios se guardarán directamente en el catálogo.
              </p>

              {errorEdicion && <div className="aviso" role="alert">{errorEdicion}</div>}

              {datosEdicion&&<CamposCargo datos={datosEdicion} cambiar={setDatosEdicion} procesos={procesos} bloqueado={ocupado||guardandoEdicion} identidadFija/>}

              <div className="pie-acciones-modal-cargo">
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="submit"
                    className="boton primario"
                    disabled={ocupado || guardandoEdicion || (datosEdicion?.ponderacion && datosEdicion?.sectores?.reduce((a, s) => a + s.pesoBps, 0) !== 10000)}
                  >
                    {guardandoEdicion ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                  <button
                    type="button"
                    className="boton secundario"
                    disabled={guardandoEdicion}
                    onClick={() => setModoModal('detalle')}
                  >
                    Volver al detalle
                  </button>
                </div>

                <button type="button" className="boton secundario" disabled={guardandoEdicion} onClick={cerrarModal}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </ModalFormulario>
      )}
    </section>
  );
}
