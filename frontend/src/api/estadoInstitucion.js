import {nombresEstadoInstitucion} from './catalogos.js';
import { listarMesasInstitucion } from './mesasCompartidas.js';

export function resumirInstitucion(procesos,asignaciones=null){
 const cargos=procesos.filter(p=>p.estado!=='archivada'&&!p.archivado&&!p.eliminada);
 const mesas=cargos.flatMap(p=>p.mesas??[]),ids=new Set(mesas.map(m=>m.id));
 const propias=asignaciones===null?null:asignaciones.filter(a=>ids.has(a.idMesa));
 const cubiertas=propias===null?null:new Set(propias.map(a=>a.idMesa));
 const estados=[...new Set(cargos.map(p=>p.estado))];
 return {cargos,candidaturas:cargos.reduce((s,p)=>s+(p.candidatos?.length??0),0),mesasFisicas:listarMesasInstitucion(cargos).length,actasEsperadas:mesas.length,
 operadores:propias===null?null:new Set(propias.map(a=>a.idUsuario)).size,mesasSinOperador:cubiertas===null?null:mesas.filter(m=>!cubiertas.has(m.id)).length,
 estado:!estados.length?'Sin cargos':estados.length>1?'Estados mixtos':(nombresEstadoInstitucion[estados[0]]??estados[0])};
}
