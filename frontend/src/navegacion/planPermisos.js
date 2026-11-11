// Reflejo de las acciones existentes de identidad para presentar la interfaz.
// El backend vuelve a validar cada solicitud, rol y organización.
export const permisosPrevistosPorRol = {
  SUPERADMIN: ['identidades:leer', 'identidades:escribir'],
  ADMIN_ELECTORAL: ['elecciones:leer', 'elecciones:crear', 'elecciones:modificar', 'candidaturas:leer', 'candidaturas:crear', 'candidaturas:modificar', 'padron:leer', 'padron:crear', 'padron:modificar', 'votos:leer', 'resultados:leer'],
  OPERADOR: ['elecciones:leer', 'candidaturas:leer', 'candidaturas:crear', 'padron:leer', 'padron:crear', 'resultados:leer'],
  ELECTOR: ['elecciones:leer', 'candidaturas:leer', 'resultados:leer'],
  AUDITOR: ['elecciones:leer', 'candidaturas:leer', 'padron:leer', 'votos:leer', 'resultados:leer'],
};
export const rolesPrevistos = Object.keys(permisosPrevistosPorRol);
const acciones = { usuarios: 'identidades:leer', elecciones: 'elecciones:leer', candidaturas: 'candidaturas:leer', padron: 'padron:leer', votacion: 'votos:leer', resultados: 'resultados:leer' };
export function tienePermiso(sesion, accion) {
  return (sesion?.roles ?? []).some(asignacion =>
    (asignacion.rol === 'SUPERADMIN' || (sesion.idOrganizacion && asignacion.idOrganizacion === sesion.idOrganizacion)) &&
    permisosPrevistosPorRol[asignacion.rol]?.includes(accion));
}
export function puedeVerSeccion(sesion, seccion) {
  return Boolean(sesion) && (seccion === 'inicio' || tienePermiso(sesion, acciones[seccion]));
}
