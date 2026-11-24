import React from 'react';
export default function ResultadosSectores({ proceso, resultados }) {
 const sectores=proceso.sectores??[],regla=resultados.regla;
 return <>
  {sectores.length>0&&<section className="panel-publico resultados-sectores"><h2>Resultados por sector</h2>
   <p>{resultados.ponderacionAplicada?'Ponderación activada. Los porcentajes ponderados no son cantidades de votos.':'Sin ponderación: todos los votos tienen igual valor en el total.'}</p>
   <div className="cuadricula-sectores">{(resultados.sectores??[]).map(s=><article key={s.codigo}>
    <h3>{s.nombre}{resultados.ponderacionAplicada?` · Peso ${s.pesoBps/100} %`:''}</h3>
    <p>Mesas: {s.contabilizadas}/{s.esperadas} · Pendientes: {s.pendientes} · Válidos: {s.validos}</p>
    <table className="tabla-admin"><thead><tr><th>Candidato</th><th>Votos</th><th>% válidos del sector</th></tr></thead><tbody>{s.candidatos.map(c=><tr key={c.id}><td>{c.nombre}</td><td data-etiqueta="Votos">{c.votos}</td><td data-etiqueta="% válidos del sector">{c.porcentaje} %</td></tr>)}</tbody></table>
    <p>Blancos: {s.blancos} · Nulos: {s.nulos}</p>
   </article>)}</div>
   {resultados.ponderacionAplicada&&<><h3>Porcentajes ponderados</h3><ul>{resultados.candidatos.map(c=><li key={c.id}>{c.nombre}: <strong>{c.porcentajePonderado===null||c.porcentajePonderado===undefined?'Pendiente de votos válidos por sector':c.porcentajePonderado+' %'}</strong></li>)}</ul></>}
  </section>}
  {regla&&regla.estado!=='desactivada'&&<section className="panel-publico indicador-regla" aria-label="Indicador académico de segunda vuelta"><h2>Indicador de la regla configurada</h2><p>{regla.descripcion}</p>{regla.candidatos.length>0&&<p>Participantes señalados: {regla.candidatos.map(id=>resultados.candidatos.find(c=>c.id===id)?.nombre??'Candidato').join(', ')}</p>}<small>Orientación preliminar. No constituye proclamación oficial ni crea otra vuelta automáticamente.</small></section>}
 </>;
}
