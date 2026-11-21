import { cabecerasSesion, comprobarAcceso } from './clienteSesion.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function consultarFotografiaCandidato(id, organizacion, senal) {
  if (!uuid.test(id ?? '') || !uuid.test(organizacion ?? '')) throw new Error('Selecciona una institución y un candidato válidos.');
  const respuesta = await fetch(`/api/v1/configuracion/candidatos/${id}/foto`, {
    credentials: 'same-origin', cache: 'no-store',
    headers: { ...cabecerasSesion(), Accept: 'image/jpeg,image/png', 'X-Organizacion': organizacion },
    signal: senal ? AbortSignal.any([senal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
  });
  comprobarAcceso(respuesta.status);
  if (!respuesta.ok) throw Object.assign(new Error('No se pudo consultar la fotografía.'), { estado: respuesta.status });
  const tipo = respuesta.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  if (!['image/jpeg', 'image/png'].includes(tipo)) throw new Error('La fotografía tiene un formato no disponible.');
  const imagen = await respuesta.blob();
  if (!imagen.size || imagen.size > 2000000) throw new Error('La fotografía tiene un tamaño no válido.');
  return imagen;
}
