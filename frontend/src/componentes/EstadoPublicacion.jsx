import React from 'react';
import { IconoCheck, IconoUrna } from './Iconos.jsx';

export default function EstadoPublicacion({ preparacion, proceso, ocupado, alIr, alAgregarCargo }) {
  const pasos = preparacion.pasos.filter(p => ['organizacion', 'eleccion', 'candidatos', 'mesas', 'publicacion'].includes(p.id));
  const publicado = !!(proceso?.estado!=='archivada'&&(proceso?.publicado || proceso?.actual));
  const siguiente = pasos.find(p => !p.listo) ?? pasos.at(-1);
  const acciones = { organizacion: 'Elegir organización', eleccion: 'Crear evento y primer cargo', candidatos: 'Añadir candidatos', mesas: 'Registrar mesas', publicacion: 'Revisar y publicar cargo' };
  return <section className="estado-publicacion-admin" aria-labelledby="titulo-estado-publicacion">
    <div className="cabecera-estado-publicacion">
      <span className="icono-estado-publicacion" aria-hidden="true">{publicado ? <IconoCheck tamano={25} /> : <IconoUrna tamano={25} />}</span>
      <div><p className="etiqueta-estado-publicacion">PORTADA PÚBLICA · {publicado ? 'CARGO VISIBLE' : 'PREPARACIÓN'}</p>
        <h2 id="titulo-estado-publicacion">{publicado ? `${proceso.cargo} ya está en el portal` : 'Prepara lo que verá tu comunidad'}</h2>
        <p>{publicado ? 'Puedes consultar su portada o añadir otro cargo al mismo evento.' : 'Publica el evento y sus candidaturas para que aparezcan en la página de inicio. Los votos se incorporan al registrar actas.'}</p>
      </div>
    </div>
    <ol className="requisitos-portada">{pasos.map((paso, indice) => <li key={paso.id}>
      <button type="button" disabled={ocupado} onClick={() => alIr(paso)} aria-current={!publicado && paso.id === siguiente.id ? 'step' : undefined}>
        <span className={`marca-requisito ${paso.listo ? 'requisito-listo' : ''}`} aria-hidden="true">{paso.listo ? <IconoCheck tamano={15} /> : indice + 1}</span>
        <span><strong>{paso.id === 'eleccion' ? 'Evento y cargo' : paso.titulo}</strong><small>{paso.listo ? paso.id === 'publicacion' ? 'Publicado' : 'Registrado' : 'Pendiente'}</small></span>
      </button>
    </li>)}</ol>
    <div className="acciones-estado-publicacion">{publicado ? <>
      <a href="#resultados" className="boton-ver-portada">Ver portada pública ↗</a>
      <button type="button" disabled={ocupado} onClick={alAgregarCargo}>Añadir otro cargo a este evento</button>
    </> : <button type="button" className="boton-ver-portada" disabled={ocupado} onClick={() => alIr(siguiente)}>{acciones[siguiente.id]} →</button>}</div>
    <p className="nota-estado-publicacion">Para recibir actas, asigna operadores y abre la recepción desde Estado y publicación. Publicar candidaturas no añade votos al conteo.</p>
  </section>;
}
