// Opciones de la interfaz; el servidor revalida estado, sectores, unidad y permisos.
const normalizar = s => s.normalize('NFKC').trim().toLocaleLowerCase('es');
export function opcionesCreacionMesa(procesos, ids) {
 const borradores = procesos.filter(p => p.estado === 'borrador' && !p.actual && !p.publicado);
 const seleccionados = borradores.filter(p => ids.includes(p.id));
 const conSectores = seleccionados.filter(p => p.sectores?.length);
 const baseSectores = conSectores[0]?.sectores ?? [{ codigo: 'general', nombre: 'General' }];
 const sectores = baseSectores.filter(s => seleccionados.every(p => p.sectores?.length ? p.sectores.some(t => t.codigo === s.codigo) : ['general','docentes','estudiantes'].includes(s.codigo)));
 const restringidos = seleccionados.filter(p => p.carreras?.length);
 const unidadesDe = p => [...(p.facultad && p.grupoCarreras ? [p.facultad+' · '+p.grupoCarreras] : []), ...p.carreras];
 const unidades = restringidos.length ? [...new Set(unidadesDe(restringidos[0]))].filter(u => restringidos.every(p => unidadesDe(p).some(v => normalizar(v) === normalizar(u)))) : null;
 return { borradores, seleccionados, sectores, unidades, seleccionDesactualizada: ids.some(id => !borradores.some(p => p.id === id)) };
}
