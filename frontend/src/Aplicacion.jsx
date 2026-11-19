import React, { useEffect, useState } from 'react';
import Sesion, { ControlesSesion } from './componentes/Sesion.jsx';
import AdministrarCuentas from './componentes/AdministrarCuentas.jsx';
import { consultarGraphql } from './api/clienteGraphql.js';
import { solicitarRest } from './api/clienteRest.js';
import { crearIdentificador } from './api/identificadores.js';
import { comprobarPortal } from './api/datosPortal.js';
import { establecerOrganizacion } from './api/clienteSesion.js';
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
} from './componentes/Iconos.jsx';

const consulta = `query Portal($unidad:String) { portal(unidad:$unidad) { recepcion { idProceso mesasConActa versiones } proceso { id nombre cargo tipo unidad unidades candidatos { id nombre foto } } resultados { esperadas contabilizadas pendientes observadas avance blancos nulos total validos actualizadoEn candidatos { id nombre foto votos porcentaje } unidades { unidad esperadas contabilizadas pendientes } } } }`;
const numero = n => new Intl.NumberFormat('es-VE').format(n);
const archivoComoTexto = archivo => new Promise((aceptar, rechazar) => {
  const lector = new FileReader();
  lector.onload = () => aceptar(lector.result);
  lector.onerror = () => rechazar(new Error('No se pudo leer la imagen'));
  lector.readAsDataURL(archivo);
});

function Aviso({ error, mensaje }) {
  return (
    <>
      {error && <div className="aviso" role="alert">{error}</div>}
      {mensaje && <div className="confirmacion" role="status">{mensaje}</div>}
    </>
  );
}

export default function Aplicacion() {
  const [panel, cambiarPanel] = useState(location.hash === '#panel');
  useEffect(() => {
    const escuchar = () => cambiarPanel(location.hash === '#panel');
    window.addEventListener('hashchange', escuchar);
    return () => window.removeEventListener('hashchange', escuchar);
  }, []);

  return panel ? (
    <Sesion>
      {estado => <PanelPrivado key={`${estado.sesion.idUsuario}-${estado.sesion.idOrganizacion ?? ''}`} {...estado} />}
    </Sesion>
  ) : (
    <PortalPublico />
  );
}

/* =========================================================================
   1 · PÚBLICO — SIN INICIAR SESIÓN
   ========================================================================= */
function PortalPublico() {
  const [portal, cambiarPortal] = useState(null);
  const [cargando, cambiarCargando] = useState(true);
  const [error, cambiarError] = useState('');
  const [unidad, cambiarUnidad] = useState('');

  useEffect(() => {
    let vigente = true, temporizador;
    const controlador = new AbortController();
    async function cargar() {
      try {
        const { datos } = await consultarGraphql(consulta, { unidad: unidad || null }, controlador.signal);
        if (vigente) {
          cambiarPortal(comprobarPortal(datos.portal));
          cambiarError('');
        }
      } catch (e) {
        if (vigente) cambiarError(e.message);
      } finally {
        if (vigente) {
          cambiarCargando(false);
          temporizador = setTimeout(cargar, 10000);
        }
      }
    }
    cambiarPortal(null);
    cambiarCargando(true);
    cargar();
    return () => {
      vigente = false;
      clearTimeout(temporizador);
      controlador.abort();
    };
  }, [unidad]);

  const r = portal?.resultados;
  const fechaActualizacion = r?.actualizadoEn
    ? new Date(r.actualizadoEn).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
    : null;

  // Totales de unidades para la fila final de la tabla
  const unidadesFiltradas = r?.unidades ? r.unidades.filter(u => !unidad || u.unidad === unidad) : [];
  const totalContabilizadas = unidadesFiltradas.reduce((acc, u) => acc + (u.contabilizadas || 0), 0);
  const totalPendientes = unidadesFiltradas.reduce((acc, u) => acc + (u.pendientes || 0), 0);
  const totalEsperadas = unidadesFiltradas.reduce((acc, u) => acc + (u.esperadas || 0), 0);

  return (
    <>
      {/* Cabecera Pública */}
      <header className="barra-tuvoto">
        <div className="bloque-marca-publica">
          <a href="#resultados" className="marca-tuvoto">
            <IconoTuvoto tamano={34} />
            <span className="marca-tuvoto-texto">TUVOTO</span>
          </a>
          <div className="separador-vertical-cabecera" />
          <div className="subtitulo-eleccion-publica">
            <strong>{portal?.proceso?.nombre ?? 'Resultados electorales'}</strong>
            <span>{portal?.proceso?.cargo ? `${portal.proceso.cargo} · Seguimiento de resultados` : 'Consulta pública de la elección actual'}</span>
          </div>
        </div>

        <div className="acciones-cabecera-publica">
          <span className="insignia-resultados-preliminares">Resultados Preliminares</span>
          <span className="insignia-actualizado-en">
            <IconoReloj tamano={15} color="#94A3B8" />
            <span>{fechaActualizacion ? `Actualizado ${fechaActualizacion}` : 'Conteo aún no iniciado'}</span>
          </span>
          <a href="#panel" className="boton-acceso-personal">
            <IconoUsuario tamano={15} />
            <span>Acceso al personal</span>
          </a>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="portal-tuvoto">
        <Aviso error={error} />
        {error && portal && (
          <p className="aviso" style={{ background: '#FFFBEB', color: '#92400E', borderColor: '#FDE68A' }}>
            Se conserva la última respuesta recibida; no se acredita una actualización reciente.
          </p>
        )}

        {cargando ? (
          <section className="panel-publico" style={{ padding: 48, textAlign: 'center' }}>
            <p style={{ color: 'var(--secundario)', fontSize: 14 }}>Consultando elección y resultados preliminares…</p>
          </section>
        ) : !portal ? (
          <section className="panel-publico" style={{ padding: 48, textAlign: 'center' }}>
            <h2 style={{ color: 'var(--azul-oscuro)', marginBottom: 8 }}>
              {error ? 'No se pudo consultar la elección' : 'Todavía no hay una elección publicada'}
            </h2>
            <p style={{ color: 'var(--secundario)', fontSize: 13 }}>
              No se muestran cifras sin una respuesta válida de las APIs.
            </p>
          </section>
        ) : (
          <>
            {/* 4 Tarjetas Métricas */}
            <section className="tarjetas-metricas-tuvoto" aria-label="Resumen de avance de actas">
              <article className="tarjeta-metrica">
                <div className="icono-tarjeta-metrica icono-urna">
                  <IconoUrna tamano={24} />
                </div>
                <div className="dato-tarjeta-metrica">
                  <span>Mesas contabilizadas</span>
                  <strong>{r.contabilizadas} / {r.esperadas}</strong>
                </div>
              </article>

              <article className="tarjeta-metrica">
                <div className="icono-tarjeta-metrica icono-reloj">
                  <IconoRelojArena tamano={24} />
                </div>
                <div className="dato-tarjeta-metrica">
                  <span>Mesas pendientes</span>
                  <strong>{numero(r.pendientes)}</strong>
                </div>
              </article>

              <article className="tarjeta-metrica">
                <div className="icono-tarjeta-metrica icono-alerta">
                  <IconoAlerta tamano={24} />
                </div>
                <div className="dato-tarjeta-metrica">
                  <span>Actas observadas</span>
                  <strong>{numero(r.observadas)}</strong>
                </div>
              </article>

              <article className="tarjeta-metrica">
                <div className="icono-tarjeta-metrica icono-usuarios">
                  <IconoUsuarios tamano={24} />
                </div>
                <div className="dato-tarjeta-metrica">
                  <span>Votos contabilizados</span>
                  <strong>{numero(r.total)}</strong>
                </div>
              </article>
            </section>

            {/* Barra de Progreso de Mesas */}
            <section className="tarjeta-progreso-tuvoto" aria-label="Progreso general de actas">
              <span className="etiqueta-progreso-mesas">{r.avance} % de mesas contabilizadas</span>
              <div className="barra-progreso-contenedor" role="progressbar" aria-valuenow={r.avance} aria-valuemin="0" aria-valuemax="100">
                <div className="barra-progreso-relleno" style={{ width: `${Math.min(100, Math.max(r.avance, 0))}%` }}>
                  <span className="porcentaje-barra-pill">{r.avance} %</span>
                </div>
              </div>
              <div className="separador-progreso" />
              <span className="nota-progreso-mesas">
                Las {r.observadas} observadas están incluidas en las pendientes.
              </span>
            </section>

            {/* Dos Columnas: Votos por Candidatura y Avance por Unidad */}
            <div className="grid-dos-columnas">
              {/* Columna Izquierda: Votos por Candidatura */}
              <section className="panel-publico" aria-label="Votos por candidatura">
                <div className="cabecera-panel-publico">
                  <div className="titulo-icono-panel">
                    <IconoBarras tamano={18} color="var(--azul-principal)" />
                    <h2>Votos por candidatura</h2>
                  </div>
                  <span className="insignia-suave">Cómputo preliminar</span>
                </div>

                <div className="cuerpo-candidatos-publico">
                  {r.candidatos.length === 0 ? (
                    <p style={{ color: 'var(--secundario)', padding: 12 }}>No hay candidaturas configuradas.</p>
                  ) : (
                    r.candidatos.map(c => (
                      <article key={c.id} className="fila-candidato-publico">
                        {c.foto ? (
                          <img src={c.foto} alt={`Fotografía de ${c.nombre}`} className="avatar-candidato" />
                        ) : (
                          <div className="avatar-candidato avatar-letra">{c.nombre.slice(0, 1)}</div>
                        )}
                        <div className="nombre-candidato-col">
                          <strong>{c.nombre}</strong>
                          <small>{c.porcentaje}% de votos válidos</small>
                        </div>
                        <div className="barra-votos-candidato">
                          <div
                            className="relleno-votos-candidato"
                            style={{ width: `${Math.min(100, Math.max(c.porcentaje, 0))}%` }}
                          />
                        </div>
                        <div className="cifra-votos-candidato">
                          {numero(c.votos)}
                        </div>
                      </article>
                    ))
                  )}

                  <div className="resumen-blancos-nulos">
                    <span>Blancos: {numero(r.blancos)}</span>
                    <span>·</span>
                    <span>Nulos: {numero(r.nulos)}</span>
                  </div>
                </div>
              </section>

              {/* Columna Derecha: Avance por Facultad / Unidad */}
              <section className="panel-publico" aria-label="Avance por unidad">
                <div className="cabecera-panel-publico">
                  <div className="titulo-icono-panel">
                    <IconoEdificio tamano={18} color="var(--azul-principal)" />
                    <h2>Avance por {portal.proceso.unidad.toLowerCase()}</h2>
                  </div>
                  <select
                    aria-label={`Filtrar por ${portal.proceso.unidad.toLowerCase()}`}
                    value={unidad}
                    onChange={e => cambiarUnidad(e.target.value)}
                    className="selector-unidades-publico"
                  >
                    <option value="">Todas las unidades</option>
                    {portal.proceso.unidades.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <table className="tabla-avance-publico">
                  <thead>
                    <tr>
                      <th>{portal.proceso.unidad}</th>
                      <th>Contabilizadas</th>
                      <th>Pendientes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unidadesFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', color: 'var(--secundario)', padding: 24 }}>
                          Sin mesas registradas en esta unidad.
                        </td>
                      </tr>
                    ) : (
                      unidadesFiltradas.map(u => (
                        <tr key={u.unidad}>
                          <td><strong>{u.unidad}</strong></td>
                          <td>{u.contabilizadas} / {u.esperadas}</td>
                          <td>{u.pendientes}</td>
                        </tr>
                      ))
                    )}
                    {unidadesFiltradas.length > 0 && (
                      <tr className="fila-total-avance">
                        <td>Total</td>
                        <td>{totalContabilizadas} / {totalEsperadas}</td>
                        <td>{totalPendientes}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            </div>

            {/* Aviso informativo al pie */}
            <footer className="aviso-pie-publico">
              <div className="texto-aviso-pie">
                <IconoInfo tamano={18} color="#1D4ED8" />
                <span>
                  Resultados basados en actas contabilizadas. El avance por mesas no equivale al porcentaje de votos.
                </span>
              </div>
              <span className="etiqueta-aviso-pie">Consulta pública sin login · Solo actas confirmadas</span>
            </footer>
          </>
        )}
      </main>
    </>
  );
}

/* =========================================================================
   ESTRUCTURA DE PANEL PRIVADO
   ========================================================================= */
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
  const [organizaciones, setOrganizaciones] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [org, setOrg] = useState(sesion.idOrganizacion ?? '');
  const [procesos, setProcesos] = useState([]);
  const [id, setId] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [version, setVersion] = useState(0);

  const [datos, setDatos] = useState({ nombre: '', cargo: '', tipo: 'universidad', unidad: 'Facultad' });
  const [candidato, setCandidato] = useState({ nombre: '', foto: '' });
  const [mesa, setMesa] = useState({ codigo: '', unidad: '' });
  const [asignacion, setAsignacion] = useState({ idMesa: '', idUsuario: '' });

  const actual = procesos.find(p => p.id === id);

  const pedir = (ruta, op = {}) => solicitarRest(ruta, { ...op, organizacion: org });

  useEffect(() => {
    let v = true;
    solicitarRest('/organizaciones')
      .then(d => { if (v) setOrganizaciones(d.elementos); })
      .catch(e => { if (v) setError(e.message); });
    return () => { v = false; };
  }, [version]);

  useEffect(() => {
    let v = true;
    setProcesos([]);
    setCuentas([]);
    if (!org) return;
    establecerOrganizacion(org);
    Promise.all([pedir('/configuracion/procesos'), pedir('/usuarios')])
      .then(([p, c]) => {
        if (v) {
          setProcesos(p.elementos);
          setCuentas(c.elementos);
          setId(anterior => p.elementos.some(item => item.id === anterior)
            ? anterior : (p.elementos.find(item => item.actual) || p.elementos[0])?.id ?? '');
        }
      })
      .catch(e => { if (v) setError(e.message); });
    return () => { v = false; };
  }, [org, version]);

  async function guardar(operacion) {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      await operacion();
      setMensaje('Operación confirmada por la API.');
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
          <button
            className={`item-menu-lateral ${pestana === 'resumen' ? 'activo' : ''}`}
            onClick={() => setPestana('resumen')}
          >
            <IconoCasa tamano={18} />
            <span>Resumen</span>
          </button>
          <button
            className={`item-menu-lateral ${pestana === 'configuracion' ? 'activo' : ''}`}
            onClick={() => setPestana('configuracion')}
          >
            <IconoEngranaje tamano={18} />
            <span>Configuración</span>
          </button>
          <button
            className={`item-menu-lateral ${pestana === 'candidatos' ? 'activo' : ''}`}
            onClick={() => setPestana('candidatos')}
          >
            <IconoUsuarios tamano={18} />
            <span>Candidatos</span>
          </button>
          <button
            className={`item-menu-lateral ${pestana === 'mesas' ? 'activo' : ''}`}
            onClick={() => setPestana('mesas')}
          >
            <IconoUrna tamano={18} />
            <span>Mesas</span>
          </button>
          <button
            className={`item-menu-lateral ${pestana === 'usuarios' ? 'activo' : ''}`}
            onClick={() => setPestana('usuarios')}
          >
            <IconoUsuario tamano={18} />
            <span>Usuarios</span>
          </button>
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
              Elección actual: <strong>{actual?.nombre ?? 'Selecciona una organización y proceso'}</strong>
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
                aria-label="Organización de trabajo"
                value={org}
                onChange={e => { setOrg(e.target.value); setId(''); }}
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

          {pestana === 'resumen' && (
            <>
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
                      onClick={() => setPestana('usuarios')}
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
                                  onClick={() => setPestana('mesas')}
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
                              {actual.actual ? 'Visible en el portal' : 'No visible públicamente'}
                            </span>
                            {!actual.actual && (
                              <button
                                className="boton primario"
                                style={{ padding: '6px 12px', fontSize: 12 }}
                                disabled={ocupado}
                                onClick={() => guardar(() => pedir(`/configuracion/procesos/${id}/actual`, { metodo: 'POST' }))}
                              >
                                Activar en portal
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
                              disabled={ocupado}
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

          {pestana === 'configuracion' && (
            <div className="panel-admin" style={{ padding: 24 }}>
              <h2 style={{ fontSize: 18, color: 'var(--azul-oscuro)', marginBottom: 16 }}>Configurar proceso electoral</h2>
              <form
                className="formulario-simple"
                onSubmit={e => {
                  e.preventDefault();
                  guardar(async () => {
                    const p = await pedir('/configuracion/procesos', { metodo: 'POST', datos });
                    setId(p.id);
                    setDatos({ ...datos, nombre: '' });
                  });
                }}
              >
                <label>
                  Nombre del proceso electoral
                  <input required maxLength="120" placeholder="Ej: Elección de Rector 2026" value={datos.nombre} onChange={e => setDatos({ ...datos, nombre: e.target.value })} />
                </label>
                <label>
                  Cargo u objeto de la elección
                  <input required maxLength="100" placeholder="Ej: Rector y Vicerrectores" value={datos.cargo} onChange={e => setDatos({ ...datos, cargo: e.target.value })} />
                </label>
                <label>
                  Tipo de organización
                  <select value={datos.tipo} onChange={e => setDatos({ ...datos, tipo: e.target.value })}>
                    <option value="universidad">Universidad</option>
                    <option value="municipio">Municipio</option>
                    <option value="otra">Otra organización</option>
                  </select>
                </label>
                <label>
                  Nombre de la unidad de desglose
                  <input required maxLength="80" placeholder="Ej: Facultad, Parroquia, etc." value={datos.unidad} onChange={e => setDatos({ ...datos, unidad: e.target.value })} />
                </label>
                <button className="boton primario" disabled={ocupado} style={{ width: 'fit-content', marginTop: 10 }}>
                  {ocupado ? 'Guardando…' : 'Crear proceso'}
                </button>
              </form>

              <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--borde)' }}>
                <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--azul-oscuro)' }}>
                  Seleccionar proceso para gestionar:
                  <select
                    value={id}
                    onChange={e => setId(e.target.value)}
                    className="selector-unidades-publico"
                    style={{ display: 'block', marginTop: 6, minWidth: 300 }}
                  >
                    <option value="">Selecciona proceso</option>
                    {procesos.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} {p.actual ? '· Visible en portal' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
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
                <button className="boton primario" disabled={ocupado} style={{ width: 'fit-content' }}>
                  {ocupado ? 'Registrando…' : 'Agregar candidato'}
                </button>
              </form>

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
                        disabled={ocupado}
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

          {pestana === 'mesas' && actual && (
            <div className="panel-admin" style={{ padding: 24 }}>
              <h2 style={{ fontSize: 18, color: 'var(--azul-oscuro)', marginBottom: 16 }}>
                Mesas y asignaciones ({actual.mesas.length} mesas esperadas)
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Formulario Agregar Mesa */}
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
                  <button className="boton primario" disabled={ocupado} style={{ width: 'fit-content' }}>
                    Agregar mesa
                  </button>
                </form>

                {/* Formulario Asignar Operador a Mesa */}
                <form
                  className="formulario-simple"
                  onSubmit={e => {
                    e.preventDefault();
                    guardar(() => pedir(`/configuracion/mesas/${asignacion.idMesa}/asignar`, { metodo: 'POST', datos: { idUsuario: asignacion.idUsuario } }));
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
                  <button className="boton primario" disabled={ocupado || actual.candidatos.length === 0} style={{ width: 'fit-content' }}>
                    Asignar operador
                  </button>
                </form>
              </div>
            </div>
          )}

          {pestana === 'usuarios' && (
            <AdministrarCuentas
              esGlobal={sesion.roles.some(r => r.rol === 'ADMINISTRADOR' && r.idOrganizacion === null)}
              organizaciones={organizaciones}
              cuentas={cuentas}
              idActual={sesion.idUsuario}
              alGuardar={() => setVersion(v => v + 1)}
            />
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
                          · <small style={{ color: 'var(--secundario)' }}>{new Date(a.creado_en).toLocaleString('es-VE')}</small>
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
                        <strong>Versión {a.version}</strong> · {a.estado} · {new Date(a.creado_en).toLocaleString('es-VE')}
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
