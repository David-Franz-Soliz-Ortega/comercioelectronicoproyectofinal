import {asignarMesasOperador} from '../api/operadores.js';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { nombresEstadoInstitucion } from '../api/catalogos.js';
import { resumirInstitucion } from '../api/estadoInstitucion.js';
import { solicitarRest } from '../api/clienteRest.js';
import { notificarExito } from '../api/confirmaciones.js';
import {
  IconoMaletin,
  IconoUsuarios,
  IconoMesaFisica,
  IconoDocumento,
  IconoUsuario,
  IconoAlerta,
  IconoLupa
} from './Iconos.jsx';

export default function ConteoInstitucion({
  organizacion,
  nombre,
  procesos,
  ocupado,
  alGuardar,
  alOcupado,
  revision,
  alIr,
  cuentas = []
}) {
  const pendientesRef=useRef(null);
  const [responsables,setResponsables]=useState({});
  const [accion, setAccion] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [asignaciones, setAsignaciones] = useState(null);
  const [errorAsignaciones, setErrorAsignaciones] = useState('');
  const [intento, setIntento] = useState(0);

  // Filtros y paginación
  const [pestanaFiltro, setPestanaFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [filtroAmbito, setFiltroAmbito] = useState('todos');
  const [pagina, setPagina] = useState(1);
  const [filasPorPagina, setFilasPorPagina] = useState(7);

  useEffect(() => {
    let vigente = true;
    setAsignaciones(null);
    setErrorAsignaciones('');
    solicitarRest('/configuracion/asignaciones', { organizacion })
      .then(r => {
        if (vigente) setAsignaciones(r.elementos);
      })
      .catch(e => {
        if (vigente) setErrorAsignaciones(e.message);
      });
    return () => {
      vigente = false;
    };
  }, [organizacion, revision, intento]);

  const resumen = resumirInstitucion(procesos, asignaciones);
  const borradores = procesos.filter(p => p.estado === 'borrador');
  const abiertos = procesos.filter(p => p.estado === 'recepcion');
  const finalizados = procesos.filter(p => p.estado === 'cerrada');
  const bloqueado = ocupado || guardando;
  const operadoresDisponibles=cuentas.filter(c=>c.activo&&c.roles?.some(r=>r.rol==='OPERADOR'&&r.idOrganizacion===organizacion)&&!c.roles.some(r=>r.rol==='ADMINISTRADOR'&&(r.idOrganizacion===null||r.idOrganizacion===organizacion)));
  async function asignarPendiente(mesa){
    const idUsuario=responsables[mesa.id];
    if(bloqueado||!mesa.puedeAsignar||!operadoresDisponibles.some(c=>c.idUsuario===idUsuario))return;
    setGuardando(true);alOcupado?.(true);setError('');
    try{
      await asignarMesasOperador({pedir:solicitarRest,organizacion,idUsuario,mesas:[mesa.id],completadas:new Set()});
      setIntento(v=>v+1);alGuardar();notificarExito('Operador asignado a '+mesa.codigo+' · '+mesa.cargo+'.');
    }catch(e){setError(e.message);}finally{setGuardando(false);alOcupado?.(false);}
  }

  // Lista de ámbitos / facultades únicos para el dropdown
  const opcionesAmbito = useMemo(() => {
    const set = new Set();
    for (const p of resumen.cargos) {
      if (p.ambito) set.add(p.ambito);
      else if (p.facultad) set.add(p.facultad);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [resumen.cargos]);

  // Filtrado de cargos
  const cargosFiltrados = useMemo(() => {
    return resumen.cargos.filter(p => {
      // Filtro por pestaña
      if (pestanaFiltro === 'borrador' && p.estado !== 'borrador') return false;
      if (pestanaFiltro === 'recepcion' && p.estado !== 'recepcion') return false;
      if (pestanaFiltro === 'finalizados' && p.estado !== 'cerrada' && p.estado !== 'finalizado') return false;

      // Filtro por ámbito / cargo dropdown
      if (filtroAmbito !== 'todos') {
        const coincideAmbito = p.ambito === filtroAmbito || p.facultad === filtroAmbito || p.cargo === filtroAmbito;
        if (!coincideAmbito) return false;
      }

      // Filtro por texto de búsqueda
      if (busqueda.trim()) {
        const termino = busqueda.toLowerCase().trim();
        const texto = `${p.cargo} ${p.ambito || ''} ${p.facultad || ''} ${p.nombre || ''}`.toLowerCase();
        if (!texto.includes(termino)) return false;
      }

      return true;
    });
  }, [resumen.cargos, pestanaFiltro, filtroAmbito, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(cargosFiltrados.length / filasPorPagina));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const cargosPaginados = useMemo(() => {
    const inicio = (paginaSegura - 1) * filasPorPagina;
    return cargosFiltrados.slice(inicio, inicio + filasPorPagina);
  }, [cargosFiltrados, paginaSegura, filasPorPagina]);

  async function guardar() {
    if (bloqueado || !confirmado) return;
    setGuardando(true);
    alOcupado?.(true);
    setError('');
    try {
      const r = await solicitarRest('/configuracion/institucion/' + accion, {
        metodo: 'POST',
        organizacion,
        datos: { confirmar: true },
        mostrarDetalleValidacion: true
      });
      setAccion('');
      setConfirmado(false);
      alGuardar();
      notificarExito(
        r.actualizados +
          ' cargos ' +
          (accion === 'iniciar'
            ? 'habilitados para recibir actas.'
            : accion === 'preparar' ? 'preparados para un nuevo conteo sin actas anteriores.' : 'cerrados; resultados conservados.')
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
      alOcupado?.(false);
    }
  }

  return (
    <section className="panel-admin conteo-institucion seccion-estado-publicacion">
      {/* Cabecera de la sección */}
      <header className="cabecera-estado-publicacion">
        <div className="textos-cabecera-publicacion">
          <div className="fila-titulo-publicacion">
            <h1 className="titulo-estado-publicacion">Estado y publicación</h1>
            <span className="insignia-estado-global">{resumen.estado}</span>
          </div>
          <p className="subtitulo-estado-publicacion">{nombre}</p>
        </div>

        <div className="selector-alcance-publicacion">
          <select
            className="selector-filtro-alcance"
            aria-label="Filtrar por alcance institucional"
            value={filtroAmbito}
            onChange={e => {
              setFiltroAmbito(e.target.value);
              setPagina(1);
            }}
          >
            <option value="todos">Toda la organización</option>
            {opcionesAmbito.map(amb => (
              <option key={amb} value={amb}>
                {amb}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* 5 Tarjetas KPI */}
      <div className="grilla-metricas-publicacion">
        <article className="tarjeta-metrica-publicacion">
          <div className="cabecera-tarjeta-metrica">
            <span>Cargos</span>
            <div className="icono-circulo-metrica">
              <IconoMaletin tamano={20} />
            </div>
          </div>
          <strong className="cifra-metrica-publicacion">{resumen.cargos.length}</strong>
        </article>

        <article className="tarjeta-metrica-publicacion">
          <div className="cabecera-tarjeta-metrica">
            <span>Candidaturas</span>
            <div className="icono-circulo-metrica">
              <IconoUsuarios tamano={20} />
            </div>
          </div>
          <strong className="cifra-metrica-publicacion">{resumen.candidaturas}</strong>
        </article>

        <article className="tarjeta-metrica-publicacion">
          <div className="cabecera-tarjeta-metrica">
            <span>Mesas físicas</span>
            <div className="icono-circulo-metrica">
              <IconoMesaFisica tamano={20} />
            </div>
          </div>
          <strong className="cifra-metrica-publicacion">{resumen.mesasFisicas}</strong>
        </article>

        <article className="tarjeta-metrica-publicacion">
          <div className="cabecera-tarjeta-metrica">
            <span>Actas esperadas</span>
            <div className="icono-circulo-metrica">
              <IconoDocumento tamano={20} />
            </div>
          </div>
          <strong className="cifra-metrica-publicacion">{resumen.actasEsperadas}</strong>
        </article>

        <article className="tarjeta-metrica-publicacion">
          <div className="cabecera-tarjeta-metrica">
            <span>Operadores asignados</span>
            <div className="icono-circulo-metrica">
              <IconoUsuario tamano={20} />
            </div>
          </div>
          <strong className="cifra-metrica-publicacion">{resumen.operadores ?? '—'}</strong>
        </article>
      </div>

      {/* Banner de alerta de actas sin operador */}
      {errorAsignaciones ? (
        <p role="alert" className="aviso">
          {errorAsignaciones}{' '}
          <button type="button" className="boton secundario" onClick={() => setIntento(v => v + 1)}>
            Reintentar asignaciones
          </button>
        </p>
      ) : asignaciones === null ? (
        <p role="status">Consultando asignaciones de la organización…</p>
      ) : resumen.mesasSinOperador > 0 ? (
        <><div className="banner-alerta-publicacion">
          <div className="contenido-alerta-banner">
            <IconoAlerta tamano={20} color="#D97706" />
            <span>{resumen.mesasSinOperador} actas por cargo sin operador asignado.</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              className="enlace-revisar-asignaciones"
              disabled={bloqueado}
              onClick={() => {pendientesRef.current?.scrollIntoView({behavior:'smooth',block:'center'});pendientesRef.current?.focus({preventScroll:true});}}
            >
              Ver mesas pendientes ↓
            </button>
            <span style={{ color: '#FCD34D' }}>|</span>
            <button
              type="button"
              className="enlace-revisar-asignaciones"
              disabled={bloqueado}
              onClick={() => alIr?.('asignaciones')}
            >
              Revisar asignaciones →
            </button>
          </div>
        </div>
        <section ref={pendientesRef} tabIndex={-1} className="pendientes-inicio-conteo" aria-label="Asignaciones pendientes para iniciar">
          <header>
            <div>
              <h3>Mesas y cargos sin operador asignado ({resumen.pendientes.length})</h3>
              <p>Cada acta debe tener un operador asignado para poder iniciar el conteo. Elige un operador para cada fila y pulsa Asignar.</p>
            </div>
            <button type="button" className="boton secundario" disabled={bloqueado} onClick={()=>alIr?.('asignaciones')}>
              Ir a Operadores →
            </button>
          </header>
          <div className="tabla-pendientes-inicio-scroll">
            <table className="tabla-admin">
              <thead>
                <tr>
                  <th>Mesa</th>
                  <th>Cargo y unidad</th>
                  <th>Sector</th>
                  <th>Operador activo</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>{resumen.pendientes.map(m=><tr key={m.id} data-pendiente-inicio={m.id}>
                <td><strong>{m.codigo}</strong></td>
                <td>
                  <strong>{m.cargo}</strong>
                  <span style={{ display: 'block', fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    {m.unidad}{m.ambito&&m.ambito!==m.unidad?' · '+m.ambito:''}
                  </span>
                </td>
                <td>{m.sector||'General'}</td>
                <td>
                  <select
                    aria-label={'Operador para '+m.codigo+' · '+m.cargo}
                    value={responsables[m.id]||''}
                    disabled={bloqueado||!m.puedeAsignar||!operadoresDisponibles.length}
                    onChange={e=>setResponsables(prev=>({...prev,[m.id]:e.target.value}))}
                  >
                    <option value="">Seleccionar operador…</option>
                    {operadoresDisponibles.map(c=><option key={c.idUsuario} value={c.idUsuario}>{c.usuario}</option>)}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className="boton primario"
                    disabled={bloqueado||!m.puedeAsignar||!responsables[m.id]||!operadoresDisponibles.some(c=>c.idUsuario===responsables[m.id])}
                    onClick={()=>asignarPendiente(m)}
                  >
                    Asignar
                  </button>
                  {!m.puedeAsignar&&<small style={{ display: 'block', color: '#64748B', marginTop: 4 }}>Configuración bloqueada</small>}
                </td>
              </tr>)}</tbody>
            </table>
          </div>
          {!operadoresDisponibles.length&&<p style={{ marginTop: 12, color: '#B45309' }}>No hay operadores activos disponibles en esta institución. Créalos o asígnales el rol desde Operadores o Usuarios.</p>}
        </section></>
      ) : (
        <div className="banner-alerta-publicacion banner-correcto">
          <div className="contenido-alerta-banner">
            <IconoUsuario tamano={20} color="#166534" />
            <span>Todas las actas esperadas tienen operador asignado.</span>
          </div>
        </div>
      )}

      {/* Contenedor principal de la tabla con pestañas */}
      <div className="panel-tabla-cargos-publicacion">
        {/* Pestañas de estado */}
        <div className="pestanas-tabla-publicacion" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={pestanaFiltro === 'todos'}
            className={`boton-tab-publicacion ${pestanaFiltro === 'todos' ? 'activo' : ''}`}
            onClick={() => {
              setPestanaFiltro('todos');
              setPagina(1);
            }}
          >
            Todos {resumen.cargos.length}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pestanaFiltro === 'borrador'}
            className={`boton-tab-publicacion ${pestanaFiltro === 'borrador' ? 'activo' : ''}`}
            onClick={() => {
              setPestanaFiltro('borrador');
              setPagina(1);
            }}
          >
            En preparación {borradores.length}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pestanaFiltro === 'recepcion'}
            className={`boton-tab-publicacion ${pestanaFiltro === 'recepcion' ? 'activo' : ''}`}
            onClick={() => {
              setPestanaFiltro('recepcion');
              setPagina(1);
            }}
          >
            En recepción {abiertos.length}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pestanaFiltro === 'finalizados'}
            className={`boton-tab-publicacion ${pestanaFiltro === 'finalizados' ? 'activo' : ''}`}
            onClick={() => {
              setPestanaFiltro('finalizados');
              setPagina(1);
            }}
          >
            Finalizados {finalizados.length}
          </button>
        </div>

        {/* Barra de búsqueda y selector interno */}
        <div className="barra-herramientas-tabla-publicacion">
          <div className="caja-busqueda-publicacion">
            <IconoLupa tamano={17} color="#94A3B8" />
            <input
              type="search"
              className="entrada-busqueda-publicacion"
              placeholder="Buscar cargo o facultad…"
              value={busqueda}
              onChange={e => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
            />
          </div>

          <select
            className="selector-filtro-cargos-tabla"
            aria-label="Filtrar cargos por tipo o ámbito"
            value={filtroAmbito}
            onChange={e => {
              setFiltroAmbito(e.target.value);
              setPagina(1);
            }}
          >
            <option value="todos">Todos los cargos</option>
            {opcionesAmbito.map(amb => (
              <option key={amb} value={amb}>
                {amb}
              </option>
            ))}
          </select>
        </div>

        {/* Tabla de cargos */}
        <div className="tabla-preparacion-scroll">
          <table className="tabla-admin tabla-publicacion-cargos">
            <thead>
              <tr>
                <th>Cargo y ámbito</th>
                <th>Candidaturas</th>
                <th>Actas esperadas</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {cargosPaginados.map(p => {
                const esFinalizada = p.estado === 'cerrada' || p.estado === 'finalizado';
                const esRecepcion = p.estado === 'recepcion';
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="celda-cargo-ambito">
                        <strong>{p.cargo}</strong>
                        <span className="subtitulo-cargo-tabla">
                          {p.ambito || p.facultad || p.nombre || 'Toda la institución'}
                          {p.vuelta === 2 ? ' · Segunda vuelta' : ''}
                        </span>
                      </div>
                    </td>
                    <td>{p.candidatos?.length ?? 0}</td>
                    <td>{p.mesas?.length ?? 0}</td>
                    <td>
                      <span
                        className={`insignia-estado-cargo-tabla ${
                          esFinalizada ? 'finalizada' : esRecepcion ? 'recepcion' : 'preparacion'
                        }`}
                      >
                        {esFinalizada
                          ? 'Finalizada'
                          : esRecepcion
                          ? 'En recepción'
                          : nombresEstadoInstitucion[p.estado] ?? 'En preparación'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!cargosFiltrados.length && (
            <p className="vacio-tabla-publicacion">
              No hay cargos que coincidan con los filtros seleccionados.
            </p>
          )}
        </div>

        {/* Pie de tabla con paginación */}
        <div className="pie-tabla-paginacion-publicacion">
          <span className="conteo-filas-publicacion">
            {cargosFiltrados.length > 0
              ? `${Math.min(filasPorPagina, cargosFiltrados.length)} de ${cargosFiltrados.length} cargos`
              : '0 cargos'}
          </span>

          <div className="control-filas-por-pagina">
            <span>Filas por página:</span>
            <select
              aria-label="Filas por página"
              value={filasPorPagina}
              onChange={e => {
                setFilasPorPagina(Number(e.target.value));
                setPagina(1);
              }}
            >
              <option value={7}>7</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          <nav className="controles-paginacion-botones" aria-label="Paginación de cargos">
            <button
              type="button"
              className="boton-paginador"
              disabled={paginaSegura <= 1}
              onClick={() => setPagina(p => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            {Array.from({ length: totalPaginas }, (_, i) => i + 1)
              .filter(num => num === 1 || num === totalPaginas || Math.abs(num - paginaSegura) <= 1)
              .map((num, idx, arr) => (
                <React.Fragment key={num}>
                  {idx > 0 && arr[idx - 1] !== num - 1 && <span className="elipsis-paginacion">…</span>}
                  <button
                    type="button"
                    className={`boton-paginador-numero ${num === paginaSegura ? 'activo' : ''}`}
                    onClick={() => setPagina(num)}
                  >
                    {num}
                  </button>
                </React.Fragment>
              ))}
            <button
              type="button"
              className="boton-paginador"
              disabled={paginaSegura >= totalPaginas}
              onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
            >
              Siguiente
            </button>
          </nav>
        </div>
      </div>

      {/* Barra inferior: Control del conteo */}
      <div className="barra-control-conteo-publicacion">
        <div className="textos-control-conteo">
          <div className="fila-principal-control">
            <strong>Control del conteo</strong>
            <span className="separador-control">|</span>
            <span className="resumen-cargos-control">
              {borradores.length} cargos en preparación · {abiertos.length} en recepción
            </span>
          </div>
          <p className="nota-control-conteo">Iniciar habilita la recepción; terminar conserva los resultados. Para repetir desde cero, prepara un nuevo conteo sin borrar el anterior.</p>
        </div>

        <div className="acciones-control-conteo">
          <button
            type="button"
            className="boton primario boton-iniciar-conteo-publicacion"
            disabled={bloqueado || !borradores.length || finalizados.length>0 || asignaciones===null || !!errorAsignaciones || resumen.mesasSinOperador>0}
            title={resumen.mesasSinOperador>0?'Completa las asignaciones pendientes indicadas arriba':undefined}
            onClick={() => {
              setAccion('iniciar');
              setConfirmado(false);
              setError('');
            }}
          >
            Iniciar conteo<span className="sr-only"> de la institución</span>
          </button>
          {abiertos.length>0&&<button
            type="button"
            className="boton secundario boton-terminar-conteo-publicacion"
            disabled={bloqueado || !abiertos.length}
            onClick={() => {
              setAccion('terminar');
              setConfirmado(false);
              setError('');
            }}
          >
            Terminar conteo<span className="sr-only"> de la institución</span>
          </button>}
          {finalizados.length>0&&!abiertos.length&&<button type="button" className="boton secundario" disabled={bloqueado} onClick={()=>{setAccion('preparar');setConfirmado(false);setError('');}}>Preparar nuevo conteo de la institución</button>}
        </div>
      </div>

      {/* Confirmación modal o desplegable */}
      {accion && (
        <div className="confirmacion-estado">
          <p>
            {accion === 'iniciar'
              ? 'Se iniciarán todos los cargos preparados con sus nuevos contadores. La configuración quedará bloqueada. Si falta configurar alguno, no se iniciará ninguno.'
              : accion === 'preparar' ? 'Se archivará el conteo finalizado y se copiará su configuración, candidatos, mesas, operadores y destacados a un nuevo borrador. Las actas y resultados anteriores se conservan en el historial y no se sumarán al nuevo conteo.'
              : 'Se detendrá la recepción de actas de todos los cargos abiertos de esta institución. Se conservarán sus datos y resultados.'}
          </p>
          <label>
            <input
              type="checkbox"
              disabled={bloqueado}
              checked={confirmado}
              onChange={e => setConfirmado(e.target.checked)}
            />
            Confirmo la acción para toda la institución.
          </label>
          <div className="acciones-estado">
            <button
              type="button"
              className="boton primario"
              disabled={bloqueado || !confirmado}
              onClick={guardar}
            >
              {guardando ? 'Guardando…' : 'Confirmar'}
            </button>
            <button
              type="button"
              className="boton secundario"
              disabled={bloqueado}
              onClick={() => setAccion('')}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="aviso" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}