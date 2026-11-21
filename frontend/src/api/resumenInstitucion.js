// Totales del catálogo autorizado; los procesos archivados se informan por separado.
export function resumirInstitucion(procesos,cuentas,idOrganizacion){
 const activos=procesos.filter(p=>p.estado!=='archivada');
 const mesas=new Set(activos.flatMap((p,i)=>p.mesas.map((m,j)=>m.idMesaFisica||m.id||`${i}:${j}`)));
 const operadores=new Set(cuentas.filter(c=>c.activo&&c.roles?.some(r=>r.rol==='OPERADOR'&&r.idOrganizacion===idOrganizacion)&&!c.roles.some(r=>r.rol==='ADMINISTRADOR'&&(r.idOrganizacion===null||r.idOrganizacion===idOrganizacion))).map(c=>c.idUsuario));
 return {eventos:new Set(activos.map(p=>p.nombre)).size,cargos:activos.length,candidatos:activos.reduce((s,p)=>s+p.candidatos.length,0),mesas:mesas.size,actasEsperadas:activos.reduce((s,p)=>s+p.mesas.length,0),operadores:operadores.size,archivados:procesos.length-activos.length};
}
