import DataLoader from 'dataloader';
import { GraphQLError, defaultFieldResolver } from 'graphql';

export const servicios = {
  elecciones: process.env.ELECCIONES_URL ?? 'http://elecciones:3000',
  candidaturas: process.env.CANDIDATURAS_URL ?? 'http://candidaturas:8000',
  padron: process.env.PADRON_URL ?? 'http://padron-electoral:3000',
};

function error(codigo, mensaje, extensiones = {}) {
  return new GraphQLError(mensaje, { extensions: { code: codigo, ...extensiones } });
}
export function validarId(id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw error('ENTRADA_INVALIDA', 'El identificador debe ser UUID');
  }
  return id.toLowerCase();
}
function paginacion({ pagina = 1, limite = 20 }) {
  if (!Number.isInteger(pagina) || pagina < 1 || !Number.isInteger(limite) || limite < 1 || limite > 100) {
    throw error('ENTRADA_INVALIDA', 'pagina debe ser positiva y limite debe estar entre 1 y 100');
  }
  return { pagina, limite };
}

export function crearContexto({ idCorrelacion, transporte = fetch, registrar = console.log,
  destinos = servicios, cabeceras = {}, maximoPaginas = Number(process.env.MAXIMO_PAGINAS_LOTE ?? 20),
  senal = AbortSignal.timeout(15000) } = {}) {
  const peticiones = new Map();
  const colecciones = new Map();
  const contadores = { elecciones: 0, candidaturas: 0, padron: 0 };
  const contexto = { idCorrelacion, contadores };
  async function solicitar(servicio, recurso, argumentos = {}, cuerpo) {
    const parametros = new URLSearchParams(Object.entries(argumentos).filter(([, valor]) => valor != null));
    const ruta = `/api/v1/${recurso}${parametros.size ? '?' + parametros : ''}`;
    const metodo = cuerpo === undefined ? 'GET' : 'POST';
    const clave = servicio + ruta;
    if (metodo === 'GET' && peticiones.has(clave)) return peticiones.get(clave);
    const promesa = (async () => {
      contadores[servicio]++;
      let respuesta;
      try {
        respuesta = await transporte(destinos[servicio] + ruta, {
          method: metodo,
          headers: { ...cabeceras, 'Content-Type': 'application/json', 'X-Correlation-ID': idCorrelacion },
          body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
          signal: AbortSignal.any([senal, AbortSignal.timeout(3000)]),
        });
        registrar(JSON.stringify({ evento: 'llamada_rest', idCorrelacion, servicio, metodo,
          recurso, estado: respuesta.status }));
      } catch {
        throw error('SERVICIO_NO_DISPONIBLE', 'No se pudo contactar con el servicio', { servicio, idCorrelacion });
      }
      if (respuesta.status === 404) return null;
      if (!respuesta.ok) {
        const codigo = respuesta.status === 401 ? 'NO_AUTENTICADO' : respuesta.status === 403 ? 'NO_AUTORIZADO' : respuesta.status === 409 ? 'CONFLICTO' :
          [400, 422].includes(respuesta.status) ? 'ENTRADA_INVALIDA' : 'SERVICIO_NO_DISPONIBLE';
        // No se expone el cuerpo de error interno ni direcciones de infraestructura.
        throw error(codigo, 'El servicio no pudo completar la solicitud', { servicio, estado: respuesta.status, idCorrelacion });
      }
      try { return await respuesta.json(); }
      catch { throw error('RESPUESTA_INVALIDA', 'Respuesta REST inválida', { servicio, idCorrelacion }); }
    })();
    if (metodo === 'GET') peticiones.set(clave, promesa);
    return promesa;
  }
  function comprobarPagina(datos) {
    if (!datos || !Array.isArray(datos.elementos) || !Number.isInteger(datos.total) || datos.total < 0) {
      throw error('RESPUESTA_INVALIDA', 'El servicio devolvió una página inválida');
    }
    return datos;
  }
  function listarTodo(servicio, recurso, necesarios) {
    const clave = servicio + recurso;
    // Solo las colecciones completas pueden compartirse entre diferentes lotes.
    if (!necesarios && colecciones.has(clave)) return colecciones.get(clave);
    const promesa = (async () => {
      const elementos = [];
      for (let pagina = 1; pagina <= maximoPaginas; pagina++) {
        const datos = comprobarPagina(await solicitar(servicio, recurso, { pagina, limite: 100 }));
        elementos.push(...datos.elementos);
        if (necesarios && necesarios.every(id => elementos.some(fila => fila.idEleccion === id))) return elementos;
        if (pagina * 100 >= datos.total) return elementos;
        if (datos.elementos.length === 0) throw error('RESPUESTA_INVALIDA', 'Paginación REST inconsistente');
      }
      throw error('LIMITE_DE_CARGA', 'El lote supera el límite de páginas; reduzca el alcance de la consulta');
    })();
    if (!necesarios) colecciones.set(clave, promesa);
    return promesa;
  }
  const elecciones = new DataLoader(async ids => {
    if (ids.length === 1) return [await solicitar('elecciones', `elecciones/${ids[0]}`)];
    const filas = await listarTodo('elecciones', 'elecciones', ids);
    const porId = new Map(filas.map(fila => [fila.idEleccion, fila]));
    return ids.map(id => porId.get(id) ?? null);
  }, { maxBatchSize: 100 });
  function relaciones(servicio, recurso) {
    return new DataLoader(async claves => {
      if (claves.length === 1) {
        return [comprobarPagina(await solicitar(servicio, recurso, claves[0]))];
      }
      const filas = await listarTodo(servicio, recurso);
      return claves.map(({ idEleccion, pagina, limite }) => {
        const coincidentes = filas.filter(fila => fila.idEleccion === idEleccion);
        return { elementos: coincidentes.slice((pagina - 1) * limite, pagina * limite), pagina, limite, total: coincidentes.length };
      });
    }, { cacheKeyFn: clave => JSON.stringify(clave), maxBatchSize: 100 });
  }
  const candidaturas = relaciones('candidaturas', 'candidaturas');
  const inscripciones = relaciones('padron', 'inscripciones');
  contexto.cargadores = { elecciones, candidaturas, inscripciones };
  contexto.listar = async (servicio, recurso, argumentos) => {
    const parametros = { ...argumentos, ...paginacion(argumentos) };
    if (parametros.idEleccion != null) parametros.idEleccion = validarId(parametros.idEleccion);
    const datos = comprobarPagina(await solicitar(servicio, recurso, parametros));
    if (servicio === 'elecciones') for (const fila of datos.elementos) elecciones.prime(fila.idEleccion, fila);
    return datos;
  };
  contexto.relacion = (recurso, idEleccion, argumentos) => contexto.cargadores[recurso].load({
    idEleccion: validarId(idEleccion), ...paginacion(argumentos),
  });
  contexto.crear = async (servicio, recurso, entrada) => {
    const cuerpo = { ...entrada };
    if (cuerpo.idEleccion != null) cuerpo.idEleccion = validarId(cuerpo.idEleccion);
    const creado = await solicitar(servicio, recurso, {}, cuerpo);
    // Las siguientes mutaciones de la misma operación deben ver las escrituras previas.
    peticiones.clear(); colecciones.clear();
    for (const cargador of Object.values(contexto.cargadores)) cargador.clearAll();
    if (servicio === 'elecciones') elecciones.prime(creado.idEleccion, creado);
    return creado;
  };
  return contexto;
}

const resolutores = {
  Query: {
    elecciones: (_, argumentos, contexto) => contexto.listar('elecciones', 'elecciones', argumentos),
    eleccion: (_, { idEleccion }, contexto) => contexto.cargadores.elecciones.load(validarId(idEleccion)),
    eleccionesPorIds: (_, { ids }, contexto) => {
      if (ids.length > 100) throw error('ENTRADA_INVALIDA', 'Se admiten como máximo 100 identificadores');
      return contexto.cargadores.elecciones.loadMany(ids.map(validarId));
    },
    candidaturas: (_, argumentos, contexto) => contexto.listar('candidaturas', 'candidaturas', argumentos),
    inscripciones: (_, argumentos, contexto) => contexto.listar('padron', 'inscripciones', argumentos),
  },
  Mutation: {
    crearEleccion: (_, { entrada }, contexto) => contexto.crear('elecciones', 'elecciones', entrada),
    crearCandidatura: (_, { entrada }, contexto) => contexto.crear('candidaturas', 'candidaturas', entrada),
    crearInscripcion: (_, { entrada }, contexto) => contexto.crear('padron', 'inscripciones', entrada),
  },
  Eleccion: {
    candidaturas: (fuente, argumentos, contexto) => contexto.relacion('candidaturas', fuente.idEleccion, argumentos),
    inscripciones: (fuente, argumentos, contexto) => contexto.relacion('inscripciones', fuente.idEleccion, argumentos),
  },
  Candidatura: { eleccion: (fuente, _, contexto) => contexto.cargadores.elecciones.load(validarId(fuente.idEleccion)) },
  Inscripcion: { eleccion: (fuente, _, contexto) => contexto.cargadores.elecciones.load(validarId(fuente.idEleccion)) },
};
export function resolverCampo(fuente, argumentos, contexto, informacion) {
  return (resolutores[informacion.parentType.name]?.[informacion.fieldName] ?? defaultFieldResolver)(fuente, argumentos, contexto, informacion);
}
