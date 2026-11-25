// Mapa vivo de TUVOTO: combina señales reales (registro de NGINX, eventos de
// RabbitMQ, salud y, opcionalmente, Docker) y las difunde por SSE a la pantalla.
// No es dueño de datos ni de reglas: solo observa y, a pedido del presentador,
// genera tráfico o interrumpe servicios permitidos.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { describirSolicitud } from './rutas.mjs';
import { escucharEntrada } from './entrada.mjs';
import { crearEstadisticas } from './estadisticas.mjs';
import { crearMemoriaActas } from './actas.mjs';
import { crearCatalogo } from './publico.mjs';
import { iniciarMensajeria } from './mensajeria.mjs';
import { iniciarSondas } from './sondas.mjs';
import { crearDocker, peticionUnix, PERMITIDOS } from './docker.mjs';
import { crearPruebasVivas } from './pruebas-vivas.mjs';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUBLICO = path.resolve(RAIZ, '../publico');
const FUENTE = [path.join(PUBLICO, 'fuentes/manrope-variable.ttf'), path.resolve(RAIZ, '../../../frontend/src/recursos/fuentes/manrope-variable.ttf')].find(existsSync);

export const NODOS = ['operadores', 'publico', 'entrada', 'frontend', 'identidad', 'actas', 'elecciones', 'gateway', 'postgres', 'rabbitmq', 'resultados', 'conteo', 'auditoria', 'redis', 'mongodb'];
const ABAJO = new Set(['caido', 'reiniciando', 'iniciando']);
const ARRIBA = new Set(['ok', 'degradado']);
const CONSUMIDORES = { conteo: 'resultados.conteo.v1', auditoria: 'resultados.auditoria.v1' };
const ACCIONES_DOCKER = ['derribar', 'apagar', 'encender'];

export function hostPermitido(host, extra = []) {
  const nombre = String(host ?? '').toLowerCase().replace(/:\d+$/, '').replace(/^\[(.*)\]$/, '$1');
  return ['localhost', '127.0.0.1', '::1', 'mapa-vivo', ...extra].includes(nombre);
}

export function disponibilidad(nodo, salud, contenedor, colas) {
  if (contenedor && contenedor.estado !== 'running') return contenedor.estado === 'restarting' ? 'reiniciando' : 'caido';
  if (CONSUMIDORES[nodo]) {
    const cola = colas[CONSUMIDORES[nodo]];
    if (!cola) return 'sin-datos';
    if (cola.consumidores > 0) return 'ok';
    return contenedor ? 'iniciando' : 'caido';
  }
  const estado = salud[nodo];
  if (!estado) return 'sin-datos';
  if (estado === 'caido' && contenedor?.salud === 'starting') return 'iniciando';
  return estado;
}

// Detecta caídas y recuperaciones a partir de estados observados consecutivos.
export function crearVigilante({ ahora = Date.now } = {}) {
  const previos = {};
  const caidas = {};
  const esperas = {};
  return {
    revisar(estados, colas) {
      const avisos = [];
      for (const [nodo, estado] of Object.entries(estados)) {
        const previo = previos[nodo];
        previos[nodo] = estado;
        if (ARRIBA.has(previo) && ABAJO.has(estado)) {
          caidas[nodo] = ahora();
          if (CONSUMIDORES[nodo]) esperas[nodo] = { pico: colas[CONSUMIDORES[nodo]]?.mensajes ?? 0, errores: colas[CONSUMIDORES[nodo] + '.dlq']?.mensajes ?? 0, recuperado: false };
          avisos.push({ tipo: 'caida', nodo, cola: esperas[nodo]?.pico ?? null });
        } else if (ABAJO.has(previo) && ARRIBA.has(estado) && caidas[nodo]) {
          avisos.push({ tipo: 'recuperado', nodo, duracionMs: ahora() - caidas[nodo], cola: esperas[nodo]?.pico ?? null });
          delete caidas[nodo];
          if (esperas[nodo]) esperas[nodo].recuperado = true;
        }
      }
      for (const [nodo, espera] of Object.entries(esperas)) {
        const cola = colas[CONSUMIDORES[nodo]];
        if (!cola) continue;
        if (!espera.recuperado) { espera.pico = Math.max(espera.pico, cola.mensajes); continue; }
        if (cola.mensajes === 0) {
          const errores = Math.max(0, (colas[CONSUMIDORES[nodo] + '.dlq']?.mensajes ?? espera.errores) - espera.errores);
          if (espera.pico > 0) avisos.push({ tipo: 'cola-vacia', nodo, procesadas: espera.pico, errores });
          delete esperas[nodo];
        }
      }
      return avisos;
    },
  };
}

export function crearMapaVivo({ catalogo, pruebas = null, docker = null, mensajeria = null, sondas = null, urlOperador = '', hostsExtra = [], ahora = Date.now, intervaloEstado = 1000 }) {
  const clientes = new Set();
  const estadisticas = crearEstadisticas({ ahora });
  const memoria = crearMemoriaActas();
  const vigilante = crearVigilante({ ahora });
  const historial = [];
  let ultimaSonda = 0;
  let contenedores = null;
  let resultadosActuales = null;
  let idProcesoActual = null;
  let qr = null;

  function emitir(tipo, datos) {
    const texto = `event: ${tipo}\ndata: ${JSON.stringify(datos)}\n\n`;
    for (const cliente of clientes) cliente.write(texto);
  }

  function recordar(tipo, datos) {
    historial.push({ tipo, datos, t: ahora() });
    if (historial.length > 12) historial.shift();
    emitir(tipo, datos);
  }

  function ingresarSolicitud(linea) {
    if (linea.prueba === 'sonda') { ultimaSonda = ahora(); return; }
    const descripcion = describirSolicitud(linea);
    estadisticas.registrar({ servicio: descripcion.servicio, ms: linea.ms, cliente: linea.cliente, prueba: linea.prueba, estatico: descripcion.estatico });
    if (descripcion.estatico) return;
    emitir('solicitud', { ...descripcion, metodo: linea.metodo, estado: linea.estado, ms: linea.ms, prueba: linea.prueba || null, t: ahora() });
  }

  async function actualizarResultados(idProceso) {
    const resumen = await catalogo.resultados(idProceso);
    if (!resumen) return;
    const cambio = JSON.stringify(resumen) !== JSON.stringify(resultadosActuales);
    resultadosActuales = resumen;
    idProcesoActual = idProceso;
    if (cambio) emitir('resultados', resumen);
  }

  async function ingresarEvento(evento) {
    const idProceso = evento?.datos?.idProceso;
    const proceso = typeof idProceso === 'string' ? await catalogo.proceso(idProceso) : null;
    const acta = memoria.procesar(evento, proceso);
    if (!acta) return;
    estadisticas.contarActa();
    recordar('acta', acta);
    // El consumidor de conteo proyecta el evento y Redis guarda 3 s: se consulta dos veces.
    for (const espera of [1500, 4500]) setTimeout(() => { actualizarResultados(acta.idProceso).catch(() => {}); }, espera).unref?.();
  }

  function estadoActual() {
    const salud = sondas?.estado() ?? {};
    const mensajes = mensajeria?.estado() ?? { conectada: false, colas: {} };
    const colas = mensajes.colas ?? {};
    const kpis = estadisticas.resumen();
    const nodos = {};
    for (const nodo of NODOS) {
      if (nodo === 'operadores' || nodo === 'publico') continue;
      const contenedor = contenedores?.[nodo] ?? null;
      nodos[nodo] = { estado: disponibilidad(nodo, salud, contenedor, colas), contenedor, solicitudesMinuto: kpis.porServicio[nodo] ?? 0 };
    }
    const cola = nombre => colas[nombre] ? { mensajes: colas[nombre].mensajes, consumidores: colas[nombre].consumidores, errores: colas[nombre + '.dlq']?.mensajes ?? null } : null;
    return {
      nodos,
      colas: { conteo: cola(CONSUMIDORES.conteo), auditoria: cola(CONSUMIDORES.auditoria) },
      kpis: { actasSesion: kpis.actasSesion, dispositivos: kpis.dispositivos, solicitudesMinuto: kpis.solicitudesMinuto, p95Ms: kpis.p95Ms },
      mensajeria: Boolean(mensajes.conectada),
      registroEntrada: ahora() - ultimaSonda < 15_000,
      plataforma: docker ? 'docker' : null,
      controles: { docker: Boolean(docker), servicios: docker ? PERMITIDOS : [], pruebas: Boolean(pruebas) },
      qr: Boolean(qr),
    };
  }

  function tick() {
    const estado = estadoActual();
    const estados = Object.fromEntries(Object.entries(estado.nodos).map(([n, v]) => [n, v.estado]));
    const colas = mensajeria?.estado()?.colas ?? {};
    for (const aviso of vigilante.revisar(estados, colas)) recordar('aviso', aviso);
    emitir('estado', estado);
  }

  async function ejecutarAccion({ accion, servicio }) {
    if (ACCIONES_DOCKER.includes(accion)) {
      if (!docker) throw Object.assign(new Error('Control de contenedores no habilitado'), { estado: 503 });
      await docker.accion(servicio, accion);
      return { accion, servicio };
    }
    if (!pruebas) throw Object.assign(new Error('Pruebas en vivo no configuradas'), { estado: 503 });
    if (accion === 'ataque-sesion') return pruebas.ataqueSesion();
    if (accion === 'ataque-interno') return pruebas.ataqueInterno();
    if (accion === 'rafaga') return pruebas.rafaga({ idProceso: idProcesoActual });
    throw Object.assign(new Error('Acción desconocida'), { estado: 400 });
  }

  async function leerCuerpo(req) {
    const partes = [];
    let tamano = 0;
    for await (const parte of req) {
      tamano += parte.length;
      if (tamano > 2048) throw Object.assign(new Error('Cuerpo demasiado grande'), { estado: 413 });
      partes.push(parte);
    }
    return JSON.parse(Buffer.concat(partes).toString('utf8') || '{}');
  }

  const ESTATICOS = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/mapa.css': ['mapa.css', 'text/css; charset=utf-8'],
    '/mapa.js': ['mapa.js', 'text/javascript; charset=utf-8'],
    '/disposicion.js': ['disposicion.js', 'text/javascript; charset=utf-8'],
    '/cartel': ['cartel.html', 'text/html; charset=utf-8'],
    '/cartel.css': ['cartel.css', 'text/css; charset=utf-8'],
  };
  const SEGURIDAD = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'",
  };

  function json(res, estado, datos) {
    res.writeHead(estado, { ...SEGURIDAD, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(datos));
  }

  const servidor = http.createServer(async (req, res) => {
    const ruta = new URL(req.url, 'http://mapa-vivo').pathname;
    // Evita que otro sitio, por DNS rebinding, lea el flujo o use los controles.
    if (!hostPermitido(req.headers.host, hostsExtra)) return json(res, 421, { detalle: 'Host no permitido' });
    try {
      if (req.method === 'GET' && ruta === '/api/salud') return json(res, 200, { servicio: 'mapa-vivo', estado: 'saludable' });
      if (req.method === 'GET' && ruta === '/api/flujo') {
        if (clientes.size >= 30) return json(res, 503, { detalle: 'Demasiadas pantallas conectadas' });
        res.writeHead(200, { ...SEGURIDAD, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write('retry: 2000\n\n');
        res.write(`event: inicio\ndata: ${JSON.stringify({ estado: estadoActual(), historial, resultados: resultadosActuales })}\n\n`);
        clientes.add(res);
        req.on('close', () => clientes.delete(res));
        return;
      }
      if (req.method === 'POST' && ruta === '/api/presentador') {
        const origen = req.headers.origin;
        if (req.headers['x-mapa-vivo'] !== 'presentador' || !String(req.headers['content-type'] ?? '').startsWith('application/json')
          || (origen && new URL(origen).host !== req.headers.host)) return json(res, 403, { detalle: 'Solicitud del presentador inválida' });
        const datos = await leerCuerpo(req);
        const resultado = await ejecutarAccion({ accion: String(datos.accion ?? ''), servicio: String(datos.servicio ?? '') });
        emitir('presentador', resultado);
        return json(res, 202, resultado);
      }
      if (req.method === 'GET' && ruta === '/qr.svg' && qr) {
        res.writeHead(200, { ...SEGURIDAD, 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' });
        return res.end(qr);
      }
      if (req.method === 'GET' && ruta === '/fuentes/manrope-variable.ttf' && FUENTE) {
        res.writeHead(200, { ...SEGURIDAD, 'Content-Type': 'font/ttf', 'Cache-Control': 'public, max-age=86400' });
        return res.end(await readFile(FUENTE));
      }
      if (req.method === 'GET' && ESTATICOS[ruta]) {
        const [archivo, tipo] = ESTATICOS[ruta];
        res.writeHead(200, { ...SEGURIDAD, 'Content-Type': tipo, 'Cache-Control': 'no-cache' });
        return res.end(await readFile(path.join(PUBLICO, archivo)));
      }
      return json(res, 404, { detalle: 'No encontrado' });
    } catch (error) {
      return json(res, error.estado ?? (error instanceof SyntaxError ? 400 : 500), { detalle: error.estado ? error.message : 'No se pudo completar la acción' });
    }
  });

  let temporizadores = [];
  return {
    servidor,
    emitir,
    ingresarSolicitud,
    ingresarEvento,
    estadoActual,
    tick,
    async iniciar() {
      if (urlOperador) qr = await QRCode.toString(urlOperador, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b1220', light: '#ffffff' } });
      const actual = await catalogo.actual();
      if (actual?.id) await actualizarResultados(actual.id).catch(() => {});
      temporizadores.push(setInterval(tick, intervaloEstado));
      temporizadores.push(setInterval(() => { if (idProcesoActual) actualizarResultados(idProcesoActual).catch(() => {}); }, 15_000));
      temporizadores.push(setInterval(() => { for (const c of clientes) c.write(': latido\n\n'); }, 15_000));
      if (docker) {
        const refrescar = async () => { try { contenedores = await docker.listar(); } catch { contenedores = null; } };
        await refrescar();
        temporizadores.push(setInterval(refrescar, 1500));
      }
    },
    async detener() {
      for (const t of temporizadores) clearInterval(t);
      temporizadores = [];
      for (const c of clientes) c.end();
      clientes.clear();
      await new Promise(resolver => servidor.close(resolver));
    },
  };
}

async function principal() {
  const env = process.env;
  const puerto = Number(env.MAPA_VIVO_PUERTO ?? 8080);
  const entradaUrl = (env.MAPA_VIVO_ENTRADA_URL ?? 'http://entrada-nginx').replace(/\/$/, '');
  const origen = (env.MAPA_VIVO_ORIGEN ?? env.TUVOTO_ORIGEN ?? '').split(',')[0].trim();
  const catalogo = crearCatalogo({ eleccionesUrl: env.ELECCIONES_URL ?? 'http://elecciones:3000', resultadosUrl: env.RESULTADOS_URL ?? 'http://resultados:8000' });
  const docker = env.MAPA_VIVO_CAOS === 'docker'
    ? crearDocker({ proyecto: env.MAPA_VIVO_PROYECTO ?? 'tuvoto', peticion: peticionUnix(env.MAPA_VIVO_DOCKER_SOCKET ?? '/var/run/docker.sock') })
    : null;
  let mapa = null;
  const mensajeria = env.RABBITMQ_CLAVE
    ? iniciarMensajeria({
      url: `amqp://${encodeURIComponent(env.RABBITMQ_USUARIO ?? 'tuvoto_app')}:${encodeURIComponent(env.RABBITMQ_CLAVE)}@${env.RABBITMQ_HOST ?? 'mensajeria-rabbitmq'}:${Number(env.RABBITMQ_PUERTO ?? 5672)}`,
      alEvento: evento => { mapa?.ingresarEvento(evento).catch(() => {}); },
    })
    : null;
  const sondas = iniciarSondas({ entrada: entradaUrl + '/salud' });
  mapa = crearMapaVivo({
    catalogo, docker, mensajeria, sondas,
    pruebas: crearPruebasVivas({ entradaUrl, origen }),
    urlOperador: env.MAPA_VIVO_URL_OPERADOR ?? '',
    hostsExtra: (env.MAPA_VIVO_HOSTS ?? '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean),
  });
  escucharEntrada({ puerto: Number(env.MAPA_VIVO_PUERTO_REGISTRO ?? 5140), alRecibir: linea => mapa.ingresarSolicitud(linea) });
  await mapa.iniciar();
  mapa.servidor.listen(puerto, '0.0.0.0', () => console.log(JSON.stringify({ servicio: 'mapa-vivo', puerto, docker: Boolean(docker), mensajeria: Boolean(mensajeria) })));
  const salir = () => { mensajeria?.detener(); sondas.detener(); mapa.detener().finally(() => process.exit(0)); };
  process.on('SIGTERM', salir);
  process.on('SIGINT', salir);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principal();
