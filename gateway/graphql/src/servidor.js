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
async function pedir(url, opciones = {}) {
 const r = await fetch(url, { ...opciones, signal: AbortSignal.timeout(6000) });
 if (!r.ok) throw new GraphQLError('Servicio no disponible o acceso denegado', { extensions: { code: r.status === 401 ? 'NO_AUTENTICADO' : r.status === 403 ? 'NO_AUTORIZADO' : r.status===409?'CONFLICTO':r.status===400||r.status===422?'ENTRADA_INVALIDA':'SERVICIO_NO_DISPONIBLE' } });
 return r.json();
}
const GRAPHIQL_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>TUVOTO — Explorador GraphQL</title>
  <link rel="stylesheet" href="https://unpkg.com/graphiql@3.7.1/graphiql.min.css" />
  <style>body { height: 100vh; margin: 0; overflow: hidden; }</style>
</head>
<body>
  <div id="graphiql" style="height: 100vh;"></div>
  <script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/graphiql@3.7.1/graphiql.min.js"></script>
  <script>
    const fetcher = GraphiQL.createFetcher({ url: '/graphql' });
    ReactDOM.render(
      React.createElement(GraphiQL, {
        fetcher,
        defaultQuery: 'query {\\n  eventos {\\n    id\\n    nombre\\n    procesos {\\n      id\\n      cargo\\n      candidatos {\\n        id\\n        nombre\\n      }\\n    }\\n  }\\n  portal {\\n    proceso {\\n      id\\n      nombre\\n      cargo\\n    }\\n    resultados {\\n      total\\n      avance\\n      candidatos {\\n        nombre\\n        votos\\n        porcentaje\\n      }\\n    }\\n  }\\n}'
      }),
      document.getElementById('graphiql')
    );
  </script>
</body>
</html>`;
http.createServer(async (req, res) => {
 const idCorrelacion = randomUUID();
 const responder = (codigo, cuerpo) => { res.writeHead(codigo, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Correlation-ID':idCorrelacion }); res.end(JSON.stringify(cuerpo)); };
 if (req.url === '/salud') { try { await pedir(elecciones + '/api/v1/salud'); return responder(200, { servicio: 'graphql', estado: 'saludable' }); } catch { return responder(503, { servicio: 'graphql' }); } }
 if (req.url === '/graphql' && req.method === 'GET') {
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
   res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
   return res.end(GRAPHIQL_HTML);
  }
  return responder(405, { errors: [{ message: 'Use POST /graphql' }] });
 }
 if (req.url !== '/graphql' || req.method !== 'POST') return responder(405, { errors: [{ message: 'Use POST /graphql' }] });
 try {
  const partes = []; let longitud = 0;
  for await (const parte of req) { longitud += parte.length; if (longitud > 15000000) return responder(413, { errors: [{ message: 'Solicitud demasiado grande' }] }); partes.push(parte); }
  const entrada = JSON.parse(Buffer.concat(partes));
  if (typeof entrada.query !== 'string') throw new Error();
  const documento = parse(entrada.query, { maxTokens: 2000 }); let campos = 0, profundidad = 0, maxima = 0;
  visit(documento, { Field: { enter() { campos++; profundidad++; maxima = Math.max(maxima, profundidad); }, leave() { profundidad--; } } });
  if (campos > 150 || maxima > 8) throw new Error();
  const errores = validate(esquema, documento); if (errores.length) return responder(400, { errors: errores });
  const cargar = new DataLoader(async urls => Promise.all(urls.map(url => pedir(url))));
  const headers = Object.fromEntries(['cookie', 'origin', 'x-csrf-token', 'x-organizacion'].map(k => [k, req.headers[k] ?? '']));
  headers['x-correlation-id']=idCorrelacion;
  const raiz = {
   eventos: () => cachePortal('eventos',async()=>(await cargar.load(elecciones+'/api/v1/publico/eventos')).elementos),
   eleccionesPublicadas: () => cargar.load(elecciones+'/api/v1/publico/elecciones').then(r=>r.elementos),
   portal: ({unidad,idProceso}) => {
    if((unidad&&unidad.length>120)||(idProceso&&!/^[a-f0-9-]{36}$/i.test(idProceso)))throw new GraphQLError('Filtro inválido');
    return cachePortal(JSON.stringify([idProceso??'',unidad??'']),async()=>{
     const proceso=await cargar.load(elecciones+(idProceso?'/api/v1/publico/procesos/'+encodeURIComponent(idProceso):'/api/v1/publico/actual'));if(!proceso)return null;
     proceso.unidades=[...new Set(proceso.mesas.map(m=>m.unidad))];
     const [conteo,recepcion]=await Promise.all([cargar.load(resultados+'/api/v1/publico/resultados/'+encodeURIComponent(proceso.id)+(unidad?'?unidad='+encodeURIComponent(unidad):'')),cargar.load(actas+'/api/v1/publico/actas/'+encodeURIComponent(proceso.id)+'/avance').catch(()=>null)]);
     return {proceso,resultados:conteo,recepcion};
    });
   },
   registrarActa: ({ entrada: datos }) => pedir(actas + '/api/v1/actas', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(datos) }),
  };
  const resultado = await execute({ schema: esquema, document: documento, rootValue: raiz, variableValues: entrada.variables, operationName: entrada.operationName });
  const codigos = resultado.errors?.map(e => e.extensions.code) ?? [];
  responder(codigos.includes('NO_AUTENTICADO') ? 401 : codigos.includes('NO_AUTORIZADO') ? 403 : 200, resultado);
 } catch { responder(400, { errors: [{ message: 'Solicitud inválida o demasiado amplia' }] }); }
}).listen(Number(process.env.PORT ?? 4000), '0.0.0.0');
