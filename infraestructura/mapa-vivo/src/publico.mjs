// Lee solo endpoints públicos de sus dueños: Elecciones (configuración
// publicada) y Resultados (cómputo preliminar). Sin datos, devuelve null.

export async function pedirJson(url, { timeout = 2500, cabeceras = {} } = {}) {
  const respuesta = await fetch(url, { headers: { Accept: 'application/json', ...cabeceras }, signal: AbortSignal.timeout(timeout) });
  if (!respuesta.ok) {
    const error = new Error('HTTP ' + respuesta.status);
    error.estado = respuesta.status;
    throw error;
  }
  return respuesta.json();
}

export function resumirResultados(proceso, resultado) {
  if (!resultado) return null;
  return {
    idProceso: proceso?.id ?? null,
    cargo: proceso?.cargo ?? null,
    nombre: proceso?.nombre ?? null,
    esperadas: resultado.esperadas,
    contabilizadas: resultado.contabilizadas,
    observadas: resultado.observadas,
    avance: resultado.avance,
    validos: resultado.validos,
    blancos: resultado.blancos,
    nulos: resultado.nulos,
    total: resultado.total,
    ponderacionAplicada: Boolean(resultado.ponderacionAplicada),
    candidatos: (resultado.candidatos ?? []).slice(0, 8).map(c => ({ id: c.id, nombre: c.nombre, votos: c.votos, porcentaje: c.porcentaje })),
    actualizadoEn: resultado.actualizadoEn ?? null,
  };
}

export function crearCatalogo({ eleccionesUrl, resultadosUrl, pedir = pedirJson, ahora = Date.now }) {
  const procesos = new Map();

  async function proceso(id) {
    const guardado = procesos.get(id);
    if (guardado && ahora() - guardado.t < (guardado.valor ? 30_000 : 10_000)) return guardado.valor;
    let valor = null;
    try { valor = await pedir(`${eleccionesUrl}/api/v1/publico/procesos/${encodeURIComponent(id)}`); } catch { valor = null; }
    procesos.set(id, { t: ahora(), valor });
    if (procesos.size > 200) procesos.delete(procesos.keys().next().value);
    return valor;
  }

  return {
    proceso,
    async actual() {
      try {
        const valor = await pedir(`${eleccionesUrl}/api/v1/publico/actual`);
        if (valor?.id) procesos.set(valor.id, { t: ahora(), valor });
        return valor;
      } catch { return null; }
    },
    async resultados(id) {
      const datos = await proceso(id);
      if (!datos) return null;
      try {
        return resumirResultados(datos, await pedir(`${resultadosUrl}/api/v1/publico/resultados/${encodeURIComponent(id)}`));
      } catch { return null; }
    },
  };
}
