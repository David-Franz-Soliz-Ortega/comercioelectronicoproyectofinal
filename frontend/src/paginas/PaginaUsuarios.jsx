import React, { useEffect, useState } from 'react';
import { solicitarRest } from '../api/clienteRest.js';
import EditorRegistro from '../componentes/EditorRegistro.jsx';
import { Estado, Identificador } from '../componentes/DatosRegistro.jsx';
import { fecha, numero } from '../componentes/formato.js';

export default function PaginaUsuarios() {
  const [cuentas, cambiarCuentas] = useState(null); const [organizaciones, cambiarOrganizaciones] = useState([]);
  const [organizacion, cambiarOrganizacion] = useState(''); const [lista, cambiarLista] = useState(null);
  const [errorCuentas, cambiarErrorCuentas] = useState(''); const [error, cambiarError] = useState('');
  const [pagina, cambiarPagina] = useState(1); const [estado, cambiarEstado] = useState('');
  const [version, cambiarVersion] = useState(0); const [cargando, cambiarCargando] = useState(false);
  const [editor, cambiarEditor] = useState(null); const [mensaje, cambiarMensaje] = useState('');
  useEffect(() => {
    let vigente = true; const controlador = new AbortController(); cambiarErrorCuentas('');
    Promise.all([solicitarRest('/usuarios', { senal: controlador.signal }), solicitarRest('/organizaciones', { senal: controlador.signal })])
      .then(([usuarios, organizaciones]) => { if (vigente) { cambiarCuentas(usuarios.elementos); cambiarOrganizaciones(organizaciones.elementos.filter(org => org.activa)); } })
      .catch(fallo => { if (vigente) cambiarErrorCuentas(fallo.message); });
    return () => { vigente = false; controlador.abort(); };
  }, [version]);
  useEffect(() => {
    cambiarLista(null); cambiarError(''); if (!organizacion) return;
    let vigente = true; const controlador = new AbortController(); cambiarCargando(true);
    solicitarRest(`/identidades?pagina=${pagina}&limite=10${estado ? '&estado=' + estado : ''}`, { organizacion, senal: controlador.signal })
      .then(datos => { if (vigente) cambiarLista(datos); }).catch(fallo => { if (vigente) cambiarError(fallo.message); })
      .finally(() => { if (vigente) cambiarCargando(false); });
    return () => { vigente = false; controlador.abort(); };
  }, [organizacion, pagina, estado, version]);
  return <>
    <section className="panel" aria-labelledby="titulo-cuentas"><div className="titulo-panel"><div><h2 id="titulo-cuentas">Cuentas de acceso</h2><p>Consulta de identidad autenticada. No equivale al CRUD de identidades académicas P1.</p></div><button className="boton secundario" onClick={() => cambiarVersion(v => v + 1)}>Actualizar</button></div>
      {errorCuentas ? <p className="aviso" role="alert">{errorCuentas}</p> : cuentas === null ? <p className="estado-listado" role="status">Consultando cuentas autorizadas…</p> : <div className="contenedor-tabla"><table><caption className="solo-lectores">Cuentas de acceso autorizadas (máximo 100 devueltas por la API)</caption><thead><tr><th scope="col">Usuario</th><th scope="col">Estado</th></tr></thead><tbody>{cuentas.map(cuenta => <tr key={cuenta.idUsuario}><td><strong>{cuenta.usuario}</strong><Identificador valor={cuenta.idUsuario} /></td><td>{cuenta.activo ? 'Activo' : 'Inactivo'}</td></tr>)}</tbody></table>{cuentas.length === 0 && <p className="estado-listado">La API no devolvió cuentas accesibles.</p>}<p className="nota-alcance">Hasta 100 cuentas según el límite de la API. La asignación de roles y la recuperación de acceso no se realizan desde esta pantalla.</p></div>}
    </section>
    <section className="panel" aria-labelledby="titulo-identidades" aria-busy={cargando}><div className="titulo-panel"><div><h2 id="titulo-identidades">Identidades académicas P1</h2><p>Registros sintéticos independientes de las cuentas de acceso. CRUD REST existente.</p></div>{organizacion && <button className="boton primario" onClick={() => cambiarEditor({})}>Registrar identidad</button>}</div>
      <div className="filtros"><label>Organización autorizada<select value={organizacion} onChange={e => { cambiarOrganizacion(e.target.value); cambiarPagina(1); cambiarMensaje(''); }}><option value="">Selecciona organización</option>{organizaciones.map(org => <option key={org.idOrganizacion} value={org.idOrganizacion}>{org.nombre}</option>)}</select></label><label>Estado<select value={estado} onChange={e => { cambiarEstado(e.target.value); cambiarPagina(1); }}><option value="">Todos</option><option value="activa">Activa</option><option value="suspendida">Suspendida</option></select></label></div>
      {mensaje && <p className="confirmacion" role="status">{mensaje}</p>}
      {!organizacion ? <div className="estado-listado"><strong>Se requiere una organización autorizada</strong><p>Solo se ofrecen organizaciones activas devueltas por identidad. Si no hay ninguna, este CRUD queda bloqueado; no se crearán datos para la presentación.</p></div> : error ? <p className="aviso" role="alert">{error}</p> : cargando ? <p className="estado-listado" role="status">Consultando identidades…</p> : lista && <><div className="contenedor-tabla"><table><caption className="solo-lectores">Identidades académicas de la organización seleccionada</caption><thead><tr><th scope="col">Identidad</th><th scope="col">Estado</th><th scope="col">Creación</th><th scope="col">Acciones</th></tr></thead><tbody>{lista.elementos.map(fila => <tr key={fila.idIdentidad}><td><strong>{fila.nombre}</strong><Identificador valor={fila.idIdentidad} /></td><td><Estado valor={fila.estado} /></td><td>{fecha(fila.creadoEn)}</td><td><div className="acciones-registro"><button className="boton secundario" onClick={() => cambiarEditor({ fila })}>Editar</button><button className="boton peligro" onClick={() => cambiarEditor({ fila, eliminar: true })}>Eliminar</button></div></td></tr>)}</tbody></table></div>{lista.total === 0 && <p className="estado-listado">No hay identidades accesibles con estos filtros.</p>}<div className="pie-panel"><span>{numero(lista.total)} registros</span><div className="paginacion"><button className="boton secundario" disabled={pagina <= 1} onClick={() => cambiarPagina(p => p - 1)}>Anterior</button><span>Página {pagina}</span><button className="boton secundario" disabled={pagina * lista.limite >= lista.total} onClick={() => cambiarPagina(p => p + 1)}>Siguiente</button></div></div></>}
      {editor && <EditorRegistro recurso="identidades" {...editor} organizacion={organizacion} alCerrar={() => cambiarEditor(null)} alGuardar={() => { cambiarEditor(null); cambiarMensaje('Operación confirmada por identidad.'); cambiarPagina(1); cambiarVersion(v => v + 1); }} />}
    </section>
  </>;
}
