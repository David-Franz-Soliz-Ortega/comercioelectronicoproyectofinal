export const servicios = ['identidad', 'elecciones', 'candidaturas', 'padron-electoral', 'votacion', 'resultados'];
export async function consultarEstadoServicio(servicio, senal) {
  try {
    const respuesta = await fetch('/api/v1/salud/' + servicio, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([senal, AbortSignal.timeout(8000)]) });
    const datos = await respuesta.json();
    return respuesta.ok && datos.servicio === servicio ? 'Disponible' : respuesta.status === 401 || respuesta.status === 403 ? 'Consulta restringida' : 'No disponible';
  } catch { return 'Sin respuesta'; }
}
