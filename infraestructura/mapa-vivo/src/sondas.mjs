// Salud observada, nunca supuesta: HTTP para servicios y conexión TCP para
// bases y broker (sin credenciales). Sin respuesta, el estado es "caido".
import net from 'node:net';
import dns from 'node:dns/promises';

export const SONDAS_HTTP = {
  identidad: 'http://identidad:3000/api/v1/salud',
  elecciones: 'http://elecciones:3000/api/v1/salud',
  actas: 'http://actas:8000/api/v1/salud',
  resultados: 'http://resultados:8000/api/v1/salud',
  gateway: 'http://gateway-graphql:4000/salud',
  frontend: 'http://frontend:3000/salud',
};

export const SONDAS_TCP = {
  postgres: ['base-postgres', 5432],
  mongodb: ['base-mongodb', 27017],
  redis: ['cache-redis', 6379],
  rabbitmq: ['mensajeria-rabbitmq', 5672],
};

// En la red interna, getaddrinfo tarda 5-10 s en fallar con el nombre de un
// contenedor detenido y no se puede cancelar. El resolvedor asíncrono (c-ares)
// consulta el DNS de Docker sin hilos y falla al instante; además se comparte
// una sola búsqueda en curso por host.
const resolvedor = new dns.Resolver({ timeout: 800, tries: 1 });
const busquedas = new Map();

export function direccion(host, { timeout = 1000, buscar = h => resolvedor.resolve4(h).then(a => ({ address: a[0] })) } = {}) {
  if (net.isIP(host)) return Promise.resolve(host);
  if (host === 'localhost') return Promise.resolve('127.0.0.1');
  if (!busquedas.has(host)) busquedas.set(host, buscar(host).then(r => r.address).finally(() => busquedas.delete(host)));
  return Promise.race([busquedas.get(host), new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('DNS sin respuesta')), timeout).unref())]);
}

export async function sondearHttp(url, { timeout = 1500, cabeceras = {} } = {}) {
  try {
    const destino = new URL(url);
    destino.hostname = await direccion(destino.hostname);
    const respuesta = await fetch(destino, { headers: cabeceras, signal: AbortSignal.timeout(timeout) });
    await respuesta.arrayBuffer().catch(() => {});
    // 503 de Resultados indica consumidores detenidos: la API responde, degradada.
    return respuesta.ok ? 'ok' : 'degradado';
  } catch {
    return 'caido';
  }
}

export async function sondearTcp(host, puerto, { timeout = 1200 } = {}) {
  let ip;
  try { ip = await direccion(host); } catch { return 'caido'; }
  return new Promise(resolver => {
    const socket = net.connect({ host: ip, port: puerto });
    const terminar = estado => { socket.destroy(); resolver(estado); };
    socket.setTimeout(timeout, () => terminar('caido'));
    socket.once('connect', () => terminar('ok'));
    socket.once('error', () => terminar('caido'));
  });
}

export function iniciarSondas({ http = SONDAS_HTTP, tcp = SONDAS_TCP, entrada, intervalo = 2000 }) {
  const estado = {};
  let activo = true;
  async function ronda() {
    const tareas = [
      ...Object.entries(http).map(async ([nodo, url]) => { estado[nodo] = await sondearHttp(url); }),
      ...Object.entries(tcp).map(async ([nodo, [host, puerto]]) => { estado[nodo] = await sondearTcp(host, puerto); }),
    ];
    // La sonda de entrada viaja por NGINX y además comprueba que llegue su registro.
    if (entrada) tareas.push((async () => { estado.entrada = await sondearHttp(entrada, { cabeceras: { 'X-Mapa-Vivo-Prueba': 'sonda' } }); })());
    await Promise.all(tareas);
  }
  (async () => { while (activo) { await ronda(); await new Promise(r => setTimeout(r, intervalo)); } })();
  return { estado: () => estado, detener() { activo = false; } };
}
