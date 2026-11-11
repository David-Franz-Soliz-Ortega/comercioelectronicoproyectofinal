import { cabecerasSesion, comprobarAcceso } from './clienteSesion.js';
export async function consultarGraphql(query, variables = {}, senal) {
  let respuesta;
  try { respuesta = await fetch('/graphql', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...cabecerasSesion() },
    body: JSON.stringify({ query, variables }),
    signal: senal ? AbortSignal.any([senal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  }); } catch (fallo) {
    throw new Error(fallo.name === 'TimeoutError' ? 'La consulta tardó demasiado. Vuelve a actualizar.' : 'No se pudo conectar con SIGAPE. Revisa tu conexión y vuelve a intentarlo.');
  }
  comprobarAcceso(respuesta.status);
  if (!respuesta.ok) throw new Error('No se pudo completar la consulta. Intenta actualizar en unos momentos.');
  let contenido;
  try { contenido = await respuesta.json(); } catch { throw new Error('La respuesta recibida no es válida. Vuelve a actualizar.'); }
  const errores = contenido.errors ?? [];
  if (errores.some(error => error.extensions?.code === 'NO_AUTENTICADO')) comprobarAcceso(401);
  if (errores.some(error => error.extensions?.code === 'NO_AUTORIZADO')) comprobarAcceso(403);
  if (!contenido.data) {
    const codigo = contenido.errors?.[0]?.extensions?.code;
    const mensaje = codigo === 'ENTRADA_INVALIDA' ? 'Revisa los datos ingresados e inténtalo de nuevo.' :
      codigo === 'LIMITE_DE_CARGA' ? 'La consulta es demasiado amplia. Aplica un filtro para reducirla.' :
        'No se pudo consultar la información. Intenta actualizar en unos momentos.';
    throw new Error(mensaje);
  }
  return { datos: contenido.data, advertencia: contenido.errors?.length ? 'Algunas referencias no están disponibles. Puedes actualizar para intentarlo de nuevo.' : '' };
}
