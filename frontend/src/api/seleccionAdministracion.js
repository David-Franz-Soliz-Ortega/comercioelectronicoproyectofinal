// El catálogo administrativo recibido ya está limitado a la institución autorizada.
export function eventosDeProcesos(procesos) {
 const eventos=new Map();
 for(const proceso of procesos){
  if(!eventos.has(proceso.nombre))eventos.set(proceso.nombre,{nombre:proceso.nombre,procesos:[]});
  eventos.get(proceso.nombre).procesos.push(proceso);
 }
 return [...eventos.values()];
}
export function procesoInicialDeEvento(procesos,nombre) {
 const cargos=procesos.filter(p=>p.nombre===nombre);
 return cargos.find(p=>p.actual)?.id??cargos[0]?.id??'';
}

// Mantiene el contrato REST sin pedir otro nombre al administrador.
// Los nombres existentes se conservan al editar o añadir un cargo.
export function completarNombreEleccion(datos, institucion) {
 const nombre = datos.nombre?.trim() || institucion?.nombre?.trim().slice(0, 120).trim();
 if (!nombre) throw new Error('Selecciona una institución antes de guardar la elección.');
 return { ...datos, nombre };
}

export function tiposCargoUniversitarios(procesos,cargoActual=''){
 const tipos=['Rector','Vicerrector','Decano','Director'];
 const clave=valor=>valor.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
 const vistos=new Set(tipos.map(clave));
 for(const nombre of procesos.filter(p=>p.tipo==='universidad').map(p=>p.cargo)){
  if(typeof nombre!=='string'||!nombre.trim()||vistos.has(clave(nombre)))continue;
  vistos.add(clave(nombre));tipos.push(nombre.trim());
 }
 // Mantener seleccionable la escritura exacta del cargo que se está editando.
 if(typeof cargoActual==='string'&&cargoActual.trim()){
  const indice=tipos.findIndex(tipo=>clave(tipo)===clave(cargoActual));
  if(indice<0)tipos.push(cargoActual);else tipos[indice]=cargoActual;
 }
 return tipos;
}

const familiasCargo=[
 {id:'rectorado',nombre:'Rectorado',patron:/\b(?:rector(?:a|es|as)?|rectorados?)\b/},
 {id:'vicerrectorado',nombre:'Vicerrectorado',patron:/\bvice\s*r?rector(?:a|es|as|ados?)?\b/g},
 {id:'decanos',nombre:'Decanos',patron:/\b(?:decan[oa]s?|decanatos?|decanaturas?)\b/},
 {id:'directores',nombre:'Directores',patron:/\b(?:director(?:a|es|as)?|direccion(?:es)?)\b/},
];
const normalizarCargo=nombre=>String(nombre??'').normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('es').replace(/[^a-z0-9]+/g,' ').trim();

// Solo organiza el catálogo recibido: no cambia nombres, IDs, permisos ni ámbitos.
export function agruparCargos(procesos){
 const grupos=new Map();
 for(const p of procesos){
  const nombre=String(p.cargo??'').trim()||'Sin nombre',normalizado=normalizarCargo(nombre);
  const sinVice=normalizado.replace(familiasCargo[1].patron,' ');
  const coincidencias=familiasCargo.filter(f=>f.id==='vicerrectorado'?sinVice!==normalizado:f.patron.test(sinVice));
  const familia=coincidencias.length===1?coincidencias[0]:{id:'otro:'+normalizado,nombre};
  if(!grupos.has(familia.id))grupos.set(familia.id,{id:familia.id,nombre:familia.nombre,procesos:[]});
  grupos.get(familia.id).procesos.push(p);
 }
 const orden=id=>{const n=familiasCargo.findIndex(f=>f.id===id);return n<0?familiasCargo.length:n;};
 return [...grupos.values()].sort((a,b)=>orden(a.id)-orden(b.id)||a.nombre.localeCompare(b.nombre,'es')).map(g=>({...g,cantidad:g.procesos.length}));
}
