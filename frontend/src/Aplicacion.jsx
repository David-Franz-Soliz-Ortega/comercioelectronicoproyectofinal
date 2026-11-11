import PaginaUsuarios from './paginas/PaginaUsuarios.jsx';
import React, { useEffect, useState } from 'react';
import { puedeVerSeccion, tienePermiso } from './navegacion/planPermisos.js';
import Sesion, { ControlesSesion } from './componentes/Sesion.jsx';
import { consultarGraphql } from './api/clienteGraphql.js';
import { resolverSeccion, secciones, seccionesRegistros } from './navegacion/secciones.js';
import Navegacion from './componentes/Navegacion.jsx';
import ResumenRegistros from './componentes/ResumenRegistros.jsx';
import FormularioEleccion from './componentes/FormularioEleccion.jsx';
import Icono from './componentes/Icono.jsx';
import PaginaInicio from './paginas/PaginaInicio.jsx';
import PaginaRegistros from './paginas/PaginaRegistros.jsx';
import PaginaPendiente from './paginas/PaginaPendiente.jsx';

export default function Aplicacion() {
  return <Sesion>{estado => <AplicacionAutenticada key={`${estado.sesion.idUsuario}-${estado.sesion.idOrganizacion ?? ''}`} {...estado} />}</Sesion>;
}
function AplicacionAutenticada({ sesion, ocupado, error, salir, seleccionar }) {
  const [solicitada, cambiarSeccion] = useState(() => resolverSeccion(location.hash));
  const [version, cambiarVersion] = useState(0);
  const [reinicioListado, cambiarReinicioListado] = useState(0);
  const [resumen, cambiarResumen] = useState(null);
  const [cargandoResumen, cambiarCargandoResumen] = useState(false);
  const [instanteResumen, cambiarInstanteResumen] = useState(null);
  const [errorResumen, cambiarErrorResumen] = useState('');
  const [mensaje, cambiarMensaje] = useState('');
  const [formularioAbierto, cambiarFormularioAbierto] = useState(false);
  const permitida = puedeVerSeccion(sesion, solicitada);
  const seccion = permitida ? solicitada : 'inicio';
  const visibles = Object.keys(seccionesRegistros).filter(clave => puedeVerSeccion(sesion, clave));
  const consultaResumen = `query ResumenSigape { ${visibles.map(clave => `${seccionesRegistros[clave].recurso}(limite:1) { total }`).join(' ')} }`;
  const esListado = Object.hasOwn(seccionesRegistros, seccion);
  const configuracion = secciones[seccion];
  const actualizar = () => cambiarVersion(valor => valor + 1);
  useEffect(() => {
    const escuchar = () => {
      // El enlace de accesibilidad apunta al contenido, no a otra página.
      if (location.hash !== '#contenido') cambiarSeccion(resolverSeccion(location.hash));
    };
    window.addEventListener('hashchange', escuchar);
    return () => window.removeEventListener('hashchange', escuchar);
  }, []);
  useEffect(() => {
    if (!visibles.length || (!esListado && seccion !== 'inicio')) return;
    const controlador = new AbortController(); let vigente = true;
    cambiarErrorResumen(''); cambiarResumen(null); cambiarInstanteResumen(null); cambiarCargandoResumen(true);
    consultarGraphql(consultaResumen, {}, controlador.signal)
      .then(({ datos }) => { if (vigente) { cambiarResumen(datos); cambiarInstanteResumen(new Date()); } })
      .catch(fallo => { if (vigente) { cambiarResumen(null); cambiarErrorResumen(fallo.message); } })
      .finally(() => { if (vigente) cambiarCargandoResumen(false); });
    return () => { vigente = false; controlador.abort(); };
  }, [version, esListado, seccion, consultaResumen]);
  function navegar(destino) {
    if (!Object.hasOwn(secciones, destino) || !puedeVerSeccion(sesion, destino)) return;
    cambiarSeccion(destino);
    location.hash = destino;
  }
  function alGuardar(creada) {
    cambiarFormularioAbierto(false);
    cambiarMensaje(`Elección «${creada.nombre}» guardada correctamente.`);
    cambiarReinicioListado(valor => valor + 1);
    navegar('elecciones'); actualizar();
  }
  return <div className="aplicacion">
    <a className="saltar" href="#contenido">Ir al contenido</a>
    <Navegacion seccion={seccion} navegar={navegar} sesion={sesion} />
    <div className="zona-principal">
      <header className="cabecera"><span>Espacio de gestión <span className="miga">/</span> <strong>{configuracion.titulo}</strong></span><ControlesSesion {...{ sesion, ocupado, salir, seleccionar }} /></header>
      <main id="contenido" tabIndex="-1">
        {error && <p className="aviso" role="alert">{error}</p>}
        {!permitida && <p className="aviso" role="alert">No tienes permiso para acceder a esta sección.</p>}
        <div className="presentacion"><div><p className="sobretitulo">SISTEMA DE PROCESOS ELECTORALES</p><h1>{seccion === 'inicio' ? 'Cada proceso, en un solo lugar.' : configuracion.titulo}</h1><p className="descripcion">{esListado ? configuracion.descripcion : seccion === 'inicio' ? 'Organiza y consulta la información de tus procesos electorales.' : 'Servicios académicos de SIGAPE y alcance disponible en esta interfaz.'}</p></div>{tienePermiso(sesion, 'elecciones:crear') && (esListado || seccion === 'inicio') && <button className="boton primario nueva-eleccion" onClick={() => cambiarFormularioAbierto(true)}><Icono nombre="mas" />Nueva elección</button>}</div>
        {visibles.length > 0 && (esListado || seccion === 'inicio') && <ResumenRegistros cargando={cargandoResumen} instante={instanteResumen} visibles={visibles} resumen={resumen} seccion={seccion} navegar={navegar} error={errorResumen} />}
        {mensaje && <div className="confirmacion" role="status"><Icono nombre="marca" />{mensaje}<button onClick={() => cambiarMensaje('')} aria-label="Cerrar confirmación">×</button></div>}
        {esListado ? <PaginaRegistros key={`${seccion}-${reinicioListado}`} seccion={seccion} version={version} actualizar={actualizar} sesion={sesion} /> : seccion === 'inicio' ? <PaginaInicio {...{ actualizar, version, sesion, navegar }} /> : seccion === 'usuarios' ? <PaginaUsuarios /> : <PaginaPendiente seccion={seccion} />}
        <footer className="pie-aplicacion"><span>SIGAPE <span>·</span> Sistema de Gestión y Administración de Procesos Electorales</span><span>COM-600</span></footer>
      </main>
    </div>
    {formularioAbierto && tienePermiso(sesion, 'elecciones:crear') && <FormularioEleccion alGuardar={alGuardar} alCerrar={() => cambiarFormularioAbierto(false)} />}
  </div>;
}
