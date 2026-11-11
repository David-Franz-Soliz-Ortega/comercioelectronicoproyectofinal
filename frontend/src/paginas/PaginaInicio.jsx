import React from 'react';
import Icono from '../componentes/Icono.jsx';
import EstadoServicios from '../componentes/EstadoServicios.jsx';
import { puedeVerSeccion } from '../navegacion/planPermisos.js';
import { seccionesRegistros } from '../navegacion/secciones.js';
export default function PaginaInicio({ actualizar, version, sesion, navegar }) {
  const accesibles = Object.entries(seccionesRegistros).filter(([clave]) => puedeVerSeccion(sesion, clave));
  const superadmin = sesion.roles.some(asignacion => asignacion.rol === 'SUPERADMIN');
  return <>
    <section className="panel panel-inicio" aria-labelledby="titulo-inicio">
      <div className="titulo-panel"><div><h2 id="titulo-inicio">Panel de presentación P1</h2><p>Información consultada en las APIs, limitada por tu rol y organización.</p></div><button className="boton secundario" onClick={actualizar}><Icono nombre="actualizar" />Actualizar</button></div>
      <div className="alcance-sesion"><div><p className="sobretitulo">SESIÓN AUTENTICADA</p><h3>{sesion.usuario}</h3><p>Organización de trabajo: <strong>{sesion.idOrganizacion ?? 'Sin organización seleccionada'}</strong></p></div>
        <ul className="roles-sesion" aria-label="Roles devueltos por identidad">{sesion.roles.map((asignacion, indice) => <li key={indice}><strong>{asignacion.rol}</strong><small>{asignacion.idOrganizacion ? `Organización: ${asignacion.idOrganizacion}` : 'Alcance global'}</small></li>)}</ul>
      </div>
      {superadmin && <p className="aviso alcance-aviso">Tu rol SUPERADMIN permite administrar identidad. El backend no le concede permisos electorales automáticos: por eso no aparecen Elecciones, Candidaturas ni Padrón. Para demostrarlos necesitas una cuenta con los roles correspondientes y organización activa.</p>}
      {!superadmin && !sesion.idOrganizacion && <p className="aviso alcance-aviso">Selecciona una organización de tus asignaciones para consultar sus procesos. No se mostrarán cifras de otros alcances.</p>}
      <div className="accesos-p1">{accesibles.map(([clave, datos]) => <button className="acceso-p1" key={clave} onClick={() => navegar(clave)}><Icono nombre={datos.icono} /><span><strong>{datos.titulo}</strong><small>Listado real · filtros · paginación</small></span><Icono nombre="flecha" /></button>)}
        {puedeVerSeccion(sesion, 'usuarios') && <button className="acceso-p1" onClick={() => navegar('usuarios')}><Icono nombre="personas" /><span><strong>Usuarios e identidades P1</strong><small>Consulta de cuentas y CRUD de registros sintéticos</small></span><Icono nombre="flecha" /></button>}
      </div>
      <p className="nota-alcance">Demostración académica. Los totales corresponden exclusivamente a registros accesibles; no representan resultados electorales.</p>
    </section>
    <EstadoServicios version={version} />
  </>;
}
