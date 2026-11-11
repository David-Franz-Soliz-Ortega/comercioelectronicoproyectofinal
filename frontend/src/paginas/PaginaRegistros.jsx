import EditorRegistro from '../componentes/EditorRegistro.jsx';
import { tienePermiso } from '../navegacion/planPermisos.js';
import { recursosP1 } from '../api/recursosP1.js';
import React, { useEffect, useState } from 'react';
import { consultas } from '../api/operaciones.js';
import { consultarGraphql } from '../api/clienteGraphql.js';
import { seccionesRegistros as secciones } from '../navegacion/secciones.js';
import Icono from '../componentes/Icono.jsx';
import { etiquetas, numero } from '../componentes/formato.js';
import TablaRegistros from '../componentes/TablaRegistros.jsx';

export default function PaginaRegistros({ seccion, version, actualizar, sesion }) {
  const [editor, cambiarEditor] = useState(null);
  const [confirmacion, cambiarConfirmacion] = useState('');
  const recurso = recursosP1[seccion];
  const puedeCrear = tienePermiso(sesion, recurso.dominio + ':crear');
  const puedeModificar = tienePermiso(sesion, recurso.dominio + ':modificar');
  const [pagina, cambiarPagina] = useState(1);
  const [estado, cambiarEstado] = useState('');
  const [busqueda, cambiarBusqueda] = useState('');
  const [nombreFiltro, cambiarNombreFiltro] = useState('');
  const [lista, cambiarLista] = useState(null);
  const [cargando, cambiarCargando] = useState(true);
  const [error, cambiarError] = useState('');
  const [advertencia, cambiarAdvertencia] = useState('');
  const configuracion = secciones[seccion];
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
  const totalPaginas = lista ? Math.max(1, Math.ceil(lista.total / lista.limite)) : null;
  const columnas = seccion === 'elecciones' ? ['Elección', 'Estado', 'Creación'] : seccion === 'candidaturas' ? ['Candidatura', 'Elección asociada', 'Tipo', 'Estado'] : ['Inscripción', 'Elección asociada', 'Elegibilidad', 'Creación'];

  return (
        <section className="panel" aria-labelledby="titulo-listado" aria-busy={cargando}>
          <div className="titulo-panel"><div><h2 id="titulo-listado">{configuracion.titulo}<span className="contador">{numero(lista?.total)}</span></h2><p>{configuracion.descripcion}</p></div>{seccion !== 'elecciones' && puedeCrear && <button className="boton primario" onClick={() => cambiarEditor({})}>Registrar {recurso.singular}</button>}<button className="boton secundario" disabled={cargando} onClick={() => actualizar()}><Icono nombre="actualizar" />Actualizar</button></div>
          <form className="filtros" aria-label="Filtros del listado" onSubmit={evento => { evento.preventDefault(); cambiarPagina(1); cambiarNombreFiltro(busqueda.trim()); }}>
            {seccion === 'elecciones' ? <div className="buscar"><Icono nombre="buscar" /><label className="solo-lectores" htmlFor="buscar-nombre">Buscar elección por nombre</label><input id="buscar-nombre" placeholder="Buscar elección por nombre…" maxLength="120" value={busqueda} onChange={evento => cambiarBusqueda(evento.target.value)} /><button type="submit">Buscar</button></div> : <span className="detalle-filtro">{seccion === 'padron' ? 'Inscripciones sin datos personales' : 'Postulaciones registradas'}</span>}
            <div className="campo-filtro"><label htmlFor="filtro-estado">{seccion === 'padron' ? 'Elegibilidad' : 'Estado'}</label><select id="filtro-estado" value={estado} onChange={evento => { cambiarEstado(evento.target.value); cambiarPagina(1); }}><option value="">{seccion === 'padron' ? 'Todas' : 'Todos los estados'}</option>{seccion === 'padron' ? <><option value="true">Elegible</option><option value="false">No elegible</option></> : configuracion.estados.map(valor => <option key={valor} value={valor}>{etiquetas[valor]}</option>)}</select></div>
          </form>
          {confirmacion && <p className="confirmacion" role="status">{confirmacion}</p>}
          {(estado || nombreFiltro || busqueda) && <div className="filtros-activos"><span>Filtros aplicados al servidor</span><button className="boton secundario" onClick={() => { cambiarEstado(''); cambiarBusqueda(''); cambiarNombreFiltro(''); cambiarPagina(1); }}>Limpiar filtros</button></div>}
          {advertencia && <p className="aviso" role="alert">{advertencia}</p>}
          {error ? <div className="estado-listado error" role="alert"><strong>No pudimos cargar el listado</strong><p>{error}</p><button className="boton secundario" onClick={() => actualizar()}>Volver a intentar</button></div> : cargando ? <div className="estado-listado" role="status"><span className="cargando" />Consultando registros…</div> : lista?.elementos.length === 0 ? <div className="estado-listado"><Icono nombre={configuracion.icono} width="34" height="34" /><strong>{estado || nombreFiltro ? 'No hay coincidencias con estos filtros' : 'Todavía no hay registros accesibles'}</strong><p>{estado || nombreFiltro ? 'Limpia los filtros para ampliar la consulta.' : 'La API no devolvió registros para tu organización y permisos.'}</p></div> : <TablaRegistros titulo={configuracion.titulo} seccion={seccion} lista={lista} columnas={puedeModificar ? [...columnas, 'Acciones'] : columnas} acciones={puedeModificar ? fila => <div className="acciones-registro"><button className="boton secundario" onClick={() => cambiarEditor({ fila })}>Editar</button><button className="boton peligro" onClick={() => cambiarEditor({ fila, eliminar: true })}>Eliminar</button></div> : null} />}
          <div className="pie-panel"><p aria-live="polite">{lista && lista.total > 0 ? `${numero((lista.pagina - 1) * lista.limite + 1)}–${numero(Math.min(lista.pagina * lista.limite, lista.total))} de ${numero(lista.total)} registros` : 'Consulta de registros'}</p><div className="paginacion"><button className="boton pagina" aria-label="Página anterior" disabled={cargando || !lista || pagina <= 1} onClick={() => cambiarPagina(valor => valor - 1)}><Icono nombre="flecha" className="flecha-anterior" /></button><span>Página {pagina}{totalPaginas ? ` de ${numero(totalPaginas)}` : ''}</span><button className="boton pagina" aria-label="Página siguiente" disabled={cargando || !lista || pagina >= totalPaginas} onClick={() => cambiarPagina(valor => valor + 1)}><Icono nombre="flecha" /></button></div></div>
          {editor && <EditorRegistro recurso={seccion} {...editor} alCerrar={() => cambiarEditor(null)} alGuardar={() => { cambiarEditor(null); cambiarConfirmacion('Operación confirmada por la API.'); cambiarPagina(1); actualizar(); }} />}
        </section>
  );
}
