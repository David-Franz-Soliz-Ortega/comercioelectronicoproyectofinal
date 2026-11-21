// Progreso orientativo reconstruido desde las APIs; nunca sustituye la autorización del servidor.
export function pasosDeEleccion({ proceso, operadores = [], asignaciones = [] }) {
  const mesas = proceso?.mesas ?? [];
  return [
    { destino: 'configuracion', titulo: 'Elección', listo: !!proceso },
    { destino: 'candidatos', titulo: 'Candidatos', listo: !!proceso?.candidatos?.length },
    { destino: 'mesas', titulo: 'Mesas', listo: mesas.length > 0 },
    { destino: 'usuarios', titulo: 'Operadores', listo: operadores.length > 0 },
    { destino: 'asignaciones', titulo: 'Asignar mesas', listo: mesas.length > 0 && mesas.every(m => asignaciones.some(a => a.idMesa === m.id)) },
    { destino: 'publicacion', titulo: 'Revisar e iniciar', listo: proceso?.estado === 'recepcion' },
  ];
}
