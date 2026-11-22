export function consultaResumenCargos(cargos){
 const pagina=cargos.slice(0,6);
 return {query:'query ResumenCargos('+pagina.map((_,i)=>'$id'+i+':ID!').join(',')+'){'+pagina.map((_,i)=>'cargo'+i+':portal(idProceso:$id'+i+'){proceso{id cargo} resultados{total validos blancos nulos contabilizadas esperadas candidatos{id nombre votos}}}').join(' ')+'}',variables:Object.fromEntries(pagina.map((p,i)=>['id'+i,p.id]))};
}
export function comprobarResumenCargos(datos){
 const entero=v=>Number.isSafeInteger(v)&&v>=0;
 return Object.values(datos).map(p=>{
  const r=p?.resultados;
  if(!p?.proceso?.id||!r||!['total','validos','blancos','nulos','contabilizadas','esperadas'].every(k=>entero(r[k]))||r.contabilizadas>r.esperadas||r.validos+r.blancos+r.nulos!==r.total||!Array.isArray(r.candidatos)||!r.candidatos.every(c=>c.id&&typeof c.nombre==='string'&&entero(c.votos))||r.candidatos.reduce((s,c)=>s+c.votos,0)!==r.validos||new Set(r.candidatos.map(c=>c.id)).size!==r.candidatos.length)throw Error('No se pudo verificar el resumen de resultados.');
  return p;
 });
}
