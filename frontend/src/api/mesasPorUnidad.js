export function mesasPorUnidad(mesas){
 const grupos=new Map();
 for(const mesa of mesas){if(!grupos.has(mesa.unidad))grupos.set(mesa.unidad,[]);grupos.get(mesa.unidad).push(mesa);}
 return [...grupos].map(([unidad,mesas])=>({unidad,mesas}));
}
