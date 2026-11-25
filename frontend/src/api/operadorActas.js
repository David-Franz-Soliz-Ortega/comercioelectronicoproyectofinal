// Reglas de presentación del operador. No deciden permisos ni conteos:
// Actas y Elecciones validan cada lectura y cada registro.

export const LIMITE_FOTO = 10000000;
export const TIPOS_FOTO = ['image/jpeg', 'image/png'];

export function fotoAdmitida(archivo) {
  if (!archivo) return 'Elige una fotografía.';
  if (!TIPOS_FOTO.includes(archivo.type)) return 'Usa una fotografía JPEG o PNG.';
  if (archivo.size > LIMITE_FOTO) return 'La fotografía supera 10 MB. Toma otra con menor resolución.';
  return '';
}

export const recepcionAbierta = mesa => mesa?.estado === 'recepcion';

// Última versión conocida de cada mesa a partir de las versiones del operador.
export function ultimasVersiones(actas) {
  const ultimas = new Map();
  for (const acta of actas) {
    const id = acta.idMesa ?? acta.id_mesa;
    if (!ultimas.has(id) || ultimas.get(id).version < acta.version) ultimas.set(id, { version: acta.version, estado: acta.estado });
  }
  return ultimas;
}

export function estadoMesa(mesa, ultimas) {
  const ultima = ultimas.get(mesa.id);
  if (ultima?.estado === 'publicada') return { clave: 'registrada', texto: `Registrada · v${ultima.version}`, version: ultima.version };
  if (ultima?.estado === 'observada') return { clave: 'observada', texto: `Observada · v${ultima.version}`, version: ultima.version };
  if (ultima?.estado === 'anulada') return { clave: 'pendiente', texto: 'Anulada · registrar de nuevo', version: ultima.version };
  if (!recepcionAbierta(mesa)) return { clave: 'cerrada', texto: 'Recepción cerrada', version: 0 };
  return { clave: 'pendiente', texto: 'Pendiente', version: 0 };
}

export function avance(mesas, ultimas) {
  const abiertas = mesas.filter(recepcionAbierta);
  const registradas = abiertas.filter(m => ['registrada', 'observada'].includes(estadoMesa(m, ultimas).clave)).length;
  return { registradas, total: abiertas.length, pendientes: abiertas.length - registradas };
}

// Destinos para elegir a mano: primero los empatados por la lectura; si no hubo, las mesas abiertas.
export function opcionesDestino(mesas, opciones = []) {
  const abiertas = mesas.filter(recepcionAbierta);
  if (!opciones.length) return abiertas;
  const elegidas = opciones.map(id => abiertas.find(m => m.id === id)).filter(Boolean);
  return elegidas.length ? elegidas : abiertas;
}

export function camposDePropuesta(candidatos, propuesta) {
  const votos = Object.fromEntries(candidatos.map(c => [c.id, propuesta?.votos?.find(v => v.idCandidato === c.id)?.cantidad ?? '']));
  const valores = { votos, blancos: propuesta?.blancos ?? '', nulos: propuesta?.nulos ?? '', total: propuesta?.total ?? '' };
  const leidos = new Set([...Object.entries(votos).filter(([, v]) => v !== '').map(([k]) => k), ...['blancos', 'nulos', 'total'].filter(k => valores[k] !== '')]);
  return { ...valores, leidos };
}

const valido = v => v !== '' && v !== null && Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 1000000;

export function revisarConteo({ votos, blancos, nulos, total }) {
  const campos = [...Object.values(votos), blancos, nulos, total];
  const completos = Object.keys(votos).length > 0 && campos.every(valido);
  const faltan = campos.filter(v => !valido(v)).length;
  const suma = Object.values(votos).reduce((a, b) => a + (valido(b) ? Number(b) : 0), 0) + (valido(blancos) ? Number(blancos) : 0) + (valido(nulos) ? Number(nulos) : 0);
  return { completos, faltan, suma, coincide: completos && suma === Number(total) };
}

export function datosRegistro({ idMesa, idSolicitud, versionAnterior, foto, votos, blancos, nulos, total }) {
  return {
    idMesa, idSolicitud, versionAnterior, foto,
    votos: Object.entries(votos).map(([idCandidato, cantidad]) => ({ idCandidato, cantidad: Number(cantidad) })),
    blancos: Number(blancos), nulos: Number(nulos), total: Number(total), confirmado: true,
  };
}
