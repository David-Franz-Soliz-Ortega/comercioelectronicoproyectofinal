import React from 'react';
import FotoCandidatoAdministracion from './FotoCandidatoAdministracion.jsx';
import { enlaceResultados } from '../api/enlacesResultados.js';
export default function VistaPreviaResultados({proceso,organizacion,ocupado,alCandidatos,alPublicacion,alQuitar}){
 if(!proceso)return null;
 const enlace=enlaceResultados(proceso),publicado=!!enlace,candidatos=proceso.candidatos;
 return <article className="vista-previa-resultados grupo-vista-previa" data-proceso-previa={proceso.id} aria-labelledby={"titulo-vista-previa-"+proceso.id}>
  <header><div><h3 id={"titulo-vista-previa-"+proceso.id}>{proceso.cargo}</h3><p>{proceso.ambito || proceso.facultad || proceso.nombre}{proceso.vuelta===2?' · Segunda vuelta':''}</p></div><span className={publicado?'institucion-activa':'etiqueta-estado estado-borrador'}>{publicado?'Visible al público':'No publicado'}</span></header>
  {candidatos.length?<ul className="candidatos-vista-previa">{candidatos.slice(0,6).map(c=><li key={c.id}><FotoCandidatoAdministracion key={c.id} candidato={c} organizacion={organizacion} claseIniciales="iniciales-candidato-resumen"/><span><strong>{c.nombre}</strong><small>{c.tieneFoto||c.foto?'Fotografía cargada':'Sin fotografía'}</small></span></li>)}</ul>:<p className="sin-candidatos-previa">Todavía no hay candidatos registrados para este cargo.</p>}
  {candidatos.length>6&&<p>Mostrando 6 de {candidatos.length} candidatos. Puedes consultar todos en su apartado.</p>}
  <div className="acciones-previa-resultados">{publicado&&<a className="boton primario enlace-resultados-cargo" href={enlace} target="_blank" rel="noopener noreferrer">Ver resultados públicos ↗</a>}<button type="button" className="boton secundario" disabled={ocupado} onClick={alCandidatos}>Ir a Candidatos</button><button type="button" className="boton secundario" disabled={ocupado} onClick={alPublicacion}>Revisar publicación</button><button type="button" className="boton secundario quitar-destacado" disabled={ocupado} onClick={alQuitar} aria-label={`Quitar ${proceso.cargo} de destacados`}>Quitar de destacados</button></div>
 </article>;
}
