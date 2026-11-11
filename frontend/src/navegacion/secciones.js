
export const seccionesRegistros = {
  elecciones: { titulo: 'Elecciones', descripcion: 'Consulta y organiza los procesos electorales.', icono: 'urna', recurso: 'elecciones', estados: ['borrador', 'programada', 'en_curso', 'finalizada', 'anulada'] },
  candidaturas: { titulo: 'Candidaturas', descripcion: 'Revisa las postulaciones y su elección asociada.', icono: 'personas', recurso: 'candidaturas', estados: ['borrador', 'pendiente', 'aprobada', 'rechazada', 'retirada'] },
  padron: { titulo: 'Padrón electoral', descripcion: 'Consulta las inscripciones y su elegibilidad.', icono: 'lista', recurso: 'inscripciones', estados: [] },
};

// Los permisos de navegación se resuelven con la sesión en planPermisos.js.
export { rolesPrevistos } from './planPermisos.js';
export const secciones = {
  inicio: { titulo: 'Inicio', icono: 'inicio' },
  usuarios: { titulo: 'Usuarios', icono: 'personas' },
  elecciones: { ...seccionesRegistros.elecciones },
  candidaturas: { ...seccionesRegistros.candidaturas },
  padron: { ...seccionesRegistros.padron },
  votacion: { titulo: 'Votación', icono: 'urna' },
  resultados: { titulo: 'Resultados', icono: 'resultados' },
};
export function resolverSeccion(hash) {
  const clave = hash.replace(/^#/, '');
  return Object.hasOwn(secciones, clave) ? clave : 'inicio';
}
