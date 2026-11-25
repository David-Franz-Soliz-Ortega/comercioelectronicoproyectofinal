// Interpreta acta.actualizada.v1 (compartido/contratos/eventos). El evento ya
// excluye fotografía y operador; aquí tampoco se agregan identificadores.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function conteoValido(conteo) {
  return conteo === null || (conteo && Array.isArray(conteo.votos) && Number.isInteger(conteo.total)
    && Number.isInteger(conteo.blancos) && Number.isInteger(conteo.nulos)
    && conteo.votos.every(v => typeof v.idCandidato === 'string' && Number.isInteger(v.cantidad)));
}

export function eventoValido(evento) {
  const d = evento?.datos;
  return evento?.tipo === 'acta.actualizada.v1' && d && UUID.test(d.idProceso ?? '') && UUID.test(d.idMesa ?? '')
    && Number.isInteger(d.versionActa) && d.versionActa >= 1 && typeof d.observada === 'boolean' && conteoValido(d.conteo);
}

export function tipoDeActa(datos, conteoAnterior) {
  if (datos.observada) return 'observada';
  if (datos.conteo === null) return 'anulacion';
  if (datos.versionActa > 1 || conteoAnterior) return 'correccion';
  return 'nueva';
}

export function cambiosDeConteo(anterior, actual, nombres = {}) {
  if (!anterior || !actual) return [];
  const previos = new Map(anterior.votos.map(v => [v.idCandidato, v.cantidad]));
  const cambios = actual.votos
    .filter(v => previos.get(v.idCandidato) !== v.cantidad)
    .map(v => ({ nombre: nombres[v.idCandidato] ?? 'Candidatura', antes: previos.get(v.idCandidato) ?? 0, despues: v.cantidad }));
  for (const clave of ['blancos', 'nulos']) {
    if (anterior[clave] !== actual[clave]) cambios.push({ nombre: clave === 'blancos' ? 'Blancos' : 'Nulos', antes: anterior[clave], despues: actual[clave] });
  }
  return cambios;
}

// Recuerda el último aporte de cada mesa vista en esta sesión para explicar
// que una corrección reemplaza a la versión anterior en lugar de sumarse.
export function crearMemoriaActas({ limite = 5000 } = {}) {
  const ultimos = new Map();
  return {
    procesar(evento, proceso = null) {
      if (!eventoValido(evento)) return null;
      const d = evento.datos;
      const previo = ultimos.get(d.idMesa) ?? null;
      if (previo && previo.version >= d.versionActa) return null;
      const tipo = tipoDeActa(d, previo?.conteo);
      const nombres = Object.fromEntries((proceso?.candidatos ?? []).map(c => [c.id, c.nombre]));
      const mesa = proceso?.mesas?.find(m => m.id === d.idMesa);
      ultimos.delete(d.idMesa);
      ultimos.set(d.idMesa, { version: d.versionActa, conteo: d.conteo });
      if (ultimos.size > limite) ultimos.delete(ultimos.keys().next().value);
      return {
        idEvento: String(evento.idEvento ?? ''),
        idProceso: d.idProceso,
        cargo: proceso?.cargo ?? null,
        proceso: proceso?.nombre ?? null,
        mesa: mesa?.codigo ?? null,
        unidad: typeof d.unidad === 'string' ? d.unidad : null,
        sector: typeof d.sector === 'string' ? d.sector : null,
        version: d.versionActa,
        tipo,
        total: d.conteo?.total ?? null,
        versionAnteriorVista: previo?.version ?? null,
        cambios: tipo === 'correccion' ? cambiosDeConteo(previo?.conteo, d.conteo, nombres) : [],
      };
    },
  };
}
