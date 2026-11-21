import React from 'react';
import FotoCandidatoAdministracion from './FotoCandidatoAdministracion.jsx';
import { enlaceResultados } from '../api/enlacesResultados.js';
export default function VistaPreviaResultados({proceso,organizacion,ocupado,alCandidatos,alPublicacion}){
 if(!proceso)return null;
 const enlace=enlaceResultados(proceso),publicado=!!enlace,candidatos=proceso.candidatos;
 return <section className="panel-admin vista-previa-resultados" data-proceso-previa={proceso.id} aria-labelledby="titulo-vista-previa-resultados">
  <header><div><p className="etiqueta-panel">CANDIDATOS EN LA PORTADA</p><h3 id="titulo-vista-previa-resultados">{proceso.cargo} · {proceso.nombre}</h3><p>{publicado?'Este cargo está publicado y sus candidatos se pueden consultar en Resultados.':'Este cargo todavía no está visible en Resultados. Revisa su estado antes de abrir la recepción.'}</p></div><span className={publicado?'institucion-activa':'etiqueta-estado estado-borrador'}>{publicado?'Visible al público':'No publicado'}</span></header>
  {candidatos.length?<ul className="candidatos-vista-previa">{candidatos.slice(0,6).map(c=><li key={c.id}><FotoCandidatoAdministracion key={c.id} candidato={c} organizacion={organizacion} claseIniciales="iniciales-candidato-resumen"/><span><strong>{c.nombre}</strong><small>{c.tieneFoto||c.foto?'Fotografía cargada':'Sin fotografía'}</small></span></li>)}</ul>:<p className="sin-candidatos-previa">Todavía no hay candidatos registrados para este cargo.</p>}
  {candidatos.length>6&&<p>Mostrando 6 de {candidatos.length} candidatos. Puedes consultar todos en su apartado.</p>}
  <div className="acciones-previa-resultados">{publicado&&<a className="boton primario enlace-resultados-cargo" href={enlace} target="_blank" rel="noopener noreferrer">Ver resultados públicos ↗</a>}<button type="button" className="boton secundario" disabled={ocupado} onClick={alCandidatos}>Ir a Candidatos</button><button type="button" className="boton secundario" disabled={ocupado} onClick={alPublicacion}>Revisar publicación</button></div>
  <small>Esta tarjeta es una vista previa. Las fotografías se editan en Candidatos; la recepción se abre o cierra en Estado y publicación.</small>
 </section>;
}
