import React from 'react';
import { seccionesRegistros } from '../navegacion/secciones.js';
import { numero } from './formato.js';
import Icono from './Icono.jsx';

export default function ResumenRegistros({ resumen, seccion, navegar, error, visibles, cargando, instante }) {
  return <>
    <section className="resumen" aria-label="Resumen de registros" aria-busy={cargando}>{Object.entries(seccionesRegistros).filter(([clave]) => visibles.includes(clave)).map(([clave, datos]) =>
      <button className={`tarjeta-resumen ${seccion === clave ? 'seleccionada' : ''}`} key={clave} onClick={() => navegar(clave)} aria-label={`Ver ${datos.titulo.toLowerCase()}`}>
        <span className="icono-resumen"><Icono nombre={datos.icono} /></span><span className="dato-resumen"><span>{datos.titulo}</span><strong data-testid={`total-${clave}`}>{numero(resumen?.[datos.recurso]?.total)}</strong><small>{cargando ? 'Consultando API…' : error ? 'Consulta no disponible' : resumen?.[datos.recurso] ? 'Registros accesibles' : 'Sin cifra disponible'}</small></span><Icono nombre="flecha" className="flecha-tarjeta" />
      </button>)}</section>
    {instante && <p className="actualizacion-resumen">Totales consultados a las {instante.toLocaleTimeString('es-VE')}. Alcance: organización y permisos de la sesión.</p>}
    {error && <p className="aviso" role="alert">{error}</p>}
  </>;
}
