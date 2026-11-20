import '../privado.css';
import React, { useEffect, useState } from 'react';
import Sesion, { ControlesSesion } from '../componentes/Sesion.jsx';
import AdministrarCuentas from '../componentes/AdministrarCuentas.jsx';
import GuiaEleccion from '../componentes/GuiaEleccion.jsx';
import EstadoPublicacion from '../componentes/EstadoPublicacion.jsx';
import { prepararEleccion } from '../api/preparacionEleccion.js';
import { consultarGraphql } from '../api/clienteGraphql.js';
import { solicitarRest } from '../api/clienteRest.js';
import { crearIdentificador } from '../api/identificadores.js';
import { establecerOrganizacion } from '../api/clienteSesion.js';
import {
  IconoTuvoto,
  IconoUrna,
  IconoRelojArena,
  IconoAlerta,
  IconoUsuarios,
  IconoBarras,
  IconoEdificio,
  IconoReloj,
  IconoInfo,
  IconoCheck,
  IconoCamara,
  IconoSubir,
  IconoCasa,
  IconoEngranaje,
  IconoFoto,
  IconoHistorial,
  IconoUsuario,
  IconoSalir,
} from '../componentes/Iconos.jsx';

const archivoComoTexto = archivo => new Promise((aceptar, rechazar) => {
  const lector = new FileReader();
  lector.onload = () => aceptar(lector.result);
  lector.onerror = () => rechazar(new Error('No se pudo leer la imagen'));
  lector.readAsDataURL(archivo);
});
const procesoVacio = { nombre: '', cargo: '', tipo: 'universidad', unidad: 'Facultad' };

function Aviso({ error, mensaje }) {
  return (
    <>
      {error && <div className="aviso" role="alert">{error}</div>}
      {mensaje && <div className="confirmacion" role="status">{mensaje}</div>}
    </>
  );
}

export default function AccesoPrivado() {
  return <Sesion>{estado => <PanelPrivado key={`${estado.sesion.idUsuario}-${estado.sesion.idOrganizacion ?? ''}`} {...estado} />}</Sesion>;
}

function PanelPrivado(estado) {
  const { sesion } = estado;
  const admin = sesion.roles.some(
    r => r.rol === 'ADMINISTRADOR' && (r.idOrganizacion === null || r.idOrganizacion === sesion.idOrganizacion)
  );
  const auditor = sesion.roles.some(r => r.rol === 'AUDITOR' && r.idOrganizacion === sesion.idOrganizacion);
  const operador = sesion.roles.some(r => r.rol === 'OPERADOR' && r.idOrganizacion === sesion.idOrganizacion);

  return (
    <div className="aplicacion-privada">
      <Aviso error={estado.error} />
      {admin ? (
        <PanelAdministrador sesion={sesion} {...estado} />
      ) : operador ? (
        <PanelOperador sesion={sesion} {...estado} />
      ) : auditor ? (
        <PanelAuditor sesion={sesion} {...estado} />
      ) : (
        <main className="zona-principal-privada" style={{ padding: 40 }}>
          <div className="panel-admin" style={{ padding: 32 }}>
            <h2>Acceso sin funciones asignadas</h2>
            <p>Solicita al administrador un rol y una organización autorizados.</p>
            <ControlesSesion {...estado} />
          </div>
        </main>
      )}
    </div>
  );
}

/* =========================================================================
   2 · ADMINISTRADOR (Panel con barra lateral, métricas y gestión completa)
   ========================================================================= */
function PanelAdministrador({ sesion, salir, seleccionar, ocupado: ocupadoSesion }) {
  const [pestana, setPestana] = useState('resumen');
  const [mostrarGuia, setMostrarGuia] = useState(false);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [creandoProceso, setCreandoProceso] = useState(false);
  const [modoCuenta, setModoCuenta] = useState('usuario');
  const [asignacionesConfirmadas, setAsignacionesConfirmadas] = useState(0);
  const [catalogoConfirmado, setCatalogoConfirmado] = useState(false);
  const [publicacionConfirmada, setPublicacionConfirmada] = useState(false);
  const [organizaciones, setOrganizaciones] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [org, setOrg] = useState(sesion.idOrganizacion ?? '');
  const [procesos, setProcesos] = useState([]);
  const [id, setId] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [version, setVersion] = useState(0);

  const [datos, setDatos] = useState(procesoVacio);
  const [eventoBase, setEventoBase] = useState('');
  const [candidato, setCandidato] = useState({ nombre: '', foto: '' });
  const [mesa, setMesa] = useState({ codigo: '', unidad: '' });
  const [asignacion, setAsignacion] = useState({ idMesa: '', idUsuario: '' });

  const actual = procesos.find(p => p.id === id);
  const bloqueado = ocupado || ocupadoSesion || cargandoDatos;
  const administradorGlobal = sesion.roles.some(r => r.rol === 'ADMINISTRADOR' && r.idOrganizacion === null);
  const preparacion = prepararEleccion({ organizacion: org, proceso: actual, cuentas, asignacionesConfirmadas });
  const eventosConfigurados = [...new Map(procesos.map(p => [p.nombre, p])).values()];
  function nuevaEleccion(base) {
    setEventoBase(base?.nombre ?? '');
    setDatos(base ? { nombre: base.nombre, cargo: '', tipo: base.tipo, unidad: base.unidad } : procesoVacio);
    setCreandoProceso(true); setPestana('configuracion'); setError(''); setMensaje('');
  }
  function irPaso(paso) {
    if (paso.id === 'organizacion') { setModoCuenta(administradorGlobal ? 'organizacion' : 'usuario'); setPestana('usuarios'); if (!administradorGlobal) setError('Selecciona tu organización en el selector superior.'); return; }
    if (!org) { setError('Primero selecciona o crea una organización.'); setModoCuenta(administradorGlobal ? 'organizacion' : 'usuario'); setPestana('usuarios'); return; }
    if (!actual && !['eleccion', 'operadores'].includes(paso.id)) { setCreandoProceso(true); setPestana('configuracion'); return; }
    if (paso.id === 'operadores') setModoCuenta('usuario');
    if (paso.id === 'eleccion') setCreandoProceso(!actual);
    setError(''); setPestana(paso.destino);
  }
  useEffect(() => {
    setAsignacion({ idMesa: '', idUsuario: '' }); setAsignacionesConfirmadas(0);
    setCatalogoConfirmado(false); setPublicacionConfirmada(false);
    setCandidato({ nombre: '', foto: '' }); setMesa({ codigo: '', unidad: '' });
  }, [org, id]);
  useEffect(() => { setDatos(procesoVacio); setEventoBase(''); }, [org]);

  const pedir = (ruta, op = {}) => solicitarRest(ruta, { ...op, organizacion: org });

  useEffect(() => {
    let v = true;
    solicitarRest('/organizaciones')
      .then(d => { if (v) { setOrganizaciones(d.elementos);
        const activas = d.elementos.filter(o => o.activa);
        setOrg(anterior => anterior || (activas.length === 1 ? activas[0].idOrganizacion : ''));
      } })
      .catch(e => { if (v) setError(e.message); });
    return () => { v = false; };
  }, [version]);

  useEffect(() => {
    let v = true;
    setProcesos([]);
    setCuentas([]);
    if (!org) { establecerOrganizacion(''); setCargandoDatos(false); return; }
    setCargandoDatos(true); establecerOrganizacion(org);
    Promise.all([pedir('/configuracion/procesos'), pedir('/usuarios')])
      .then(([p, c]) => {
        if (v) {
          setProcesos(p.elementos);
          setCuentas(c.elementos);
          setId(anterior => p.elementos.some(item => item.id === anterior)
            ? anterior : (p.elementos.find(item => item.actual) || p.elementos[0])?.id ?? '');
        }
      })
      .catch(e => { if (v) setError(e.message); })
      .finally(() => { if (v) setCargandoDatos(false); });
    return () => { v = false; };
  }, [org, version]);

  async function guardar(operacion, confirmacion = 'Cambios guardados correctamente.') {
    if (bloqueado) return;
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      await operacion();
      setMensaje(confirmacion);
      setVersion(v => v + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  const operadoresCount = cuentas.filter(c => c.activo && c.roles?.some(r => r.rol === 'OPERADOR' && r.idOrganizacion === org)).length;
  const mesasCount = actual?.mesas?.length ?? 0;
  const facultadesCount = actual?.mesas ? new Set(actual.mesas.map(m => m.unidad)).size : 0;

  return (
    <>
      {/* Barra Lateral Administrador */}
      <aside className="barra-lateral-privada">
        <div className="cabecera-lateral-marca">
          <IconoTuvoto tamano={28} />
          <span style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF', letterSpacing: 0.5 }}>TUVOTO</span>
        </div>

        <nav className="navegacion-lateral">
          <button type="button" className={`item-menu-lateral control-guia-lateral ${mostrarGuia ? 'guia-activada' : ''}`}
            aria-label={mostrarGuia ? 'Desactivar guía paso a paso' : 'Activar guía paso a paso'}
            aria-pressed={mostrarGuia} aria-expanded={mostrarGuia} aria-controls="guia-preparacion-opcional"
            onClick={() => setMostrarGuia(anterior => !anterior)}>
            <IconoInfo tamano={18}/><span>Guía</span><small>{mostrarGuia ? 'Activada' : 'Activar'}</small>
          </button>
          <button
            disabled={bloqueado}
            className={`item-menu-lateral ${pestana === 'resumen' ? 'activo' : ''}`}
            onClick={() => setPestana('resumen')}
          >
            <IconoCasa tamano={18} />
            <span>Resumen</span>
          </button>
          <button
            disabled={bloqueado}
            className={`item-menu-lateral ${pestana === 'configuracion' ? 'activo' : ''}`}
            onClick={() => irPaso({ id: 'eleccion', destino: 'configuracion' })}
          >
            <IconoEngranaje tamano={18} />
            <span>Elección</span>
          </button>
          <button
            disabled={bloqueado}
            className={`item-menu-lateral ${pestana === 'candidatos' ? 'activo' : ''}`}
            onClick={() => irPaso({ id: 'candidatos', destino: 'candidatos' })}
          >
            <IconoUsuarios tamano={18} />
            <span>Candidatos</span>
          </button>
          <button
            disabled={bloqueado}
            className={`item-menu-lateral ${pestana === 'mesas' ? 'activo' : ''}`}
            onClick={() => irPaso({ id: 'mesas', destino: 'mesas' })}
          >
            <IconoUrna tamano={18} />
            <span>Mesas</span>
          </button>
          <button
            disabled={bloqueado}
            className={`item-menu-lateral ${pestana === 'usuarios' ? 'activo' : ''}`}
            onClick={() => { setModoCuenta('usuario'); setPestana('usuarios'); }}
          >
            <IconoUsuario tamano={18} />
            <span>Usuarios</span>
          </button>
          <button disabled={bloqueado} className={`item-menu-lateral ${pestana === 'asignaciones' ? 'activo' : ''}`} onClick={() => irPaso({ id: 'asignaciones', destino: 'asignaciones' })}><IconoUsuario tamano={18}/><span>Asignar operadores</span></button>
          <button disabled={bloqueado} className={`item-menu-lateral ${pestana === 'publicacion' ? 'activo' : ''}`} onClick={() => irPaso({ id: 'publicacion', destino: 'publicacion' })}><IconoCheck tamano={18}/><span>Publicación</span></button>
        </nav>

        <div className="pie-lateral-privado">
          <a href="#resultados" style={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>← Ver resultados públicos</span>
          </a>
        </div>
      </aside>

      {/* Zona Principal Administrador */}
      <main className="zona-principal-privada">
        {/* Barra Superior */}
        <header className="cabecera-superior-privada">
          <div className="titulo-seccion-privada">
            <h1>Administración de la elección</h1>
            <div className="subtitulo-seccion-privada">
              Elección seleccionada: <strong>{actual?.nombre ?? 'Selecciona una organización y proceso'}</strong>
            </div>
          </div>

          <ControlesSesion
            sesion={sesion}
            ocupado={ocupado || ocupadoSesion}
            salir={salir}
            seleccionar={seleccionar}
            subtituloRol="Administrador"
          />
        </header>

        {/* Contenido según pestaña */}
        <div className="contenido-seccion-privada">
          <Aviso error={error} mensaje={mensaje} />

          {cargandoDatos && <p role="status">Cargando la configuración de tu organización…</p>}
          <div id="guia-preparacion-opcional" hidden={!mostrarGuia}>
            {mostrarGuia && <GuiaEleccion preparacion={preparacion} ocupado={bloqueado} alIr={irPaso}/>}
          </div>
          {/* Selector de Organización */}
          <div className="panel-admin" style={{ padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <strong style={{ fontSize: 14, color: 'var(--azul-oscuro)' }}>Organización de trabajo:</strong>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--secundario)' }}>
                  El administrador configura y asigna usuarios. No modifica votos ni publica actas.
                </p>
              </div>
              <select
                aria-label="Organización de trabajo" disabled={bloqueado}
                value={org}
                onChange={e => { setOrg(e.target.value); setId(''); setError(''); }}
                className="selector-unidades-publico"
                style={{ minWidth: 220 }}
              >
                <option value="">Selecciona organización</option>
                {organizaciones.filter(o => o.activa).map(o => (
                  <option key={o.idOrganizacion} value={o.idOrganizacion}>{o.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {org && <section className="panel-admin contexto-eleccion">
            <label>Elección que estás gestionando
              <select value={id} disabled={bloqueado} onChange={e => { setId(e.target.value); setCreandoProceso(false); }}>
                <option value="">Selecciona una elección</option>
                {procesos.map(p => <option key={p.id} value={p.id}>{p.nombre} · {p.cargo}{p.actual ? ' · Destacado' : p.publicado ? ' · Público' : ''}</option>)}
              </select>
            </label>
            <button type="button" className="boton secundario" disabled={bloqueado} onClick={() => nuevaEleccion()}>+ Nuevo evento</button>
            {actual && <button type="button" className="boton secundario" disabled={bloqueado} onClick={() => nuevaEleccion(actual)}>+ Añadir cargo a este evento</button>}
          </section>}
          {pestana === 'resumen' && (
            <>
              {!cargandoDatos && <EstadoPublicacion preparacion={preparacion} proceso={actual} ocupado={bloqueado} alIr={irPaso} alAgregarCargo={() => nuevaEleccion(actual)} />}
              {/* 3 Métricas del Administrador (como en el mock) */}
              <div className="resumen-admin-metricas">
                <div className="tarjeta-admin-metrica">
                  <div className="icono-admin-metrica">
                    <IconoUrna tamano={22} />
                  </div>
                  <strong>{mesasCount} mesas configuradas</strong>
                </div>

                <div className="tarjeta-admin-metrica">
                  <div className="icono-admin-metrica">
                    <IconoEdificio tamano={22} />
                  </div>
                  <strong>{facultadesCount} {actual?.unidad ? actual.unidad.toLowerCase() + 's' : 'facultades'}</strong>
                </div>

                <div className="tarjeta-admin-metrica">
                  <div className="icono-admin-metrica">
                    <IconoUsuarios tamano={22} />
                  </div>
                  <strong>{operadoresCount} operadores</strong>
                </div>
              </div>

              {/* Grid: Usuarios y asignaciones / Configuración del proceso */}
              <div className="grid-administrador-resumen">
                {/* Panel Izquierdo: Usuarios y asignaciones */}
                <div className="panel-admin">
                  <div className="cabecera-panel-admin">
                    <h3>
                      <IconoUsuarios tamano={18} color="var(--azul-principal)" />
                      <span>Usuarios y asignaciones</span>
                    </h3>
                    <button
                      className="boton primario"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => { setModoCuenta('usuario'); setPestana('usuarios'); }}
                    >
                      + Crear operador
                    </button>
                  </div>

                  <table className="tabla-admin">
                    <thead>
                      <tr>
                        <th>Cuenta</th>
                        <th>Rol</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuentas.filter(c => c.roles?.some(r => r.rol === 'OPERADOR' && r.idOrganizacion === org)).length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', color: 'var(--secundario)', padding: 20 }}>
                            No hay operadores registrados en esta organización.
                          </td>
                        </tr>
                      ) : (
                        cuentas
                          .filter(c => c.roles?.some(r => r.rol === 'OPERADOR' && r.idOrganizacion === org))
                          .slice(0, 5)
                          .map(c => (
                            <tr key={c.idUsuario}>
                              <td><strong>{c.usuario}</strong></td>
                              <td><span className="estado-activo-pill" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>OPERADOR DE ACTAS</span></td>
                              <td><span className="estado-activo-pill">{c.activo ? 'Activo' : 'Inactivo'}</span></td>
                              <td>
                                <button
                                  className="boton-accion-tabla"
                                  onClick={() => { setAsignacion({ idMesa: '', idUsuario: c.idUsuario }); irPaso({ id: 'asignaciones', destino: 'asignaciones' }); }}
                                >
                                  Asignar mesa
                                </button>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Panel Derecho: Configuración del proceso */}
                <div className="panel-admin">
                  <div className="cabecera-panel-admin">
                    <h3>
                      <IconoEngranaje tamano={18} color="var(--azul-principal)" />
                      <span>Configuración del proceso</span>
                    </h3>
                  </div>

                  <div style={{ padding: 20 }}>
                    {actual ? (
                      <div className="formulario-simple">
                        <div>
                          <span style={{ fontSize: 12, color: 'var(--secundario)' }}>Tipo de elección:</span>
                          <p style={{ margin: '2px 0 10px', fontWeight: 600, color: 'var(--azul-oscuro)' }}>
                            {actual.tipo.charAt(0).toUpperCase() + actual.tipo.slice(1)}
                          </p>
                        </div>
                        <div>
                          <span style={{ fontSize: 12, color: 'var(--secundario)' }}>Unidad de agrupación:</span>
                          <p style={{ margin: '2px 0 10px', fontWeight: 600, color: 'var(--azul-oscuro)' }}>
                            {actual.unidad}
                          </p>
                        </div>
                        <div>
                          <span style={{ fontSize: 12, color: 'var(--secundario)' }}>Estado en el portal público:</span>
                          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span className="estado-activo-pill" style={{ background: actual.actual ? '#DCFCE7' : '#F1F5F9', color: actual.actual ? '#166534' : '#64748B' }}>
                              {actual.actual ? 'Evento destacado' : actual.publicado ? 'Visible en el portal' : 'No visible públicamente'}
                            </span>
                            {!actual.actual && (
                              <button
                                className="boton primario"
                                style={{ padding: '6px 12px', fontSize: 12 }}
                                disabled={bloqueado}
                                onClick={() => setPestana('publicacion')}
                              >
                                Revisar publicación
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p style={{ color: 'var(--secundario)', fontSize: 13 }}>Selecciona o crea un proceso en la pestaña Configuración.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Panel Inferior: Fotografías de candidatos (Gestión de imagen de candidaturas) */}
              {actual && (
                <div className="panel-admin">
                  <div className="cabecera-panel-admin">
                    <h3>
                      <IconoFoto tamano={18} color="var(--azul-principal)" />
                      <span>Fotografías de candidatos</span>
                    </h3>
                    <span className="insignia-suave" style={{ color: '#0369A1', background: '#F0F9FF', borderColor: '#BAE6FD' }}>
                      Gestión de imagen de candidaturas
                    </span>
                  </div>

                  <div className="grid-candidatos-fotos">
                    {actual.candidatos.length === 0 ? (
                      <p style={{ color: 'var(--secundario)', padding: 10 }}>No hay candidaturas registradas aún.</p>
                    ) : (
                      actual.candidatos.map(c => (
                        <article key={c.id} className="tarjeta-candidato-foto">
                          {c.foto ? (
                            <img src={c.foto} alt={`Fotografía de ${c.nombre}`} />
                          ) : (
                            <div className="avatar-letra">{c.nombre.slice(0, 1)}</div>
                          )}
                          <strong>{c.nombre}</strong>
                          <label className="boton-cambiar-foto">
                            <IconoCamara tamano={14} />
                            <span>Cambiar fotografía</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png"
                              disabled={bloqueado}
                              onChange={e => {
                                const f = e.target.files[0];
                                if (f) {
                                  guardar(async () => {
                                    if (f.size > 2000000) throw Error('Máximo 2 MB para la fotografía');
                                    await pedir(`/configuracion/candidatos/${c.id}/foto`, {
                                      metodo: 'PUT',
                                      datos: { foto: await archivoComoTexto(f) },
                                    });
                                  });
                                }
                              }}
                            />
                          </label>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {pestana === 'configuracion' && org && (
            <div className="panel-admin" style={{ padding: 24 }}>
              <h2 style={{ fontSize: 18, color: 'var(--azul-oscuro)', marginBottom: 16 }}>{creandoProceso || procesos.length === 0 ? eventoBase ? 'Añadir un cargo al evento' : 'Crear evento y primer cargo' : 'Elección seleccionada'}</h2>
              {!creandoProceso && procesos.length > 0 && <p>Estás gestionando <strong>{actual?.nombre ?? 'la elección del selector superior'}</strong>. Continúa con sus candidatos o añade otro cargo desde el selector superior.</p>}
              {(creandoProceso || procesos.length === 0) && (
              <form
                className="formulario-simple"
                onSubmit={e => {
                  e.preventDefault();
                  guardar(async () => {
                    const p = await pedir('/configuracion/procesos', { metodo: 'POST', datos });
                    setId(p.id);
                    setDatos(procesoVacio); setEventoBase(''); setCreandoProceso(false); setPestana('candidatos');
                  });
                }}
              >
                {eventosConfigurados.length > 0 && <label>
                  Evento al que pertenece el cargo
                  <select aria-label="Evento al que pertenece el cargo" value={eventoBase} disabled={bloqueado} onChange={e => {
                    const base = eventosConfigurados.find(p => p.nombre === e.target.value);
                    setEventoBase(e.target.value);
                    setDatos(base ? { nombre: base.nombre, cargo: '', tipo: base.tipo, unidad: base.unidad } : procesoVacio);
                  }}>
                    <option value="">Crear un evento nuevo</option>
                    {eventosConfigurados.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
                  </select>
                </label>}
                <label>
                  Nombre del evento electoral
                  <input required readOnly={!!eventoBase} maxLength="120" placeholder="Ej: Elecciones universitarias 2026" value={datos.nombre} onChange={e => setDatos({ ...datos, nombre: e.target.value })} />
                </label>
                <p>{eventoBase ? 'El nuevo cargo aparecerá dentro de este evento cuando lo publiques.' : 'Crea el evento con su primer cargo. Después podrás añadir Rectorado, Vicerrectorado, Decanato u otros cargos al mismo evento.'}</p>
                <label>
                  ¿Qué cargo se elige?
                  <input required maxLength="100" placeholder="Ej: Rectorado" value={datos.cargo} onChange={e => setDatos({ ...datos, cargo: e.target.value })} />
                </label>
                <label>
                  Tipo de organización
                  <select aria-label="Tipo de organización" value={datos.tipo} disabled={!!eventoBase || bloqueado} onChange={e => setDatos({ ...datos, tipo: e.target.value })}>
                    <option value="universidad">Universidad</option>
                    <option value="municipio">Municipio</option>
                    <option value="otra">Otra organización</option>
                  </select>
                </label>
                <label>
                  ¿Cómo se agrupan las mesas? (Facultad, Comunidad, Distrito…)
                  <input required maxLength="80" placeholder="Ej: Facultad, Parroquia, etc." value={datos.unidad} onChange={e => setDatos({ ...datos, unidad: e.target.value })} />
                </label>
                <button className="boton primario" disabled={bloqueado} style={{ width: 'fit-content', marginTop: 10 }}>
                  {ocupado ? 'Guardando…' : 'Crear elección y continuar'}
                </button>
                {procesos.length > 0 && <button type="button" className="boton secundario" disabled={bloqueado} onClick={() => setCreandoProceso(false)}>Cancelar: conservar la elección seleccionada</button>}
              </form>
              )}

            </div>
          )}

          {pestana === 'candidatos' && actual && (
            <div className="panel-admin" style={{ padding: 24 }}>
              <h2 style={{ fontSize: 18, color: 'var(--azul-oscuro)', marginBottom: 8 }}>
                Candidaturas para {actual.nombre}
              </h2>
              <p style={{ color: 'var(--secundario)', fontSize: 12, marginBottom: 20 }}>
                Configure candidatos antes de asignar las mesas. El catálogo queda congelado al asignar operadores.
              </p>

              <form
                className="formulario-simple"
                onSubmit={e => {
                  e.preventDefault();
                  guardar(async () => {
                    await pedir(`/configuracion/procesos/${id}/candidatos`, { metodo: 'POST', datos: candidato });
                    setCandidato({ nombre: '', foto: '' });
                  });
                }}
              >
                <label>
                  Nombre del candidato
                  <input required maxLength="120" value={candidato.nombre} onChange={e => setCandidato({ ...candidato, nombre: e.target.value })} />
                </label>
                <label>
                  Fotografía (JPEG/PNG, máx 2 MB)
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={async e => {
                      try {
                        const f = e.target.files[0];
                        if (f) {
                          if (f.size > 2000000) throw Error('Máximo 2 MB');
                          setCandidato({ ...candidato, foto: await archivoComoTexto(f) });
                        }
                      } catch (err) {
                        setError(err.message);
                      }
                    }}
                  />
                </label>
                <button className="boton primario" disabled={bloqueado} style={{ width: 'fit-content' }}>
                  {ocupado ? 'Registrando…' : 'Agregar candidato'}
                </button>
              </form>

              {actual.candidatos.length > 0 && <button type="button" className="boton secundario" disabled={bloqueado} onClick={() => setPestana('mesas')}>Ya registré los candidatos: continuar con las mesas</button>}
              <div className="grid-candidatos-fotos" style={{ marginTop: 24 }}>
                {actual.candidatos.map(c => (
                  <article key={c.id} className="tarjeta-candidato-foto">
                    {c.foto ? <img src={c.foto} alt={c.nombre} /> : <div className="avatar-letra">{c.nombre.slice(0, 1)}</div>}
                    <strong>{c.nombre}</strong>
                    <label className="boton-cambiar-foto">
                      <IconoCamara tamano={14} />
                      <span>Cambiar fotografía</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        disabled={bloqueado}
                        onChange={e => {
                          const f = e.target.files[0];
                          if (f) {
                            guardar(async () => {
                              if (f.size > 2000000) throw Error('Máximo 2 MB');
                              await pedir(`/configuracion/candidatos/${c.id}/foto`, { metodo: 'PUT', datos: { foto: await archivoComoTexto(f) } });
                            });
                          }
                        }}
                      />
                    </label>
                  </article>
                ))}
              </div>
            </div>
          )}

          {['mesas', 'asignaciones'].includes(pestana) && actual && (
            <div className="panel-admin" style={{ padding: 24 }}>
              <h2 style={{ fontSize: 18, color: 'var(--azul-oscuro)', marginBottom: 16 }}>
                {pestana === 'mesas' ? 'Registrar mesas' : 'Asignar responsables'} · {actual.mesas.length} mesas esperadas
              </h2>

              <div className="formularios-preparacion-mesas">
                {pestana === 'mesas' && <>
                <form
                  className="formulario-simple"
                  onSubmit={e => {
                    e.preventDefault();
                    guardar(async () => {
                      await pedir(`/configuracion/procesos/${id}/mesas`, { metodo: 'POST', datos: mesa });
                      setMesa({ codigo: '', unidad: '' });
                    });
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 15, color: 'var(--azul-oscuro)' }}>Agregar mesa</h3>
                  <label>
                    Código de mesa
                    <input required placeholder="Ej: Mesa 081" value={mesa.codigo} onChange={e => setMesa({ ...mesa, codigo: e.target.value })} />
                  </label>
                  <label>
                    {actual.unidad}
                    <input required placeholder={`Ej: ${actual.unidad}`} value={mesa.unidad} onChange={e => setMesa({ ...mesa, unidad: e.target.value })} />
                  </label>
                  <button className="boton primario" disabled={bloqueado} style={{ width: 'fit-content' }}>
                    Agregar mesa
                  </button>
                </form>

                <p>Registra todas las mesas esperadas. Después asigna un responsable a cada una.</p>
                <ul className="lista-mesas-preparacion">{actual.mesas.map(m => <li key={m.id}><span><strong>{m.codigo}</strong> · {m.unidad}</span><button type="button" className="boton secundario" disabled={bloqueado} onClick={() => { setAsignacion({ idMesa: m.id, idUsuario: '' }); setPestana('asignaciones'); }}>Asignar operador</button></li>)}</ul>
                <button type="button" className="boton primario" disabled={bloqueado || !actual.mesas.length} onClick={() => setPestana('asignaciones')}>Continuar con las asignaciones</button>
                </>}
                {pestana === 'asignaciones' && <>
                {!preparacion.operadores.length && <div className="aviso">Todavía no hay operadores disponibles en esta organización. <button type="button" className="boton secundario" onClick={() => { setModoCuenta('usuario'); setPestana('usuarios'); }}>Crear operador</button></div>}
                <p>Primero completa los candidatos. Al asignar la primera mesa se congela el catálogo. Guarda cada asignación por separado.</p>
                <form
                  className="formulario-simple"
                  onSubmit={e => {
                    e.preventDefault();
                    guardar(async () => { await pedir(`/configuracion/mesas/${asignacion.idMesa}/asignar`, { metodo: 'POST', datos: { idUsuario: asignacion.idUsuario } }); setAsignacionesConfirmadas(n => n + 1); setAsignacion({ idMesa: '', idUsuario: '' }); }, 'Asignación guardada. Puedes asignar otra mesa o revisar la publicación.');
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 15, color: 'var(--azul-oscuro)' }}>Asignar operador a mesa</h3>
                  <label>
                    Mesa
                    <select required value={asignacion.idMesa} onChange={e => setAsignacion({ ...asignacion, idMesa: e.target.value })}>
                      <option value="">Selecciona mesa</option>
                      {actual.mesas.map(m => (
                        <option value={m.id} key={m.id}>{m.codigo} · {m.unidad}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Cuenta de operador
                    <select required value={asignacion.idUsuario} onChange={e => setAsignacion({ ...asignacion, idUsuario: e.target.value })}>
                      <option value="">Selecciona cuenta</option>
                      {cuentas
                        .filter(c => c.activo && c.roles?.some(r => r.rol === 'OPERADOR' && r.idOrganizacion === org) && !c.roles.some(r => r.rol === 'ADMINISTRADOR' && (r.idOrganizacion === null || r.idOrganizacion === org)))
                        .map(c => (
                          <option key={c.idUsuario} value={c.idUsuario}>{c.usuario}</option>
                        ))}
                    </select>
                  </label>
                  <label className="confirmacion-preparacion"><input type="checkbox" checked={catalogoConfirmado} onChange={e => setCatalogoConfirmado(e.target.checked)} required/><span>Ya registré todos los candidatos de esta elección.</span></label>
                  <button className="boton primario" disabled={bloqueado || !catalogoConfirmado || !actual.candidatos.length || !asignacion.idMesa || !asignacion.idUsuario} style={{ width: 'fit-content' }}>
                    Guardar asignación
                  </button>
                </form>
                {asignacionesConfirmadas > 0 && <p role="status">{asignacionesConfirmadas} operaciones de asignación guardadas en esta sesión.</p>}
                <button type="button" className="boton secundario" disabled={bloqueado} onClick={() => setPestana('publicacion')}>Revisar publicación</button>
                </>}

              </div>
            </div>
          )}

          {pestana === 'publicacion' && actual && <section className="panel-admin revision-publicacion">
            <h2>Publicar el cargo y destacar su evento</h2>
            <p>Los cargos publicados con el mismo nombre de evento y organización aparecen juntos. Dentro del evento, Rectorado se muestra primero.</p>
            <dl><dt>Organización</dt><dd>{organizaciones.find(o => o.idOrganizacion === org)?.nombre ?? 'Organización seleccionada'}</dd><dt>Evento</dt><dd>{actual.nombre}</dd><dt>Cargo</dt><dd>{actual.cargo}</dd><dt>Candidatos</dt><dd>{actual.candidatos.length}</dd><dt>Mesas esperadas</dt><dd>{actual.mesas.length}</dd></dl>
            <p>La publicación permite consultar resultados. Destacar también selecciona el proceso actual para la recepción de actas. Los operadores conservan sus permisos y mesas asignadas.</p>
            {(actual.publicado || actual.actual) && <p className="confirmacion">Este cargo está publicado{actual.actual ? ' y su evento está destacado' : ''}. <a href="#resultados">Abrir resultados públicos</a></p>}
            {!preparacion.puedePublicar && <p className="aviso">Agrega al menos un candidato y una mesa antes de publicar.</p>}
            <label className="confirmacion-preparacion"><input type="checkbox" checked={publicacionConfirmada} onChange={e => setPublicacionConfirmada(e.target.checked)}/><span>Revisé el evento, el cargo y sus candidatos. Los otros cargos publicados seguirán disponibles hasta que se oculten.</span></label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {!actual.publicado && !actual.actual && <button type="button" className="boton primario" disabled={bloqueado || !preparacion.puedePublicar || !publicacionConfirmada} onClick={() => guardar(() => pedir(`/configuracion/procesos/${id}/publicacion`, { metodo: 'PUT', datos: { publicado: true } }), 'Cargo publicado en el catálogo de eventos.')}>Publicar este cargo</button>}
              {!actual.actual && <button type="button" className="boton primario" disabled={bloqueado || !preparacion.puedePublicar || !publicacionConfirmada} onClick={() => guardar(() => pedir(`/configuracion/procesos/${id}/actual`, { metodo: 'POST' }), 'Evento destacado. Este proceso está habilitado para recibir actas.')}>Publicar y destacar evento</button>}
              {(actual.publicado || actual.actual) && <button type="button" className="boton secundario" disabled={bloqueado || !publicacionConfirmada} onClick={() => guardar(() => pedir(`/configuracion/procesos/${id}/publicacion`, { metodo: 'PUT', datos: { publicado: false } }), 'Cargo oculto del portal público.')}>Ocultar este cargo{actual.actual ? ' y desactivar su recepción de actas' : ''}</button>}
            </div>
          </section>}

          {pestana === 'usuarios' && (<>
            <AdministrarCuentas
              key={`${org}-${modoCuenta}`}
              organizacionInicial={org}
              accionInicial={!org && sesion.roles.some(r => r.rol === 'ADMINISTRADOR' && r.idOrganizacion === null) ? 'organizacion' : modoCuenta}
              rolInicial="OPERADOR"
              alCrearOrganizacion={creada => { setOrg(creada.idOrganizacion); setId(''); setCreandoProceso(true); setPestana('configuracion'); }}
              esGlobal={sesion.roles.some(r => r.rol === 'ADMINISTRADOR' && r.idOrganizacion === null)}
              organizaciones={organizaciones}
              cuentas={cuentas}
              idActual={sesion.idUsuario}
              alGuardar={() => setVersion(v => v + 1)}
            />
            {org && <section className="panel-admin cuentas-preparacion">
              <h2>Cuentas de esta organización</h2>
              <p>El rol Operador permite registrar actas; después debes asignarle sus mesas.</p>
              <div className="tabla-preparacion-scroll"><table className="tabla-admin"><thead><tr><th>Usuario</th><th>Roles en esta organización</th><th>Estado</th></tr></thead><tbody>
                {cuentas.filter(c => c.roles?.some(r => r.idOrganizacion === org)).map(c => <tr key={c.idUsuario}><td>{c.usuario}</td><td>{c.roles.filter(r => r.idOrganizacion === org).map(r => r.rol).join(', ')}</td><td>{c.activo ? 'Activo' : 'Inactivo'}</td></tr>)}
              </tbody></table></div>
              {preparacion.operadores.length === 0 && <p>Todavía no hay una cuenta de operador habilitada para esta organización.</p>}
              {actual && <button type="button" className="boton primario" disabled={bloqueado || !preparacion.operadores.length} onClick={() => setPestana('asignaciones')}>Continuar: asignar mesas a operadores</button>}
            </section>}
          </>
          )}
        </div>
      </main>
    </>
  );
}

/* =========================================================================
   3 · OPERADOR DE ACTAS (Registro con fotografía, verificación y validación)
   ========================================================================= */
function PanelOperador({ sesion, salir, seleccionar, ocupado: ocupadoSesion }) {
  const [mesas, setMesas] = useState([]);
  const [id, setId] = useState('');
  const [contexto, setContexto] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [foto, setFoto] = useState('');
  const [votos, setVotos] = useState({});
  const [blancos, setBlancos] = useState(0);
  const [nulos, setNulos] = useState(0);
  const [total, setTotal] = useState(0);
  const [confirmado, setConfirmado] = useState(false);
  const [solicitud, setSolicitud] = useState(crearIdentificador);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    solicitarRest('/mis-mesas')
      .then(d => {
        setMesas(d.elementos);
        if (d.elementos.length > 0 && !id) {
          setId(d.elementos[0].id);
        }
      })
      .catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    let v = true;
    setContexto(null);
    setHistorial(null);
    setFoto('');
    setConfirmado(false);
    setError('');
    if (!id) return;
    Promise.all([solicitarRest(`/mesas/${id}/contexto`), solicitarRest(`/actas/mesa/${id}`)])
      .then(([c, h]) => {
        if (v) {
          setContexto(c);
          setHistorial(h);
          setVotos(Object.fromEntries(c.candidatos.map(cand => [cand.id, 0])));
          setBlancos(0);
          setNulos(0);
          setTotal(0);
          setSolicitud(crearIdentificador());
        }
      })
      .catch(e => { if (v) setError(e.message); });
    return () => { v = false; };
  }, [id, version]);

  const cambiar = (setter, valor) => {
    setter(valor);
    setConfirmado(false);
    setSolicitud(crearIdentificador());
  };

  const sumaCalculada = Object.values(votos).reduce((a, b) => a + b, 0) + blancos + nulos;
  const sumaCoincide = sumaCalculada === total;

  async function publicar(e) {
    e.preventDefault();
    if (ocupado || !historial) return;
    setOcupado(true);
    setError('');
    try {
      const datos = {
        idMesa: id,
        idSolicitud: solicitud,
        versionAnterior: historial.versionAnterior,
        foto,
        votos: Object.entries(votos).map(([idCandidato, cantidad]) => ({ idCandidato, cantidad })),
        blancos,
        nulos,
        total,
        confirmado,
      };
      const r = historial.versionAnterior > 0
        ? await solicitarRest('/actas/mesas/' + id, { metodo: 'PUT', datos })
        : (await consultarGraphql('mutation Registrar($entrada:NuevaActa!){registrarActa(entrada:$entrada){id version estado}}', { entrada: datos })).datos.registrarActa;

      setMensaje(
        r.estado === 'publicada'
          ? 'Acta confirmada. La publicación de resultados se procesa en segundo plano.'
          : 'Acta observada: las sumas no coinciden. No se incorpora un aporte nuevo.'
      );
      setVersion(v => v + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      {/* Barra Lateral Operador */}
      <aside className="barra-lateral-privada">
        <div className="cabecera-lateral-marca">
          <IconoTuvoto tamano={28} />
          <span style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF' }}>TUVOTO</span>
        </div>

        <nav className="navegacion-lateral">
          <button className="item-menu-lateral activo">
            <IconoCamara tamano={18} />
            <span>Registro de actas</span>
          </button>
        </nav>

        <div className="pie-lateral-privado">
          <a href="#resultados" style={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>← Ver resultados públicos</span>
          </a>
        </div>
      </aside>

      {/* Zona Principal Operador */}
      <main className="zona-principal-privada">
        {/* Cabecera Superior */}
        <header className="cabecera-superior-privada">
          <div className="titulo-seccion-privada">
            <h1>Registro de actas</h1>
            <div className="subtitulo-seccion-privada">
              {contexto ? `Elección actual · ${contexto.unidad}` : 'Selecciona una mesa asignada'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {mesas.length > 0 && (
              <select
                aria-label="Mesa asignada"
                value={id}
                onChange={e => setId(e.target.value)}
                className="selector-mesa-topbar"
              >
                {mesas.map(m => (
                  <option key={m.id} value={m.id}>Mesa {m.codigo}</option>
                ))}
              </select>
            )}

            <ControlesSesion
              sesion={sesion}
              ocupado={ocupado || ocupadoSesion}
              salir={salir}
              seleccionar={seleccionar}
              subtituloRol={`Operador · ${contexto?.unidad ?? 'Mesa'}`}
            />
          </div>
        </header>

        {/* Contenido Operador */}
        <div className="contenido-seccion-privada">
          <Aviso error={error} mensaje={mensaje} />

          {mesas.length === 0 ? (
            <div className="panel-admin" style={{ padding: 32, textAlign: 'center' }}>
              <p style={{ color: 'var(--secundario)' }}>No hay mesas asignadas para la elección actual. Solicita la asignación al administrador.</p>
            </div>
          ) : !contexto || !historial ? (
            <p style={{ color: 'var(--secundario)' }}>Cargando información de la mesa…</p>
          ) : (
            <>
              <form onSubmit={publicar}>
                <div className="grid-operador-registro">
                  {/* Columna Izquierda: Fotografía del acta */}
                  <section className="panel-foto-acta">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h3 style={{ margin: 0, fontSize: 16, color: 'var(--azul-oscuro)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconoFoto tamano={18} color="var(--azul-principal)" />
                        <span>Fotografía del acta</span>
                      </h3>
                      <span className="insignia-suave">Copia digital respaldada</span>
                    </div>

                    <div className="visor-foto-acta">
                      {foto ? (
                        <img src={foto} alt="Fotografía del acta a comparar con el conteo" className="imagen-acta-cargada" />
                      ) : (
                        <div className="visor-placeholder">
                          <IconoCamara tamano={48} color="#94A3B8" />
                          <p style={{ marginTop: 12, fontSize: 13 }}>Fotografía pendiente de capturar o subir</p>
                          <small style={{ color: '#94A3B8' }}>Formatos aceptados: JPEG o PNG (máximo 10 MB)</small>
                        </div>
                      )}
                    </div>

                    <div className="acciones-foto-acta">
                      <label className="boton-camara">
                        <IconoCamara tamano={16} />
                        <span>Tomar fotografía</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          capture="environment"
                          required={!foto}
                          disabled={ocupado}
                          onChange={async e => {
                            try {
                              const f = e.target.files[0];
                              if (f) {
                                if (f.size > 10000000) throw Error('Máximo 10 MB');
                                cambiar(setFoto, await archivoComoTexto(f));
                              }
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                        />
                      </label>

                      <label className="boton-camara">
                        <IconoSubir tamano={16} />
                        <span>Subir imagen</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          disabled={ocupado}
                          onChange={async e => {
                            try {
                              const f = e.target.files[0];
                              if (f) {
                                if (f.size > 10000000) throw Error('Máximo 10 MB');
                                cambiar(setFoto, await archivoComoTexto(f));
                              }
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                        />
                      </label>

                      <span className="insignia-original-conservado">
                        <IconoCheck tamano={14} color="#059669" />
                        <span>El original se conserva al confirmar</span>
                      </span>
                    </div>
                  </section>

                  {/* Columna Derecha: Transcribe y verifica los datos */}
                  <section className="panel-verificacion-acta">
                    <h3 style={{ margin: 0, fontSize: 16, color: 'var(--azul-oscuro)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <IconoCheck tamano={18} color="var(--azul-principal)" />
                      <span>Transcribe y verifica los datos</span>
                    </h3>
                    <p style={{ margin: '4px 0 14px', fontSize: 12, color: 'var(--secundario)' }}>
                      Compara cada número con la fotografía.
                    </p>

                    <div className="aviso-ocr-humano">
                      <strong>Reconocimiento OCR: propuesta que requiere confirmación humana.</strong>
                      <div>Transcripción manual respaldada por fotografía; no se generan cifras automáticamente.</div>
                    </div>

                    <table className="tabla-conteo-acta">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', fontSize: 12, color: 'var(--secundario)', paddingBottom: 8 }}>Candidatura</th>
                          <th style={{ textAlign: 'right', fontSize: 12, color: 'var(--secundario)', paddingBottom: 8 }}>Votos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contexto.candidatos.map(c => (
                          <tr key={c.id}>
                            <td><strong>{c.nombre}</strong></td>
                            <td style={{ textAlign: 'right' }}>
                              <input
                                type="number"
                                min="0"
                                max="1000000"
                                step="1"
                                required
                                disabled={ocupado}
                                value={votos[c.id] ?? 0}
                                onChange={e => cambiar(setVotos, { ...votos, [c.id]: Number(e.target.value) })}
                              />
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td>Blancos</td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              min="0"
                              max="1000000"
                              step="1"
                              required
                              disabled={ocupado}
                              value={blancos}
                              onChange={e => cambiar(setBlancos, Number(e.target.value))}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td>Nulos</td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              min="0"
                              max="1000000"
                              step="1"
                              required
                              disabled={ocupado}
                              value={nulos}
                              onChange={e => cambiar(setNulos, Number(e.target.value))}
                            />
                          </td>
                        </tr>
                        <tr style={{ background: '#F8FAFC' }}>
                          <td><strong>Total del acta</strong></td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              min="0"
                              max="1000000"
                              step="1"
                              required
                              disabled={ocupado}
                              value={total}
                              onChange={e => cambiar(setTotal, Number(e.target.value))}
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Validación de sumas */}
                    <div className={`tarjeta-validacion-sumas ${sumaCoincide ? 'correcta' : 'discrepancia'}`}>
                      {sumaCoincide ? (
                        <>
                          <IconoCheck tamano={18} color="#059669" />
                          <span>Suma correcta: {total}</span>
                        </>
                      ) : (
                        <>
                          <IconoAlerta tamano={18} color="#9F1239" />
                          <span>
                            {total === 0
                              ? `Suma actual: ${sumaCalculada}`
                              : `Suma calculada (${sumaCalculada}) ≠ Total declarado (${total})`}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="tarjeta-estado-confirmacion">
                      <IconoReloj tamano={16} />
                      <span>{confirmado ? 'Listo para publicar' : 'Pendiente de confirmación'}</span>
                    </div>

                    <label className="casilla-confirmacion-acta">
                      <input
                        type="checkbox"
                        required
                        checked={confirmado}
                        disabled={ocupado}
                        onChange={e => setConfirmado(e.target.checked)}
                      />
                      <span>He comparado los datos con el acta.</span>
                    </label>

                    <button
                      type="submit"
                      className="boton-publicar-acta"
                      disabled={ocupado || !foto || !confirmado || contexto.candidatos.length === 0}
                    >
                      <IconoCheck tamano={18} />
                      <span>{ocupado ? 'Confirmando…' : 'Confirmar y publicar'}</span>
                    </button>

                    <p style={{ fontSize: 11, color: 'var(--secundario)', margin: '14px 0 0', textAlign: 'center' }}>
                      Si hay inconsistencias, el acta queda observada y no suma.
                    </p>
                  </section>
                </div>
              </form>

              {/* Historial inmutable de la mesa */}
              <section className="panel-admin" style={{ padding: 20 }}>
                <div className="cabecera-panel-admin" style={{ background: 'none', padding: 0, marginBottom: 14 }}>
                  <h3>
                    <IconoHistorial tamano={18} color="var(--azul-principal)" />
                    <span>Historial inmutable de la mesa</span>
                  </h3>
                </div>

                <ul className="lista-historial-actas">
                  {historial.elementos.length === 0 ? (
                    <li style={{ color: 'var(--secundario)', fontSize: 13 }}>No hay versiones previas para esta mesa.</li>
                  ) : (
                    historial.elementos.map(a => (
                      <li key={a.id} className="item-historial-acta">
                        <div>
                          <strong>Versión {a.version}</strong> ·{' '}
                          <span className="estado-activo-pill" style={{ background: a.estado === 'publicada' ? '#DCFCE7' : '#FEE2E2', color: a.estado === 'publicada' ? '#166534' : '#9F1239' }}>
                            {a.estado}
                          </span>{' '}
                          · <small style={{ color: 'var(--secundario)' }}>{new Date(a.creado_en).toLocaleString('es-BO')}</small>
                        </div>
                        <a href={`/api/v1/actas/${a.id}/foto`} target="_blank" rel="noreferrer" className="enlace-ver-original">
                          Ver original ↗
                        </a>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}

/* =========================================================================
   4 · AUDITOR (Panel de solo lectura)
   ========================================================================= */
function PanelAuditor({ sesion, salir, seleccionar, ocupado: ocupadoSesion }) {
  const [mesas, setMesas] = useState([]);
  const [id, setId] = useState('');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    solicitarRest('/mis-mesas')
      .then(d => {
        setMesas(d.elementos);
        if (d.elementos.length > 0 && !id) setId(d.elementos[0].id);
      })
      .catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    let vigente = true;
    setDatos(null);
    setError('');
    if (id) {
      solicitarRest(`/actas/mesa/${id}`)
        .then(d => { if (vigente) setDatos(d); })
        .catch(e => { if (vigente) setError(e.message); });
    }
    return () => { vigente = false; };
  }, [id]);

  return (
    <>
      <aside className="barra-lateral-privada">
        <div className="cabecera-lateral-marca">
          <IconoTuvoto tamano={28} />
          <span style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF' }}>TUVOTO</span>
        </div>
        <nav className="navegacion-lateral">
          <button className="item-menu-lateral activo">
            <IconoHistorial tamano={18} />
            <span>Consulta de auditoría</span>
          </button>
        </nav>
        <div className="pie-lateral-privado">
          <a href="#resultados" style={{ color: '#94A3B8' }}>← Ver resultados públicos</a>
        </div>
      </aside>

      <main className="zona-principal-privada">
        <header className="cabecera-superior-privada">
          <div className="titulo-seccion-privada">
            <h1>Consulta de auditoría</h1>
            <div className="subtitulo-seccion-privada">
              Acceso de solo lectura · Integridad de actas y versiones
            </div>
          </div>
          <ControlesSesion
            sesion={sesion}
            ocupado={ocupadoSesion}
            salir={salir}
            seleccionar={seleccionar}
            subtituloRol="Auditor"
          />
        </header>

        <div className="contenido-seccion-privada">
          <Aviso error={error} />
          <div className="panel-admin" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 16, color: 'var(--azul-oscuro)', marginBottom: 8 }}>
              Actas de la organización · Solo lectura
            </h2>
            <p style={{ color: 'var(--secundario)', fontSize: 13, marginBottom: 18 }}>
              El auditor puede consultar originales y versiones; no registra ni corrige cifras.
            </p>

            <label style={{ display: 'block', marginBottom: 20, fontWeight: 600, fontSize: 13, color: 'var(--azul-oscuro)' }}>
              Mesa asignada a la organización:
              <select
                value={id}
                onChange={e => setId(e.target.value)}
                className="selector-unidades-publico"
                style={{ display: 'block', marginTop: 6, minWidth: 260 }}
              >
                <option value="">Selecciona mesa</option>
                {mesas.map(m => (
                  <option key={m.id} value={m.id}>Mesa {m.codigo} · {m.unidad}</option>
                ))}
              </select>
            </label>

            {datos && (
              <ul className="lista-historial-actas">
                {datos.elementos.length === 0 ? (
                  <li style={{ color: 'var(--secundario)' }}>No hay actas registradas para esta mesa.</li>
                ) : (
                  datos.elementos.map(a => (
                    <li key={a.id} className="item-historial-acta">
                      <div>
                        <strong>Versión {a.version}</strong> · {a.estado} · {new Date(a.creado_en).toLocaleString('es-BO')}
                      </div>
                      <a href={`/api/v1/actas/${a.id}/foto`} target="_blank" rel="noreferrer" className="enlace-ver-original">
                        Ver original ↗
                      </a>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
