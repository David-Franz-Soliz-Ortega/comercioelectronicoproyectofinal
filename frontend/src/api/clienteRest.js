import { cabecerasSesion, comprobarAcceso } from './clienteSesion.js';
export async function solicitarRest(ruta, { metodo = 'GET', datos, organizacion, senal } = {}) {
  if (!/^\/(?:identidades|usuarios|organizaciones|elecciones|candidaturas|inscripciones)(?:[/?]|$)/.test(ruta)) throw new Error('Recurso REST no permitido.');
  let respuesta;
  try {
    respuesta = await fetch('/api/v1' + ruta, { method: metodo, credentials: 'same-origin', cache: 'no-store',
      headers: { Accept: 'application/json', ...cabecerasSesion(), ...(organizacion ? { 'X-Organizacion': organizacion } : {}), ...(datos ? { 'Content-Type': 'application/json' } : {}) },
      ...(datos ? { body: JSON.stringify(datos) } : {}), signal: senal ? AbortSignal.any([senal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    });
  } catch { throw new Error('No se pudo conectar. Actualiza el listado antes de repetir una escritura.'); }
  comprobarAcceso(respuesta.status);
  if (!respuesta.ok) {
    const mensajes = { 400: 'Revisa los filtros y los datos ingresados.', 404: 'El registro ya no está disponible. Actualiza el listado.', 409: 'La operación tiene un conflicto. Actualiza antes de continuar.', 422: 'Revisa los campos requeridos y sus formatos.' };
    throw new Error(mensajes[respuesta.status] ?? 'No se pudo confirmar la operación. Actualiza antes de volver a intentarlo.');
  }
  if (respuesta.status === 204) return null;
  try { return await respuesta.json(); } catch { throw new Error('La API devolvió una respuesta inválida. Actualiza antes de continuar.'); }
}
