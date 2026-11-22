import React, { useState } from 'react';
import ConfirmarEliminacion from './ConfirmarEliminacion.jsx';
import ModalFormulario from './ModalFormulario.jsx';
import TipoCargoUniversitario from './TipoCargoUniversitario.jsx';
import OpcionesEleccion from './OpcionesEleccion.jsx';
import { nombresEstado } from './EstadoEleccion.jsx';
import { agruparCargos } from '../api/seleccionAdministracion.js';

const datosEleccionVacia = () => ({
  nombre: '',
  cargo: '',
  tipo: 'universidad',
  unidad: 'Facultad',
  ambito: '',
  facultad: '',
  grupoCarreras: '',
  carreras: [],
  vuelta: 1,
  idPrimeraVuelta: null,
  sectores: [],
  ponderacion: false,
  reglaSegundaVuelta: null
});

function procesoADatos(p) {
  const d = datosEleccionVacia();
  for (const k of Object.keys(d)) {
    if (p[k] !== undefined) d[k] = p[k];
  }
  return d;
}

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
  alReintentar
}) {
  if (!organizacion) return null;
  const grupos = agruparCargos(procesos);

  const [cargoModal, setCargoModal] = useState(null);
  const [modoModal, setModoModal] = useState('detalle'); // 'detalle' | 'editar'
  const [datosEdicion, setDatosEdicion] = useState(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState('');

  const abrirDetalle = (p) => {
    setCargoModal(p);
    setModoModal('detalle');
    setDatosEdicion(procesoADatos(p));
    setErrorEdicion('');
  };

  const iniciarEdicion = (p) => {
    setCargoModal(p);
    setModoModal('editar');
    setDatosEdicion(procesoADatos(p));
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

  return (
    <section id="cargos-de-institucion" className="panel-admin seleccion-administracion" aria-labelledby="titulo-seleccion-administracion">
      <header className="cabecera-lista-cargos">
        <div>
          <p className="etiqueta-panel">INSTITUCIÓN SELECCIONADA</p>
          <h2 id="titulo-seleccion-administracion">Elegir o crear un cargo</h2>
          <p>Selecciona un cargo para ver sus detalles, editarlo o continuar su preparación.</p>
        </div>
        <button type="button" className="boton primario agregar-cargo" disabled={ocupado || !disponible} onClick={alAgregar}>
          + Crear nuevo cargo
        </button>
      </header>

      {cargando ? (
        <p role="status">Cargando cargos…</p>
      ) : !disponible ? (
        <div>
          <p role="alert">No se pudo cargar el listado de cargos.</p>
          <button type="button" className="boton secundario" disabled={ocupado} onClick={alReintentar}>
            Reintentar
          </button>
        </div>
      ) : procesos.length ? (
        <>
          <h3 className="titulo-cargos-existentes">Cargos existentes</h3>
          <p className="total-cargos-agrupados">
            {procesos.length} {procesos.length === 1 ? 'cargo' : 'cargos'} · {grupos.length} {grupos.length === 1 ? 'grupo' : 'grupos'}. Se incluyen los cargos archivados.
          </p>

          <div className="grupos-cargos-institucion">
            {grupos.map(g => (
              <details key={organizacion + ':' + g.id} className="grupo-cargos-institucion" data-grupo-cargos={g.id} open>
                <summary aria-label={`${g.nombre}: ${g.cantidad} ${g.cantidad === 1 ? 'cargo' : 'cargos'}`}>
                  <span className="nombre-grupo-cargos">{g.nombre}</span>
                  <span className="cantidad-grupo-cargos" data-cantidad={g.cantidad}>
                    {g.cantidad}<small>{g.cantidad === 1 ? 'cargo' : 'cargos'}</small>
                  </span>
                  <span className="flecha-grupo-cargos" aria-hidden="true">⌄</span>
                </summary>

                <ul className="lista-cargos-institucion">
                  {g.procesos.map(p => (
                    <li key={p.id} className="item-cargo-institucion">
                      <button
                        type="button"
                        className="cargo-institucion tarjeta-cargo-cuadrada"
                        data-cargo={p.id}
                        aria-pressed={p.id === idProceso}
                        disabled={ocupado}
                        onClick={() => abrirDetalle(p)}
                      >
                        <div className="cabecera-tarjeta-cargo">
                          <span className={`insignia-estado estado-${p.estado}`}>
                            {nombresEstado[p.estado] ?? p.estado}
                          </span>
                          <span className="insignia-vuelta-tarjeta">
                            {p.vuelta === 2 ? '2ª Vuelta' : '1ª Vuelta'}
                          </span>
                        </div>

                        <div className="cuerpo-tarjeta-cargo">
                          <strong className="nombre-cargo-tarjeta">{p.cargo}</strong>
                          <span className="ambito-cargo-tarjeta">{p.facultad || p.ambito || 'Toda la institución'}</span>
                          <small className="evento-cargo-tarjeta">{p.nombre}</small>
                        </div>

                        <div className="pie-tarjeta-cargo">
                          <span className="stats-cargo-tarjeta">
                            {p.candidatos.length} cand. · {p.mesas.length} mesas
                          </span>
                          <span className="enlace-abrir-tarjeta">Ver detalles →</span>
                        </div>
                      </button>

                      {p.estado === 'borrador' && alEliminar && (
                        <div className="acciones-rapidas-cargo-card">
                          <ConfirmarEliminacion
                            nombre={p.cargo + ' · ' + (p.ambito || p.nombre)}
                            ocupado={ocupado}
                            descripcion="Se retirará este cargo con su catálogo del panel. Los registros se conservan; no se eliminan resultados publicados."
                            alConfirmar={() => alEliminar(p)}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </>
      ) : (
        <div className="sin-cargos-institucion">
          <h3>Todavía no has agregado cargos</h3>
          <p>Pulsa «Crear nuevo cargo» para registrar Rector, Vicerrector, Decano u otro cargo.</p>
        </div>
      )}

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

              {datosEdicion && (
                <>
                  {datosEdicion.tipo === 'universidad' ? (
                    <TipoCargoUniversitario
                      key={`modal-tipo-${cargoModal.id}`}
                      cargo={datosEdicion.cargo}
                      procesos={procesos}
                      bloqueado={ocupado || guardandoEdicion}
                      alEscribir={cargo => setDatosEdicion({ ...datosEdicion, cargo })}
                      alSeleccionar={cargo => setDatosEdicion({
                        ...datosEdicion,
                        cargo,
                        unidad: ['Decano', 'Director'].includes(cargo) ? 'Carrera' : 'Facultad',
                        facultad: '',
                        grupoCarreras: '',
                        carreras: [],
                        ambito: ['Rector', 'Vicerrector'].includes(cargo) ? 'Toda la universidad' : ''
                      })}
                    />
                  ) : (
                    <label>
                      Tipo de cargo
                      <input
                        required
                        maxLength="100"
                        value={datosEdicion.cargo}
                        disabled={ocupado || guardandoEdicion}
                        onChange={e => setDatosEdicion({ ...datosEdicion, cargo: e.target.value })}
                      />
                    </label>
                  )}

                  <label>
                    Tipo de organización
                    <select
                      value={datosEdicion.tipo}
                      disabled={ocupado || guardandoEdicion}
                      onChange={e => setDatosEdicion({ ...datosEdicion, tipo: e.target.value, cargo: '', facultad: '', grupoCarreras: '', carreras: [] })}
                    >
                      <option value="universidad">Universidad</option>
                      <option value="municipio">Municipio</option>
                      <option value="otra">Otra organización</option>
                    </select>
                  </label>

                  <label>
                    ¿Cómo se agrupan las mesas? (Facultad, Comunidad, Carrera…)
                    <input
                      required
                      maxLength="80"
                      value={datosEdicion.unidad}
                      disabled={ocupado || guardandoEdicion}
                      onChange={e => setDatosEdicion({ ...datosEdicion, unidad: e.target.value })}
                    />
                  </label>

                  <OpcionesEleccion
                    datos={datosEdicion}
                    cambiar={setDatosEdicion}
                    procesos={procesos}
                    bloqueado={ocupado || guardandoEdicion}
                    identidadFija={false}
                  />
                </>
              )}

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
