// UUID para reintentos de actas; no es una credencial de sesión.
// getRandomValues también está disponible en HTTP de la red local.
export function crearIdentificador(fuente = globalThis.crypto) {
  if (typeof fuente?.randomUUID === 'function') return fuente.randomUUID();
  if (typeof fuente?.getRandomValues !== 'function') throw new Error('El navegador no permite generar un identificador seguro.');
  const bytes = fuente.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const texto = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${texto.slice(0, 8)}-${texto.slice(8, 12)}-${texto.slice(12, 16)}-${texto.slice(16, 20)}-${texto.slice(20)}`;
}
