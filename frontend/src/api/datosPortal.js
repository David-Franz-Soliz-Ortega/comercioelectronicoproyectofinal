// Una respuesta parcial de GraphQL debe producir un error visible, no una pantalla rota.
export function comprobarPortal(portal) {
  if (portal === null) return null;
  const p = portal?.proceso, r = portal?.resultados;
  const numeros = ['contabilizadas', 'esperadas', 'pendientes', 'observadas', 'total', 'avance', 'blancos', 'nulos'];
  if (!p || typeof p.nombre !== 'string' || typeof p.unidad !== 'string' || !Array.isArray(p.unidades)
      || !r || !Array.isArray(r.candidatos) || !Array.isArray(r.unidades)
      || numeros.some(k => !Number.isFinite(r[k]) || r[k] < 0)) {
    throw new Error('La respuesta de resultados está incompleta. Vuelve a actualizar en unos momentos.');
  }
  return portal;
}
