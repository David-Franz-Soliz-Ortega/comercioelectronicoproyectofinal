import { randomUUID } from 'node:crypto';
import { crearCachePublicaPorClave } from './cache-publica.js';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { buildSchema, parse, validate, execute, GraphQLError, visit } from 'graphql';
import DataLoader from 'dataloader';

const cachePortal = crearCachePublicaPorClave();
const esquema = buildSchema(readFileSync(process.env.CONTRATO_GRAPHQL ?? '/app/esquema.graphql', 'utf8'));
const elecciones = process.env.ELECCIONES_URL ?? 'http://elecciones:3000';
const resultados = process.env.RESULTADOS_URL ?? 'http://resultados:8000';
const actas = process.env.ACTAS_URL ?? 'http://actas:8000';

const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0];
const solicitudes = new Map();
let duracionSum = 0;
let duracionCount = 0;
const duracionBuckets = new Map();
BUCKETS.forEach(b => duracionBuckets.set(b, 0));

function registrarMetrica(metodo, estado, segundos) {
  const clave = `${metodo}:${estado}`;
  solicitudes.set(clave, (solicitudes.get(clave) ?? 0) + 1);
  duracionSum += segundos;
  duracionCount += 1;
  for (const b of BUCKETS) {
    if (segundos <= b) {
      duracionBuckets.set(b, (duracionBuckets.get(b) ?? 0) + 1);
    }
  }
}

function generarTextoPrometheus() {
  const lineas = [
    '# HELP tuvoto_http_requests_total Total de solicitudes HTTP procesadas',
    '# TYPE tuvoto_http_requests_total counter',
  ];
  if (solicitudes.size === 0) {
    lineas.push('tuvoto_http_requests_total{servicio="gateway-graphql",metodo="POST",estado="200"} 0');
  } else {
    for (const [clave, val] of solicitudes.entries()) {
      const [m, e] = clave.split(':');
      lineas.push(`tuvoto_http_requests_total{servicio="gateway-graphql",metodo="${m}",estado="${e}"} ${val}`);
    }
  }
  lineas.push(
    '# HELP tuvoto_http_request_duration_seconds Duracion de solicitudes HTTP en segundos',
    '# TYPE tuvoto_http_request_duration_seconds histogram'
  );
  for (const b of BUCKETS) {
    lineas.push(`tuvoto_http_request_duration_seconds_bucket{servicio="gateway-graphql",le="${b}"} ${duracionBuckets.get(b) ?? 0}`);
  }
  lineas.push(`tuvoto_http_request_duration_seconds_bucket{servicio="gateway-graphql",le="+Inf"} ${duracionCount}`);
  lineas.push(`tuvoto_http_request_duration_seconds_sum{servicio="gateway-graphql"} ${duracionSum.toFixed(6)}`);
  lineas.push(`tuvoto_http_request_duration_seconds_count{servicio="gateway-graphql"} ${duracionCount}`);
  return lineas.join('\n') + '\n';
}

async function pedir(url, opciones = {}) {
  const r = await fetch(url, { ...opciones, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new GraphQLError('Servicio no disponible o acceso denegado', { extensions: { code: r.status === 401 ? 'NO_AUTENTICADO' : r.status === 403 ? 'NO_AUTORIZADO' : r.status===409?'CONFLICTO':r.status===400||r.status===422?'ENTRADA_INVALIDA':'SERVICIO_NO_DISPONIBLE' } });
  return r.json();
}

http.createServer(async (req, res) => {
  const inicio = performance.now();
  const idCorrelacion = randomUUID();
  const responder = (codigo, cuerpo) => {
    const seg = (performance.now() - inicio) / 1000;
    registrarMetrica(req.method, codigo, seg);
    res.writeHead(codigo, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Correlation-ID': idCorrelacion });
    res.end(JSON.stringify(cuerpo));
  };

  if (req.url === '/metrics' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
    return res.end(generarTextoPrometheus());
  }

  if (req.url === '/salud') {
    try {
      await pedir(elecciones + '/api/v1/salud');
      return responder(200, { servicio: 'graphql', estado: 'saludable' });
    } catch {
      return responder(503, { servicio: 'graphql' });
    }
  }

  if (req.url !== '/graphql' || req.method !== 'POST') return responder(405, { errors: [{ message: 'Use POST /graphql' }] });

  try {
    const partes = [];
    let longitud = 0;
    for await (const parte of req) {
      longitud += parte.length;
      if (longitud > 15000000) return responder(413, { errors: [{ message: 'Solicitud demasiado grande' }] });
      partes.push(parte);
    }
    const entrada = JSON.parse(Buffer.concat(partes));
    if (typeof entrada.query !== 'string') throw new Error();
    const documento = parse(entrada.query, { maxTokens: 2000 });
    let campos = 0, profundidad = 0, maxima = 0;
    visit(documento, { Field: { enter() { campos++; profundidad++; maxima = Math.max(maxima, profundidad); }, leave() { profundidad--; } } });
    if (campos > 150 || maxima > 8) throw new Error();
    const errores = validate(esquema, documento);
    if (errores.length) return responder(400, { errors: errores });
    const cargar = new DataLoader(async urls => Promise.all(urls.map(url => pedir(url))));
    const headers = Object.fromEntries(['cookie', 'origin', 'x-csrf-token', 'x-organizacion'].map(k => [k, req.headers[k] ?? '']));
    headers['x-correlation-id'] = idCorrelacion;
    const raiz = {
      eventos: () => cachePortal('eventos', async () => (await cargar.load(elecciones + '/api/v1/publico/eventos')).elementos),
      eleccionesPublicadas: () => cargar.load(elecciones + '/api/v1/publico/elecciones').then(r => r.elementos),
      portal: ({ unidad, idProceso }) => {
        if ((unidad && unidad.length > 120) || (idProceso && !/^[a-f0-9-]{36}$/i.test(idProceso))) throw new GraphQLError('Filtro inválido');
        return cachePortal(JSON.stringify([idProceso ?? '', unidad ?? '']), async () => {
          const proceso = await cargar.load(elecciones + (idProceso ? '/api/v1/publico/procesos/' + encodeURIComponent(idProceso) : '/api/v1/publico/actual'));
          if (!proceso) return null;
          proceso.unidades = [...new Set(proceso.mesas.map(m => m.unidad))];
          const [conteo, recepcion] = await Promise.all([cargar.load(resultados + '/api/v1/publico/resultados/' + encodeURIComponent(proceso.id) + (unidad ? '?unidad=' + encodeURIComponent(unidad) : '')), cargar.load(actas + '/api/v1/publico/actas/' + encodeURIComponent(proceso.id) + '/avance').catch(() => null)]);
          return { proceso, resultados: conteo, recepcion };
        });
      },
      registrarActa: ({ entrada: datos }) => pedir(actas + '/api/v1/actas', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(datos) }),
    };
    const resultado = await execute({ schema: esquema, document: documento, rootValue: raiz, variableValues: entrada.variables, operationName: entrada.operationName });
    const codigos = resultado.errors?.map(e => e.extensions.code) ?? [];
    responder(codigos.includes('NO_AUTENTICADO') ? 401 : codigos.includes('NO_AUTORIZADO') ? 403 : 200, resultado);
  } catch {
    responder(400, { errors: [{ message: 'Solicitud inválida o demasiado amplia' }] });
  }
}).listen(Number(process.env.PORT ?? 4000), '0.0.0.0');
