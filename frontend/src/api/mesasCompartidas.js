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
