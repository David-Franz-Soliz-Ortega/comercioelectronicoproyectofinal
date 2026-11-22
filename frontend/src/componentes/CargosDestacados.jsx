import React from 'react';

export default function CargosDestacados({ cargos, alElegir }) {
 const destacados = cargos.filter(p => p.destacadoPortada);
 if (!destacados.length) return null;
 return <section className="cargos-destacados-portada" aria-labelledby="titulo-cargos-destacados">
  <h2 id="titulo-cargos-destacados">Candidaturas destacadas</h2>
  <div className="rejilla-cargos-destacados">{destacados.map(p => <article key={p.id} data-cargo-destacado={p.id}>
   <header><h3>{p.cargo}</h3><p>{p.ambito || p.nombre}{p.vuelta === 2 ? ' · Segunda vuelta' : ''}</p></header>
   <ul>{p.candidatos.map(c => <li key={c.id}><Retrato candidato={c} /><strong>{c.nombre}</strong></li>)}</ul>
   {!p.candidatos.length && <p>Todavía no hay candidaturas publicadas para este cargo.</p>}
   <button type="button" onClick={() => alElegir(p.id)}>Ver resultados de {p.cargo}</button>
  </article>)}</div>
 </section>;
}

function Retrato({ candidato }) {
 const [fallida, setFallida] = React.useState(false);
 return candidato.foto && !fallida ? <img src={candidato.foto} alt={`Fotografía de ${candidato.nombre}`} loading="lazy" width="64" height="64" onError={() => setFallida(true)} />
  : <span className="iniciales-destacado" aria-label={`Sin fotografía de ${candidato.nombre}`}>{candidato.nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toLocaleUpperCase('es')}</span>;
}
