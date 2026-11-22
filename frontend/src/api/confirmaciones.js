let pendiente = '';

// El productor confirma el éxito después de recibir respuesta de su API.
// Una importación puede notificar también a su padre: conservar su detalle una sola vez.
export function notificarExito(mensaje) {
 if (typeof window === 'undefined' || typeof mensaje !== 'string' || !mensaje.trim() || pendiente) return;
 pendiente = mensaje;
 queueMicrotask(() => {
  const texto = pendiente;
  pendiente = '';
  window.dispatchEvent(new CustomEvent('tuvoto:operacion-confirmada', { detail: texto }));
 });
}
