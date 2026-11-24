// Agrupa las pantallas existentes sin alterar permisos ni la selección de cargo.
export const gruposAdministracion = [
  { id: 'resumen', nombre: 'Resumen', descripcion: 'Estado general', apartados: [{ id: 'organizacion', destino: 'resumen', nombre: 'Resumen' }] },
  { id: 'eleccion', nombre: 'Elección', descripcion: 'Cargos, candidatos y registro', ayuda: 'Prepara los cargos, sus candidaturas y los lugares donde se recibirán actas.', apartados: [
    { id: 'eleccion', destino: 'configuracion', nombre: 'Cargos' },
    { id: 'candidatos', destino: 'candidatos', nombre: 'Candidatos' },
    { id: 'mesas', destino: 'mesas', nombre: 'Mesas de la elección' },
  ] },
  { id: 'equipo', nombre: 'Equipo', descripcion: 'Operadores y administradores', ayuda: 'Asigna a cada operador su trabajo y gestiona las cuentas del personal.', apartados: [
    { id: 'asignaciones', destino: 'asignaciones', nombre: 'Operadores' },
    { id: 'usuarios', destino: 'usuarios', nombre: 'Administradores' },
  ] },
  { id: 'conteo', nombre: 'Conteo y publicación', descripcion: 'Inicio, seguimiento y cierre', ayuda: 'Revisa los pendientes, publica los cargos y controla la recepción de actas.', apartados: [{ id: 'publicacion', destino: 'publicacion', nombre: 'Estado y publicación' }] },
];
export const grupoAdministracion = destino => gruposAdministracion.find(g => g.apartados.some(a => a.destino === destino)) ?? gruposAdministracion[0];
