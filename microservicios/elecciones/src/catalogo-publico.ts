import { createHash } from 'node:crypto';

type ProcesoPublicable = { id: string; idOrganizacion: string; nombre: string; cargo: string; tipo: string; actual: boolean; publicado: boolean; archivado: boolean; estado?:string; configuracion?:{ambito?:string;vuelta?:number} };
type CargoPublico = { id: string; nombre: string; cargo: string; ambito?:string; vuelta?:number; estado?:string };
type EventoPublico = { id: string; nombre: string; tipo: string; destacado: boolean; procesos: CargoPublico[] };

function prioridadCargo(cargo: string) {
 const nombre = cargo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
 if (/vice\s*rrect|vice\s*rect/.test(nombre)) return 1;
 if (/rector/.test(nombre)) return 0;
 if (/decan/.test(nombre)) return 2;
 if (/director|direccion/.test(nombre)) return 3;
 return 4;
}

// Un evento reúne cargos con el mismo nombre y organización. Nunca se mezclan instituciones.
// La selección destacada pertenece al administrador; el portal no decide importancia por votos.
export function agruparEventos(procesos: ProcesoPublicable[]): EventoPublico[] {
 const eventos = new Map<string, EventoPublico>();
 for (const p of procesos) {
  if (p.archivado || !(p.publicado || p.actual)) continue;
  const id = createHash('sha256').update(JSON.stringify([p.idOrganizacion, p.nombre])).digest('hex');
  const evento = eventos.get(id) ?? { id, nombre: p.nombre, tipo: p.tipo, destacado: false, procesos: [] };
  evento.destacado ||= p.actual;
  evento.procesos.push({ id: p.id, nombre: p.nombre, cargo: p.cargo, ...(p.configuracion?{ambito:p.configuracion.ambito??'',vuelta:p.configuracion.vuelta??1}:{}),...(p.estado?{estado:p.estado}:{}) });
  eventos.set(id, evento);
 }
 for (const e of eventos.values()) e.procesos.sort((a, b) => prioridadCargo(a.cargo) - prioridadCargo(b.cargo) || a.cargo.localeCompare(b.cargo, 'es') || a.id.localeCompare(b.id));
 return [...eventos.values()].sort((a, b) => Number(b.destacado) - Number(a.destacado) || a.nombre.localeCompare(b.nombre, 'es') || a.id.localeCompare(b.id));
}
