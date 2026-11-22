// Reutiliza la asignación idempotente del servicio. Conserva cada avance para reintentar sin recrear cuentas.
export async function asignarMesasOperador({ pedir, organizacion, idUsuario, mesas, completadas, alCompletar }) {
 for (const id of mesas) {
  if (completadas.has(id)) continue;
  await pedir('/configuracion/mesas/' + encodeURIComponent(id) + '/asignar', { metodo: 'POST', organizacion, datos: { idUsuario } });
  completadas.add(id);
  alCompletar?.(id);
 }
}
export function mesasAsignables(procesos) {
 return procesos.filter(p => p.estado === 'borrador' && !p.actual && !p.publicado).flatMap(p => (p.mesas ?? []).map(m => ({ ...m, cargo: p.cargo, ambito: p.ambito, idProceso: p.id })));
}

// El código solo identifica una mesa física si el catálogo autorizado no es ambiguo.
// El servicio vuelve a comprobar organización, rol y estado en cada escritura.
export function resolverMesaOperador(codigo, procesos) {
 const mesa=String(codigo??'').trim();
 if(!mesa)return {ids:[],aviso:'Sin mesa'};
 const coincidencias=procesos.filter(p=>p.estado!=='archivada').flatMap(p=>(p.mesas??[]).filter(m=>m.codigo===mesa).map(m=>({...m,proceso:p})));
 if(!coincidencias.length)return {ids:[],aviso:'Mesa no encontrada: '+mesa};
 const fisicas=new Set(coincidencias.map(m=>m.idMesaFisica||m.id));
 if(fisicas.size!==1)return {ids:[],aviso:'Código ambiguo: '+mesa};
 if(coincidencias.some(m=>m.proceso.estado!=='borrador'||m.proceso.actual||m.proceso.publicado))return {ids:[],aviso:'Mesa bloqueada: '+mesa};
 return {ids:[...new Set(coincidencias.map(m=>m.id))],aviso:''};
}

export async function completarImportacionOperadores({operadores,procesos,organizacion,pedir}) {
 const resultados=[];
 for(const operador of operadores){
  const destino=resolverMesaOperador(operador.mesa,procesos),completadas=new Set();
  let aviso=destino.aviso;
  try{await asignarMesasOperador({pedir,organizacion,idUsuario:operador.idUsuario,mesas:destino.ids,completadas});}
  catch{aviso='Asignación pendiente; revisa desde Editar mesas.';}
  resultados.push({usuario:operador.usuario,mesa:operador.mesa||'—',asignadas:completadas.size,estado:aviso?(completadas.size?'Parcial: ':'Pendiente: ')+aviso:'Asignado'});
 }
 return resultados;
}
