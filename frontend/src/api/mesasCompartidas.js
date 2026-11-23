// Una mesa física puede tener varias actas, siempre identificadas por su cargo.
export function agruparMesasFisicas(mesas) {
  const grupos = new Map();
  for (const mesa of mesas) {
    const id = mesa.idMesaFisica || mesa.idMesa || mesa.id;
    if (!grupos.has(id)) grupos.set(id, { id, codigo: mesa.codigo, unidad: mesa.unidad, sector: mesa.sector, cargos: [] });
    grupos.get(id).cargos.push(mesa);
  }
  return [...grupos.values()];
}

export function listarMesasInstitucion(procesos) {
 const filas = procesos.filter(p => p.estado !== 'archivada').flatMap(p => (p.mesas ?? []).map(m => ({ ...m, idMesa: m.id, idProceso: p.id, cargo: p.cargo, ambito: p.ambito, facultad: p.facultad, vuelta: p.vuelta, estado: p.estado, publicado: p.publicado, actual: p.actual })));
 return agruparMesasFisicas(filas).map(m => {
  const facultades = new Map();
  for (const c of m.cargos) {
   const nombre = c.facultad?.trim();
   if (nombre) { const clave = nombre.normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase('es'); if (!facultades.has(clave)) facultades.set(clave,nombre); }
  }
  return { ...m, facultad: facultades.size === 1 ? facultades.values().next().value : '', idMesaFisica: m.cargos[0].idMesaFisica, recinto: m.cargos[0].recinto, apellidoDesde: m.cargos[0].apellidoDesde, apellidoHasta: m.cargos[0].apellidoHasta };
 })
  .sort((a,b) => a.codigo.localeCompare(b.codigo,'es',{numeric:true}) || (a.unidad ?? '').localeCompare(b.unidad ?? '','es'));
}

// Sugiere un código legible a partir del último número usado en la institución.
export function siguienteCodigoMesa(procesos) {
  let mayor = 0;
  for (const mesa of listarMesasInstitucion(procesos)) {
    const numero = Number(String(mesa.codigo ?? '').match(/(\d+)\s*$/)?.[1] ?? 0);
    if (Number.isFinite(numero) && numero > mayor) mayor = numero;
  }
  return 'Mesa ' + String(mayor + 1).padStart(3, '0');
}

// Agrupación visual; no deduce vínculos entre mesas por su código o por su nombre.
export function agruparMesasPorFacultad(mesas) {
 const grupos = new Map();
 for (const mesa of mesas) {
  const nombre = (mesa.facultad || mesa.unidad || '').trim() || 'Sin unidad asignada';
  const clave = nombre.normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase('es');
  if (!grupos.has(clave)) grupos.set(clave, { id: clave, nombre, mesas: [] });
  grupos.get(clave).mesas.push(mesa);
 }
 return [...grupos.values()].sort((a,b) => a.nombre.localeCompare(b.nombre,'es'));
}
