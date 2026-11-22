const texto = valor => typeof valor === 'string' && valor.trim().length > 0;
const entero = valor => Number.isSafeInteger(valor) && valor >= 0;
const porcentaje = valor => Number.isFinite(valor) && valor >= 0 && valor <= 100;
const unicos = lista => new Set(lista.map(v => v.id)).size === lista.length;
const incompleta = () => new Error('La respuesta de resultados está incompleta. Vuelve a actualizar en unos momentos.');

// Fallar de forma visible evita presentar NaN, líderes falsos o porcentajes sin fuente.
export function comprobarPortal(portal) {
  if (portal === null) return null;
  const p = portal?.proceso, r = portal?.resultados;
  if (!p || !texto(p.id) || !texto(p.nombre) || !texto(p.cargo) || !texto(p.unidad) || !Array.isArray(p.unidades) || !p.unidades.every(texto)
      || !r || !Array.isArray(r.candidatos) || !Array.isArray(r.unidades)
      || ['contabilizadas', 'esperadas', 'pendientes', 'observadas', 'total', 'validos', 'blancos', 'nulos'].some(k => !entero(r[k]))
      || !porcentaje(r.avance) || r.contabilizadas > r.esperadas || r.pendientes + r.contabilizadas !== r.esperadas
      || Math.abs(r.avance - (r.esperadas ? r.contabilizadas / r.esperadas * 100 : 0)) > 0.011
      || r.observadas > r.pendientes || r.validos + r.blancos + r.nulos !== r.total
      || !r.candidatos.every(c => texto(c.id) && texto(c.nombre) && entero(c.votos) && porcentaje(c.porcentaje) && (c.foto == null || typeof c.foto === 'string'))
      || !unicos(r.candidatos) || r.candidatos.reduce((suma, c) => suma + c.votos, 0) !== r.validos
      || !r.candidatos.every(c => Math.abs(c.porcentaje - (r.validos ? c.votos / r.validos * 100 : 0)) <= 0.011)
      || !r.unidades.every(u => texto(u.unidad) && entero(u.esperadas) && entero(u.contabilizadas) && entero(u.pendientes) && u.contabilizadas + u.pendientes === u.esperadas)
      || (r.actualizadoEn != null && (typeof r.actualizadoEn !== 'string' || !Number.isFinite(Date.parse(r.actualizadoEn))))) throw incompleta();
  return portal;
}

export function comprobarEventos(eventos) {
  const cargoValido = p => texto(p.id) && texto(p.nombre) && texto(p.cargo)
    && (p.destacadoPortada == null || typeof p.destacadoPortada === 'boolean')
    && (!p.destacadoPortada || (Array.isArray(p.candidatos) && unicos(p.candidatos)
      && p.candidatos.every(c => texto(c.id) && texto(c.nombre) && (c.foto == null || typeof c.foto === 'string'))));
  if (!Array.isArray(eventos) || !unicos(eventos) || !eventos.every(e => texto(e.id) && texto(e.nombre) && typeof e.destacado === 'boolean'
    && Array.isArray(e.procesos) && e.procesos.length > 0 && unicos(e.procesos) && e.procesos.every(cargoValido))) throw incompleta();
  return eventos;
}
