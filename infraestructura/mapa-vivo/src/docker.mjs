// Plataforma Docker Compose (opcional, ver docker-compose.mapa-vivo-caos.yml).
// Solo actúa sobre servicios permitidos del proyecto indicado; el cliente
// nunca envía identificadores de contenedor ni comandos.
import http from 'node:http';

export const NODO_DE_SERVICIO = {
  'entrada-nginx': 'entrada',
  frontend: 'frontend',
  identidad: 'identidad',
  elecciones: 'elecciones',
  actas: 'actas',
  resultados: 'resultados',
  'resultados-conteo': 'conteo',
  'resultados-auditoria': 'auditoria',
  'gateway-graphql': 'gateway',
  'base-postgres': 'postgres',
  'base-mongodb': 'mongodb',
  'cache-redis': 'redis',
  'mensajeria-rabbitmq': 'rabbitmq',
};

// Procesos Python con manejador de SIGINT: al interrumpirlos terminan y la
// política restart: unless-stopped los vuelve a iniciar, como una caída real.
export const PERMITIDOS = ['actas', 'resultados', 'resultados-conteo', 'resultados-auditoria'];
export const ACCIONES = ['derribar', 'apagar', 'encender'];
const INTERRUPCION = ['python', '-c', 'import os,signal; os.kill(1, signal.SIGINT)'];

export function peticionUnix(socketPath) {
  return (metodo, ruta, cuerpo) => new Promise((resolver, rechazar) => {
    const datos = cuerpo === undefined ? null : Buffer.from(JSON.stringify(cuerpo));
    const solicitud = http.request({ socketPath, path: ruta, method: metodo, timeout: 5000,
      headers: datos ? { 'Content-Type': 'application/json', 'Content-Length': datos.length } : {} }, respuesta => {
      const partes = [];
      respuesta.on('data', p => partes.push(p));
      respuesta.on('end', () => {
        const texto = Buffer.concat(partes).toString('utf8');
        if (respuesta.statusCode >= 400) return rechazar(Object.assign(new Error('Docker ' + respuesta.statusCode), { estado: respuesta.statusCode }));
        try { resolver(texto ? JSON.parse(texto) : null); } catch { resolver(null); }
      });
    });
    solicitud.on('timeout', () => solicitud.destroy(new Error('Docker sin respuesta')));
    solicitud.on('error', rechazar);
    if (datos) solicitud.write(datos);
    solicitud.end();
  });
}

export function crearDocker({ proyecto = 'tuvoto', peticion }) {
  const filtro = encodeURIComponent(JSON.stringify({ label: [`com.docker.compose.project=${proyecto}`] }));

  async function contenedores() {
    const lista = await peticion('GET', `/containers/json?all=1&filters=${filtro}`);
    return (lista ?? []).filter(c => c.Labels?.['com.docker.compose.project'] === proyecto);
  }

  async function listar() {
    const resultado = {};
    for (const c of await contenedores()) {
      const servicio = c.Labels['com.docker.compose.service'];
      const nodo = NODO_DE_SERVICIO[servicio];
      if (!nodo) continue;
      let detalle = null;
      try { detalle = await peticion('GET', `/containers/${encodeURIComponent(c.Id)}/json`); } catch { detalle = null; }
      resultado[nodo] = {
        servicio,
        estado: detalle?.State?.Status ?? c.State,
        salud: detalle?.State?.Health?.Status ?? null,
        reinicios: detalle?.RestartCount ?? 0,
        iniciado: detalle?.State?.StartedAt ?? null,
        controlable: PERMITIDOS.includes(servicio),
      };
    }
    return resultado;
  }

  async function accion(servicio, nombre) {
    if (!PERMITIDOS.includes(servicio) || !ACCIONES.includes(nombre)) throw Object.assign(new Error('Acción no permitida'), { estado: 403 });
    const elegido = (await contenedores()).find(c => c.Labels['com.docker.compose.service'] === servicio);
    if (!elegido) throw Object.assign(new Error('Servicio no encontrado'), { estado: 404 });
    const id = encodeURIComponent(elegido.Id);
    if (nombre === 'apagar') return peticion('POST', `/containers/${id}/stop?t=3`);
    if (nombre === 'encender') return peticion('POST', `/containers/${id}/start`);
    if (elegido.State !== 'running') throw Object.assign(new Error('El servicio no está en ejecución'), { estado: 409 });
    const ejecucion = await peticion('POST', `/containers/${id}/exec`, { Cmd: INTERRUPCION, AttachStdout: false, AttachStderr: false });
    return peticion('POST', `/exec/${encodeURIComponent(ejecucion.Id)}/start`, { Detach: true, Tty: false });
  }

  return { listar, accion };
}
