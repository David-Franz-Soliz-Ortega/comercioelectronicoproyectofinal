import { agruparCargos } from './seleccionAdministracion.js';

const normalizar = valor => String(valor ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').trim();

// Los UUID mantienen separados los ámbitos y las vueltas, aunque se repitan nombres.
export function candidatosPorCargo(procesos, { busqueda = '', familia = '' } = {}) {
  const termino = normalizar(busqueda);
  const grupos = agruparCargos(procesos).filter(g => !familia || g.id === familia).map(g => ({
    ...g,
    procesos: g.procesos.filter(p => !termino || [p.cargo, p.nombre, p.ambito, p.facultad, p.grupoCarreras, ...(p.carreras ?? []), ...p.candidatos.map(c => c.nombre)].some(t => normalizar(t).includes(termino))),
  })).filter(g => g.procesos.length);
  const conFotografia = procesos.reduce((s, p) => s + p.candidatos.filter(c => c.tieneFoto || c.foto).length, 0);
  return {
    grupos,
    conFotografia,
    sinFotografia: procesos.reduce((s, p) => s + p.candidatos.length, 0) - conFotografia,
    totalCargos: procesos.length,
    totalCandidatos: procesos.reduce((s, p) => s + p.candidatos.length, 0),
    sinCandidatos: procesos.filter(p => !p.candidatos.length).length,
    cargosVisibles: grupos.reduce((s, g) => s + g.procesos.length, 0),
  };
}
