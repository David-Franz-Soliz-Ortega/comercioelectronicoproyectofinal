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
 return procesos.filter(p => p.estado === 'borrador' && !p.actual && !p.publicado).flatMap(p => (p.mesas ?? []).map(m => ({ ...m, cargo: p.cargo, ambito: p.ambito, facultad: p.facultad, idProceso: p.id })));
}

// La ocupación se resuelve por identificadores, nunca por códigos de mesa repetidos.
export function estadoAsignacionMesa(grupo, asignaciones, idUsuario) {
 const ids=new Set(grupo.cargos.map(c=>c.idMesa??c.id));
 const fisicas=new Set(grupo.cargos.map(c=>c.idMesaFisica).filter(Boolean));
 const vinculadas=asignaciones.filter(a=>ids.has(a.idMesa)||(a.idMesaFisica&&fisicas.has(a.idMesaFisica)));
 const propias=new Set(vinculadas.filter(a=>idUsuario&&a.idUsuario===idUsuario&&ids.has(a.idMesa)).map(a=>a.idMesa));
 return {ocupada:vinculadas.some(a=>a.idUsuario!==idUsuario),propias,completa:propias.size===ids.size,parcial:propias.size>0&&propias.size<ids.size};
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

// Reparte las mesas físicas todavía sin operador entre los operadores activos con menos carga.
// Todas las actas de una misma mesa quedan con el mismo operador.
// No modifica datos: devuelve los grupos para que el llamador confirme las asignaciones.
export function distribuirMesasPendientes({ cuentas, asignaciones, procesos, organizacion }) {
 const operadores = cuentas.filter(c => c.activo && c.roles?.some(r => r.rol === 'OPERADOR' && r.idOrganizacion === organizacion) && !c.roles.some(r => r.rol === 'ADMINISTRADOR' && (r.idOrganizacion === null || r.idOrganizacion === organizacion)));
 if (!operadores.length) return [];
 const asignadas = new Set(asignaciones.map(a => a.idMesa));
 const fisicasPorOperador = new Map();
 for (const a of asignaciones) {
  const clave = a.idMesaFisica || a.idMesa;
  if (!fisicasPorOperador.has(a.idUsuario)) fisicasPorOperador.set(a.idUsuario, new Set());
  fisicasPorOperador.get(a.idUsuario).add(clave);
 }
 const carga = new Map(operadores.map(c => [c.idUsuario, fisicasPorOperador.get(c.idUsuario)?.size ?? 0]));
 const porMesa = new Map();
 for (const mesa of mesasAsignables(procesos)) {
  const clave = mesa.idMesaFisica || mesa.id;
  if (!porMesa.has(clave)) porMesa.set(clave, []);
  porMesa.get(clave).push(mesa);
 }
 const grupos = new Map();
 for (const [clave, actas] of porMesa) {
  const libres = actas.filter(m => !asignadas.has(m.id));
  if (!libres.length) continue;
  const yaAsignado = actas.map(m => asignaciones.find(a => a.idMesa === m.id)?.idUsuario).find(Boolean);
  const idUsuario = yaAsignado && carga.has(yaAsignado) ? yaAsignado : [...carga.entries()].sort((a, b) => a[1] - b[1])[0][0];
  if (!grupos.has(idUsuario)) grupos.set(idUsuario, []);
  grupos.get(idUsuario).push(...libres.map(m => m.id));
  carga.set(idUsuario, carga.get(idUsuario) + (yaAsignado === idUsuario ? 0 : 1));
 }
 return [...grupos].map(([idUsuario, mesas]) => ({ idUsuario, mesas }));
}

// Las cuentas ajenas no se incluyen; las asignaciones provienen del endpoint del ámbito.
export function listarOperadoresInstitucion({cuentas,asignaciones,organizacion,busqueda='',idUsuario='',soloPendientes=false}) {
 const porId=new Map(cuentas.filter(c=>c.roles?.some(r=>r.rol==='OPERADOR'&&r.idOrganizacion===organizacion)).map(c=>[c.idUsuario,c]));
 const mesasPorUsuario=new Map();
 for(const a of asignaciones){
  if(!porId.has(a.idUsuario))porId.set(a.idUsuario,cuentas.find(c=>c.idUsuario===a.idUsuario)??{idUsuario:a.idUsuario,usuario:'Cuenta no disponible',activo:false});
  if(!mesasPorUsuario.has(a.idUsuario))mesasPorUsuario.set(a.idUsuario,[]);
  mesasPorUsuario.get(a.idUsuario).push(a);
 }
 const normalizar=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
 const consulta=normalizar(busqueda.trim());
 return [...porId.values()].filter(c=>!idUsuario||c.idUsuario===idUsuario).map(cuenta=>({cuenta,mesas:mesasPorUsuario.get(cuenta.idUsuario)??[]}))
  .filter(g=>(!soloPendientes||!g.mesas.length)&&(!consulta||[g.cuenta.usuario,...g.mesas.flatMap(m=>[m.codigo,m.cargo,m.ambito,m.unidad,m.sector])].some(v=>normalizar(v).includes(consulta))))
  .sort((a,b)=>Number(Boolean(a.mesas.length))-Number(Boolean(b.mesas.length))||a.cuenta.usuario.localeCompare(b.cuenta.usuario,'es',{numeric:true}));
}
