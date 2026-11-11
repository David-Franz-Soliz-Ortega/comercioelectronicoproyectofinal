import { puedeVerSeccion } from '../navegacion/planPermisos.js';
import React from 'react';
import { secciones } from '../navegacion/secciones.js';
import Icono from './Icono.jsx';

export default function Navegacion({ seccion, navegar, sesion }) {
  return <aside className="barra-lateral">
    <a className="marca" href="#inicio" aria-label="SIGAPE, inicio"><span className="marca-simbolo"><Icono nombre="marca" width="27" height="27" /></span><span>SIGAPE<small>Gestión electoral</small></span></a>
    <div className="separador" />
    <p className="etiqueta-menu">ESPACIO DE GESTIÓN</p>
    <nav aria-label="Secciones principales">{Object.entries(secciones).filter(([clave]) => puedeVerSeccion(sesion, clave)).map(([clave, datos]) =>
      <button key={clave} className={`enlace-menu ${seccion === clave ? 'activo' : ''}`} aria-current={seccion === clave ? 'page' : undefined} onClick={() => navegar(clave)}>
        <Icono nombre={datos.icono} /><span>{datos.titulo}</span>{seccion === clave && <span className="indicador-menu" />}
      </button>)}</nav>
    <div className="nota-lateral"><span className="punto" /><div>Demostración académica<small>Proyecto COM-600</small></div></div>
  </aside>;
}
