// Las cookies de sesión son HttpOnly: el navegador las envía, React no las lee.
export class ErrorAcceso extends Error {
  constructor(estado, mensaje) { super(mensaje); this.estado = estado; }
}
let organizacion = '';
export function establecerOrganizacion(valor) { organizacion = valor ?? ''; }
export function cabecerasSesion() {
  const cookies = typeof document === 'undefined' ? [] : document.cookie.split(';').map(valor => valor.trim());
  const csrf = cookies.find(valor => /^(?:__Host-)?sigape-csrf=/.test(valor))?.split('=').slice(1).join('=');
  return { ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(organizacion ? { 'X-Organizacion': organizacion } : {}) };
}
export function comprobarAcceso(estado, notificar = true) {
  if (estado !== 401 && estado !== 403) return;
  if (estado === 401 && notificar && typeof window !== 'undefined') window.dispatchEvent(new Event('sigape:sesion-caducada'));
  throw new ErrorAcceso(estado, estado === 401 ? 'La sesión terminó. Inicia sesión de nuevo.' : 'No tienes permiso para esta operación o su organización.');
}
async function solicitar(ruta, metodo = 'GET', datos, notificar = true) {
  let respuesta;
  try {
    respuesta = await fetch('/api/v1/autenticacion/' + ruta, {
      method: metodo, credentials: 'same-origin', cache: 'no-store',
      headers: { Accept: 'application/json', ...cabecerasSesion(), ...(datos ? { 'Content-Type': 'application/json' } : {}) },
      ...(datos ? { body: JSON.stringify(datos) } : {}), signal: AbortSignal.timeout(15000),
    });
  } catch { throw new Error('No se pudo conectar con identidad. Vuelve a intentarlo.'); }
  comprobarAcceso(respuesta.status, notificar);
  if (!respuesta.ok) throw new Error(respuesta.status === 429 ? 'Demasiados intentos. Espera 15 minutos.' : 'No se pudo completar la solicitud de sesión.');
  return respuesta.status === 204 ? null : respuesta.json();
}
export const obtenerSesion = () => solicitar('yo');
export async function iniciarSesion(usuario, contrasena) {
  await solicitar('csrf');
  try { await solicitar('login', 'POST', { usuario, contrasena }, false); }
  catch (error) { if (error.estado === 401) throw new Error('Usuario o contraseña incorrectos.'); throw error; }
  return obtenerSesion();
}
export const finalizarSesion = () => solicitar('logout', 'POST');
export async function seleccionarOrganizacion(idOrganizacion) {
  await solicitar('organizacion', 'POST', { idOrganizacion });
  return obtenerSesion();
}
