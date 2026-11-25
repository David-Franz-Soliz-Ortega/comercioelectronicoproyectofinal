// Ventanas deslizantes en memoria. Las direcciones se reemplazan por un resumen
// con sal aleatoria por arranque: solo se publica cuántos dispositivos hay.
import { createHash, randomBytes } from 'node:crypto';

const VENTANA_MS = 60_000;
const DISPOSITIVO_MS = 180_000;
const LIMITE = 20_000;

export function percentil(valores, p) {
  if (!valores.length) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1)];
}

export function crearEstadisticas({ ahora = Date.now } = {}) {
  const sal = randomBytes(16);
  const solicitudes = [];
  const dispositivos = new Map();
  let actas = 0;

  function purgar(t) {
    while (solicitudes.length && (t - solicitudes[0].t > VENTANA_MS || solicitudes.length > LIMITE)) solicitudes.shift();
    for (const [clave, visto] of dispositivos) if (t - visto > DISPOSITIVO_MS) dispositivos.delete(clave);
  }

  return {
    registrar({ servicio, ms, cliente, prueba, estatico }) {
      const t = ahora();
      solicitudes.push({ t, servicio, ms: estatico ? null : ms });
      if (cliente && !prueba) dispositivos.set(createHash('sha256').update(sal).update(cliente).digest('base64url').slice(0, 16), t);
      purgar(t);
    },
    contarActa() { actas += 1; },
    resumen() {
      const t = ahora();
      purgar(t);
      const porServicio = {};
      for (const s of solicitudes) porServicio[s.servicio] = (porServicio[s.servicio] ?? 0) + 1;
      const tiempos = solicitudes.filter(s => s.ms !== null && s.servicio !== 'frontend').map(s => s.ms);
      return {
        actasSesion: actas,
        dispositivos: dispositivos.size,
        solicitudesMinuto: solicitudes.length,
        p95Ms: percentil(tiempos, 95),
        porServicio,
      };
    },
  };
}
