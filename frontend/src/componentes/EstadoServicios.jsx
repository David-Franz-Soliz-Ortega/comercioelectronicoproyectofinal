import React, { useEffect, useState } from 'react';
import { servicios, consultarEstadoServicio } from '../api/estadoServicios.js';
export default function EstadoServicios({ version }) {
  const [estados, cambiarEstados] = useState({}); const [instante, cambiarInstante] = useState(null);
  useEffect(() => {
    const controlador = new AbortController(); let vigente = true;
    cambiarEstados({}); cambiarInstante(null);
    Promise.all(servicios.map(async servicio => [servicio, await consultarEstadoServicio(servicio, controlador.signal)]))
      .then(resultados => { if (vigente) { cambiarEstados(Object.fromEntries(resultados)); cambiarInstante(new Date()); } });
    return () => { vigente = false; controlador.abort(); };
  }, [version]);
  return <section className="panel panel-servicios" aria-labelledby="titulo-servicios"><div className="titulo-panel"><div><h2 id="titulo-servicios">Disponibilidad de servicios</h2><p>Respuesta de las rutas de salud publicadas por NGINX. No representa una certificación electoral.</p></div></div>
    <ul className="servicios">{servicios.map(servicio => <li key={servicio}><span>{servicio === 'padron-electoral' ? 'Padrón electoral' : servicio[0].toUpperCase() + servicio.slice(1)}</span><strong className={`salud ${estados[servicio] === 'Disponible' ? 'salud-disponible' : ''}`}>{estados[servicio] ?? 'Consultando…'}</strong></li>)}</ul>
    <p className="nota-alcance" role="status">{instante ? `Consulta realizada a las ${instante.toLocaleTimeString('es-VE')}. Usa Actualizar para consultar de nuevo.` : 'Consultando las APIs de salud…'}</p>
  </section>;
}
