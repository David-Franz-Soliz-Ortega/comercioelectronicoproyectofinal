import React, { useEffect, useRef, useState } from 'react';
import Icono from './componentes/Icono.jsx';
import UrnaAnimada from './componentes/UrnaAnimada.jsx';
import { consultaResumen, consultas, consultarGraphql, crearEleccion } from './graphql.js';

const secciones = {
  elecciones: { titulo: 'Elecciones', descripcion: 'Consulta y organiza los procesos electorales.', icono: 'urna', recurso: 'elecciones', estados: ['borrador', 'programada', 'en_curso', 'finalizada', 'anulada'] },
  candidaturas: { titulo: 'Candidaturas', descripcion: 'Revisa las postulaciones y su elección asociada.', icono: 'personas', recurso: 'candidaturas', estados: ['borrador', 'pendiente', 'aprobada', 'rechazada', 'retirada'] },
  padron: { titulo: 'Padrón electoral', descripcion: 'Consulta las inscripciones y su elegibilidad.', icono: 'lista', recurso: 'inscripciones', estados: [] },
};
const etiquetas = { borrador: 'Borrador', programada: 'Programada', en_curso: 'En curso', finalizada: 'Finalizada', anulada: 'Anulada', pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada', retirada: 'Retirada' };
const numero = valor => valor == null ? '—' : new Intl.NumberFormat('es-BO').format(valor);
const fecha = valor => { const instante = new Date(valor); return Number.isFinite(instante.getTime()) ? new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' }).format(instante) : 'No disponible'; };
function Estado({ valor }) { return <span className={`estado estado-${valor}`}><i />{etiquetas[valor] ?? valor}</span>; }
function Identificador({ valor }) { return <span className="identificador" title={valor}>{valor}</span>; }

export default function Gestion({ seccion, navegar, mensaje, cambiarMensaje }) {
  const [pagina, cambiarPagina] = useState(1);
  const [estado, cambiarEstado] = useState('');
  const [busqueda, cambiarBusqueda] = useState('');
  const [nombreFiltro, cambiarNombreFiltro] = useState('');
  const [version, cambiarVersion] = useState(0);
  const [resumen, cambiarResumen] = useState(null);
  const [errorResumen, cambiarErrorResumen] = useState('');
  const [lista, cambiarLista] = useState(null);
  const [cargando, cambiarCargando] = useState(true);
  const [error, cambiarError] = useState('');
  const [advertencia, cambiarAdvertencia] = useState('');
  const [nombreNuevo, cambiarNombreNuevo] = useState('');
  const [estadoNuevo, cambiarEstadoNuevo] = useState('borrador');
  const [errorFormulario, cambiarErrorFormulario] = useState('');
  const [guardando, cambiarGuardando] = useState(false);
  const dialogo = useRef(null);
  const bloqueoGuardado = useRef(false);
  const configuracion = secciones[seccion];

  useEffect(() => {
    const controlador = new AbortController(); let vigente = true;
    cambiarErrorResumen(''); cambiarResumen(null);
    consultarGraphql(consultaResumen, {}, controlador.signal).then(({ datos }) => { if (vigente) cambiarResumen(datos); })
      .catch(fallo => { if (vigente) cambiarErrorResumen(fallo.message); });
    return () => { vigente = false; controlador.abort(); };
  }, [version]);
  useEffect(() => {
    const controlador = new AbortController(); let vigente = true;
    cambiarCargando(true); cambiarError(''); cambiarAdvertencia(''); cambiarLista(null);
    const variables = { pagina, limite: 10 };
    if (seccion === 'elecciones' && nombreFiltro) variables.nombre = nombreFiltro;
    if (seccion === 'padron' && estado) variables.elegible = estado === 'true';
    else if (estado) variables.estado = estado;
    consultarGraphql(consultas[seccion], variables, controlador.signal)
      .then(({ datos, advertencia }) => { if (vigente) { cambiarLista(datos[secciones[seccion].recurso]); cambiarAdvertencia(advertencia); } })
      .catch(fallo => { if (vigente) cambiarError(fallo.message); })
      .finally(() => { if (vigente) cambiarCargando(false); });
    return () => { vigente = false; controlador.abort(); };
  }, [seccion, pagina, estado, nombreFiltro, version]);

  function abrirFormulario() {
    cambiarNombreNuevo(''); cambiarEstadoNuevo('borrador'); cambiarErrorFormulario('');
    dialogo.current.showModal();
  }
  async function guardar(evento) {
    evento.preventDefault();
    if (bloqueoGuardado.current) return;
    if (!nombreNuevo.trim()) { cambiarErrorFormulario('Escribe un nombre para la elección.'); return; }
    bloqueoGuardado.current = true; cambiarGuardando(true); cambiarErrorFormulario('');
    try {
      const { datos } = await consultarGraphql(crearEleccion, { entrada: { nombre: nombreNuevo.trim(), estado: estadoNuevo } });
      const creada = datos.crearEleccion;
      if (!creada?.idEleccion) throw new Error('No se pudo confirmar el registro.');
      cambiarMensaje(`Elección «${creada.nombre}» guardada correctamente.`);
      dialogo.current.close();
      cambiarLista(null); cambiarCargando(true); navegar('elecciones'); cambiarPagina(1); cambiarEstado(''); cambiarBusqueda(''); cambiarNombreFiltro('');
      if (location.hash !== '#elecciones') location.hash = 'elecciones';
      cambiarVersion(valor => valor + 1);
    } catch {
      cambiarErrorFormulario('No se pudo confirmar el guardado. Actualiza el listado antes de volver a intentarlo; el registro podría haberse guardado.');
    } finally { bloqueoGuardado.current = false; cambiarGuardando(false); }
  }
  const totalPaginas = lista ? Math.max(1, Math.ceil(lista.total / lista.limite)) : null;
  const columnas = seccion === 'elecciones' ? ['Elección', 'Estado', 'Creación'] : seccion === 'candidaturas' ? ['Candidatura', 'Elección asociada', 'Tipo', 'Estado'] : ['Inscripción', 'Elección asociada', 'Elegibilidad', 'Creación'];

  return <div className="gestion aparicion">
        <div className="presentacion"><div><p className="sobretitulo">REGISTROS CONECTADOS · SIGAPE</p><h1>Tu espacio de gestión.</h1><p className="descripcion">Consulta y organiza los registros académicos de tus procesos electorales.</p></div><button className="boton primario nueva-eleccion" onClick={abrirFormulario}><Icono nombre="mas" />Nueva elección</button></div>
        <section className="resumen" aria-label="Resumen de registros">{Object.entries(secciones).map(([clave, datos]) => <button className={`tarjeta-resumen ${seccion === clave ? 'seleccionada' : ''}`} key={clave} onClick={() => navegar(clave)} aria-label={`Ver ${datos.titulo.toLowerCase()}`}><span className="icono-resumen"><Icono nombre={datos.icono} /></span><span className="dato-resumen"><span>{datos.titulo}</span><strong data-testid={`total-${clave}`}>{numero(resumen?.[datos.recurso]?.total)}</strong><small>Registros disponibles</small></span><Icono nombre="flecha" className="flecha-tarjeta" /></button>)}</section>
        {errorResumen && <p className="aviso" role="alert">No se pudieron actualizar los totales. Usa «Actualizar» para volver a consultar.</p>}
        {mensaje && <div className="confirmacion" role="status"><Icono nombre="marca" />{mensaje}<button onClick={() => cambiarMensaje('')} aria-label="Cerrar confirmación">×</button></div>}
        <section className="panel" aria-labelledby="titulo-listado" aria-busy={cargando}>
          <div className="titulo-panel"><div><h2 id="titulo-listado">{configuracion.titulo}<span className="contador">{numero(lista?.total)}</span></h2><p>{configuracion.descripcion}</p></div><button className="boton secundario" disabled={cargando} onClick={() => cambiarVersion(valor => valor + 1)}><Icono nombre="actualizar" />Actualizar</button></div>
          <form className="filtros" aria-label="Filtros del listado" onSubmit={evento => { evento.preventDefault(); cambiarPagina(1); cambiarNombreFiltro(busqueda.trim()); }}>
            {seccion === 'elecciones' ? <div className="buscar"><Icono nombre="buscar" /><label className="solo-lectores" htmlFor="buscar-nombre">Buscar elección por nombre</label><input id="buscar-nombre" placeholder="Buscar elección por nombre…" maxLength="120" value={busqueda} onChange={evento => cambiarBusqueda(evento.target.value)} /><button type="submit">Buscar</button></div> : <span className="detalle-filtro">{seccion === 'padron' ? 'Inscripciones sin datos personales' : 'Postulaciones registradas'}</span>}
            <div className="campo-filtro"><label htmlFor="filtro-estado">{seccion === 'padron' ? 'Elegibilidad' : 'Estado'}</label><select id="filtro-estado" value={estado} onChange={evento => { cambiarEstado(evento.target.value); cambiarPagina(1); }}><option value="">{seccion === 'padron' ? 'Todas' : 'Todos los estados'}</option>{seccion === 'padron' ? <><option value="true">Elegible</option><option value="false">No elegible</option></> : configuracion.estados.map(valor => <option key={valor} value={valor}>{etiquetas[valor]}</option>)}</select></div>
          </form>
          {advertencia && <p className="aviso" role="alert">{advertencia}</p>}
          {error ? <div className="estado-listado error" role="alert"><strong>No pudimos cargar el listado</strong><p>{error}</p><button className="boton secundario" onClick={() => cambiarVersion(valor => valor + 1)}>Volver a intentar</button></div> : cargando ? <div className="estado-listado" role="status"><UrnaAnimada compacta />Consultando registros…</div> : lista?.elementos.length === 0 ? <div className="estado-listado"><Icono nombre={configuracion.icono} width="34" height="34" /><strong>No hay registros para mostrar</strong><p>Prueba con otro filtro o vuelve a actualizar.</p></div> : <div className="contenedor-tabla"><table><caption className="solo-lectores">Listado de {configuracion.titulo.toLowerCase()}</caption><thead><tr>{columnas.map(columna => <th scope="col" key={columna}>{columna}</th>)}</tr></thead><tbody>{lista?.elementos.map(fila => <tr key={fila.idEleccion && seccion === 'elecciones' ? fila.idEleccion : fila.idCandidatura ?? fila.idInscripcion}>
            {seccion === 'elecciones' ? <><td><strong className="nombre-registro">{fila.nombre}</strong><Identificador valor={fila.idEleccion} /></td><td><Estado valor={fila.estado} /></td><td className="fecha">{fecha(fila.creadoEn)}</td></> : seccion === 'candidaturas' ? <><td><strong className="nombre-registro">{fila.nombre}</strong><Identificador valor={fila.idCandidatura} /></td><td><span>{fila.eleccion?.nombre ?? 'Referencia no disponible'}</span><Identificador valor={fila.idEleccion} /></td><td>{fila.tipo === 'individual' ? 'Individual' : 'Lista'}</td><td><Estado valor={fila.estado} /></td></> : <><td><Identificador valor={fila.idInscripcion} /></td><td><span>{fila.eleccion?.nombre ?? 'Referencia no disponible'}</span><Identificador valor={fila.idEleccion} /></td><td><span className={`estado ${fila.elegible ? 'estado-aprobada' : 'estado-retirada'}`}><i />{fila.elegible ? 'Elegible' : 'No elegible'}</span></td><td className="fecha">{fecha(fila.creadoEn)}</td></>}
          </tr>)}</tbody></table></div>}
          <div className="pie-panel"><p aria-live="polite">{lista && lista.total > 0 ? `${numero((lista.pagina - 1) * lista.limite + 1)}–${numero(Math.min(lista.pagina * lista.limite, lista.total))} de ${numero(lista.total)} registros` : 'Consulta de registros'}</p><div className="paginacion"><button className="boton pagina" aria-label="Página anterior" disabled={cargando || !lista || pagina <= 1} onClick={() => cambiarPagina(valor => valor - 1)}><Icono nombre="flecha" className="flecha-anterior" /></button><span>Página {pagina}{totalPaginas ? ` de ${numero(totalPaginas)}` : ''}</span><button className="boton pagina" aria-label="Página siguiente" disabled={cargando || !lista || pagina >= totalPaginas} onClick={() => cambiarPagina(valor => valor + 1)}><Icono nombre="flecha" /></button></div></div>
        </section>
    <dialog ref={dialogo} aria-labelledby="titulo-formulario" onCancel={evento => { if (guardando) evento.preventDefault(); }}>
      <form onSubmit={guardar} className="formulario-creacion"><div className="cabecera-dialogo"><span className="icono-dialogo"><Icono nombre="urna" /></span><button type="button" className="cerrar" aria-label="Cerrar formulario" disabled={guardando} onClick={() => dialogo.current.close()}>×</button></div><p className="sobretitulo">PROCESOS ELECTORALES</p><h2 id="titulo-formulario">Nueva elección</h2><p className="descripcion">Define el nombre y el estado inicial del proceso.</p><label htmlFor="nombre-eleccion">Nombre de la elección</label><input id="nombre-eleccion" name="nombre" autoFocus required maxLength="120" value={nombreNuevo} disabled={guardando} onChange={evento => cambiarNombreNuevo(evento.target.value)} placeholder="Escribe el nombre del proceso" /><label htmlFor="estado-eleccion">Estado inicial</label><select id="estado-eleccion" value={estadoNuevo} disabled={guardando} onChange={evento => cambiarEstadoNuevo(evento.target.value)}>{secciones.elecciones.estados.map(valor => <option value={valor} key={valor}>{etiquetas[valor]}</option>)}</select>{errorFormulario && <p className="aviso error-formulario" role="alert">{errorFormulario}</p>}<div className="acciones-dialogo"><button type="button" className="boton secundario" disabled={guardando} onClick={() => dialogo.current.close()}>Cancelar</button><button type="submit" className="boton primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar elección'}</button></div></form>
    </dialog>
  </div>;
}
