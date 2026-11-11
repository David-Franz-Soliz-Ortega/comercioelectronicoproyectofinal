export const etiquetas = { activa: 'Activa', suspendida: 'Suspendida', borrador: 'Borrador', programada: 'Programada', en_curso: 'En curso', finalizada: 'Finalizada', anulada: 'Anulada', pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada', retirada: 'Retirada' };
export const numero = valor => valor == null ? '—' : new Intl.NumberFormat('es-VE').format(valor);
export const fecha = valor => { const instante = new Date(valor); return Number.isFinite(instante.getTime()) ? new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium' }).format(instante) : 'No disponible'; };
