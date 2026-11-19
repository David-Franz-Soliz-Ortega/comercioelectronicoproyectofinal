// Solo datos públicos publicados; nunca sesiones, asignaciones ni actas privadas.
export function crearCachePublica(ttl = 3000, reloj = Date.now) {
 let guardado, hasta = 0, pendiente;
 return async cargar => {
  if (reloj() < hasta) return guardado;
  if (pendiente) return pendiente;
  pendiente = Promise.resolve().then(cargar).then(valor => { guardado = valor; hasta = reloj() + ttl; return valor; }).finally(() => { pendiente = undefined; });
  return pendiente;
 };
}

export function crearCachePublicaPorClave(maximo = 64) {
 const caches = new Map();
 return (clave, cargar) => {
  if (!caches.has(clave)) { if (caches.size >= maximo) caches.delete(caches.keys().next().value); caches.set(clave, crearCachePublica()); }
  return caches.get(clave)(cargar);
 };
}
