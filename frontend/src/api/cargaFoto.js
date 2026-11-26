import { crearIdentificador } from './identificadores.js';
import { solicitarRest } from './clienteRest.js';

const TAMANO_PARTE = 131072;

export function prepararCargaFoto(foto) {
  return { foto, id: crearIdentificador(), siguiente: 0, iniciada: Date.now() };
}

// Una parte confirmada se conserva al reintentar desde la misma pantalla.
export async function transmitirFoto(carga, senal, progreso, pedir = solicitarRest) {
  const { foto } = carga;
  if (foto.length <= TAMANO_PARTE) return { foto };
  if (Date.now() - carga.iniciada > 45 * 60 * 1000) {
    Object.assign(carga, prepararCargaFoto(foto));
  }
  const partes = Math.ceil(foto.length / TAMANO_PARTE);
  progreso(carga.siguiente, partes);
  while (carga.siguiente < partes) {
    const indice = carga.siguiente;
    const contenido = foto.slice(indice * TAMANO_PARTE, (indice + 1) * TAMANO_PARTE);
    for (let intento = 0; ; intento++) {
      senal?.throwIfAborted();
      try {
        await pedir('/actas/cargas/' + carga.id, { metodo: 'PUT', datos: { indice, longitud: foto.length, contenido },
          senal, espera: 60000, mostrarDetalleValidacion: true });
        break;
      } catch (e) {
        if (senal?.aborted || intento >= 2 || (e.estado && ![400, 408, 502, 503, 504].includes(e.estado))) throw e;
        await new Promise(resolver => setTimeout(resolver, 500 * (intento + 1)));
      }
    }
    carga.siguiente++;
    progreso(carga.siguiente, partes);
  }
  return { idCargaFoto: carga.id };
}
