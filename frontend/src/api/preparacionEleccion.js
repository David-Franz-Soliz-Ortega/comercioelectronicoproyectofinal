// Comprobaciones de preparación; los permisos y las escrituras se validan en backend.
export function prepararEleccion({ organizacion, proceso, cuentas = [] }) {
  const candidatos = proceso?.candidatos?.length ?? 0;
  const mesas = proceso?.mesas?.length ?? 0;
  const operadores = cuentas.filter(c => c.activo
    && c.roles?.some(r => r.rol === 'OPERADOR' && r.idOrganizacion === organizacion)
    && !c.roles.some(r => r.rol === 'ADMINISTRADOR' && (r.idOrganizacion === null || r.idOrganizacion === organizacion)));
  return { operadores, puedePublicar: !!organizacion && candidatos > 0 && mesas > 0 };
}
