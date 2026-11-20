// Orientación de la interfaz; los permisos y las escrituras siguen validándose en backend.
export function prepararEleccion({ organizacion, proceso, cuentas = [], asignacionesConfirmadas = 0 }) {
  const candidatos = proceso?.candidatos?.length ?? 0;
  const mesas = proceso?.mesas?.length ?? 0;
  const operadores = cuentas.filter(c => c.activo
    && c.roles?.some(r => r.rol === 'OPERADOR' && r.idOrganizacion === organizacion)
    && !c.roles.some(r => r.rol === 'ADMINISTRADOR' && (r.idOrganizacion === null || r.idOrganizacion === organizacion)));
  const pasos = [
    { id: 'organizacion', titulo: 'Organización', destino: 'usuarios', listo: !!organizacion, detalle: 'Selecciona dónde se realizará la elección.' },
    { id: 'eleccion', titulo: 'Elección', destino: 'configuracion', listo: !!proceso, detalle: 'Crea o selecciona la elección que vas a preparar.' },
    { id: 'candidatos', titulo: 'Candidatos', destino: 'candidatos', listo: candidatos > 0, detalle: `${candidatos} registrados. Completa la lista antes de asignar mesas.` },
    { id: 'mesas', titulo: 'Mesas', destino: 'mesas', listo: mesas > 0, detalle: `${mesas} registradas. Incluye todas las mesas esperadas.` },
    { id: 'operadores', titulo: 'Operadores', destino: 'usuarios', listo: operadores.length > 0, detalle: `${operadores.length} cuentas habilitadas para registrar actas.` },
    { id: 'asignaciones', titulo: 'Asignaciones', destino: 'asignaciones', listo: asignacionesConfirmadas > 0, detalle: asignacionesConfirmadas > 0 ? `${asignacionesConfirmadas} operaciones de asignación confirmadas en esta sesión; revisa que todas las mesas tengan responsable.` : 'Asigna cada mesa a un operador. Las asignaciones anteriores no se vuelven a contar aquí.' },
    { id: 'publicacion', titulo: 'Publicación', destino: 'publicacion', listo: !!(proceso?.actual || proceso?.publicado), detalle: (proceso?.actual || proceso?.publicado) ? 'Esta elección ya es visible para el público.' : 'Revisa la configuración y elige qué verá el público.' },
  ];
  const siguiente = pasos.find(p => !p.listo && (p.id !== 'asignaciones' || !proceso?.actual)) ?? pasos.at(-1);
  return { pasos, siguiente, operadores, puedePublicar: !!organizacion && candidatos > 0 && mesas > 0 };
}
