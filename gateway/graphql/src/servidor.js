import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { buildSchema, parse, validate, execute, GraphQLError } from 'graphql';
import { crearContexto, resolverCampo, servicios } from './agregacion.js';

const texto = readFileSync(process.env.CONTRATO_GRAPHQL ?? new URL('../../../compartido/contratos/graphql/esquema.graphql', import.meta.url), 'utf8');
const esquema = buildSchema(texto);

function limitar(documento, nombre) {
  const fragmentos = new Map(documento.definitions.filter(d => d.kind === 'FragmentDefinition').map(d => [d.name.value, d]));
  const operaciones = documento.definitions.filter(d => d.kind === 'OperationDefinition');
  if (operaciones.some(d => d.operation === 'subscription')) throw new GraphQLError('No se admiten suscripciones');
  let campos = 0;
  function recorrer(seleccion, profundidad = 0) {
    if (profundidad > 10) throw new GraphQLError('La profundidad máxima es 10');
    for (const campo of seleccion?.selections ?? []) {
      if (++campos > 500) throw new GraphQLError('La consulta supera 500 selecciones');
      if (campo.kind === 'FragmentSpread') recorrer(fragmentos.get(campo.name.value)?.selectionSet, profundidad);
      else recorrer(campo.selectionSet, profundidad + (campo.kind === 'Field' ? 1 : 0));
    }
  }
  for (const operacion of operaciones.filter(d => !nombre || d.name?.value === nombre)) recorrer(operacion.selectionSet);
}
function responder(respuesta, codigo, cuerpo) {
  respuesta.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  respuesta.end(JSON.stringify(cuerpo));
}
const servidor = createServer(async (solicitud, respuesta) => {
  const ruta = new URL(solicitud.url, 'http://localhost').pathname;
  const idCorrelacion = String(solicitud.headers['x-correlation-id'] ?? randomUUID()).slice(0, 128);
  respuesta.setHeader('X-Correlation-ID', idCorrelacion);
  if (ruta === '/api/v1/salud' && solicitud.method === 'GET') {
    const estados = await Promise.all(Object.entries(servicios).map(async ([nombre, destino]) => {
      try { const r = await fetch(destino + '/api/v1/salud', { signal: AbortSignal.timeout(2000) }); return [nombre, r.ok]; }
      catch { return [nombre, false]; }
    }));
    return responder(respuesta, estados.every(([, listo]) => listo) ? 200 : 503,
      { servicio: 'gateway-graphql', servicios: Object.fromEntries(estados) });
  }
  if (ruta === '/graphql/esquema.graphql' && solicitud.method === 'GET') {
    respuesta.writeHead(200, { 'Content-Type': 'application/graphql; charset=utf-8' }); return respuesta.end(texto);
  }
  if (ruta !== '/graphql') return responder(respuesta, 404, { error: 'Ruta no encontrada' });
  if (solicitud.method !== 'POST') {
    respuesta.setHeader('Allow', 'POST'); return responder(respuesta, 405, { error: 'Use POST con un cuerpo JSON GraphQL' });
  }
  if (solicitud.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    return responder(respuesta, 415, { error: 'Se requiere application/json' });
  }
  let contexto;
  const controlador = new AbortController();
  solicitud.on('aborted', () => controlador.abort());
  try {
    const bloques = []; let longitud = 0;
    for await (const bloque of solicitud) {
      longitud += bloque.length;
      if (longitud > 65536) return responder(respuesta, 413, { error: 'Cuerpo demasiado grande' });
      bloques.push(bloque);
    }
    const entrada = JSON.parse(Buffer.concat(bloques).toString('utf8'));
    if (!entrada || typeof entrada.query !== 'string' ||
        (entrada.operationName != null && typeof entrada.operationName !== 'string') ||
        (entrada.variables != null && (typeof entrada.variables !== 'object' || Array.isArray(entrada.variables)))) {
      return responder(respuesta, 400, { errors: [{ message: 'Se requiere query y variables como objeto JSON' }] });
    }
    const cabeceras=Object.fromEntries(['cookie','origin','x-csrf-token','x-organizacion'].map(clave=>[clave,String(solicitud.headers[clave]??'')]));
    let autorizacion;
    try{autorizacion=await fetch((process.env.IDENTIDAD_URL??'http://identidad:3000')+'/api/v1/interno/autorizar',{method:'POST',headers:{...cabeceras,'Content-Type':'application/json','X-Servicio':'gateway-graphql','X-Clave-Servicio':process.env.CLAVE_SERVICIO??''},body:JSON.stringify({accion:'elecciones:leer',idOrganizacion:cabeceras['x-organizacion'],escritura:false}),signal:AbortSignal.timeout(2500)});}catch{return responder(respuesta,503,{errors:[{message:'Identidad no disponible'}]});}
    if(!autorizacion.ok)return responder(respuesta,[401,403].includes(autorizacion.status)?autorizacion.status:503,{errors:[{message:'Acceso no autorizado'}]});
    const documento = parse(entrada.query, { maxTokens: 2500 });
    const errores = validate(esquema, documento);
    if (errores.length) return responder(respuesta, 400, { errors: errores });
    limitar(documento, entrada.operationName);
    contexto = crearContexto({ idCorrelacion, cabeceras, senal: AbortSignal.any([controlador.signal, AbortSignal.timeout(15000)]) });
    const resultado = await execute({ schema: esquema, document: documento, contextValue: contexto,
      fieldResolver: resolverCampo, variableValues: entrada.variables, operationName: entrada.operationName });
    const prohibido=resultado.errors?.some(e=>e.extensions?.code==='NO_AUTORIZADO');
    const anonimo=resultado.errors?.some(e=>e.extensions?.code==='NO_AUTENTICADO');
    return responder(respuesta,anonimo?401:prohibido?403:200,resultado);
  } catch (fallo) {
    const mensaje = fallo instanceof GraphQLError ? fallo.message : 'Solicitud JSON inválida';
    return responder(respuesta, 400, { errors: [{ message: mensaje, extensions: { code: 'SOLICITUD_INVALIDA', idCorrelacion } }] });
  } finally {
    if (contexto) console.log(JSON.stringify({ evento: 'operacion_graphql', idCorrelacion, llamadas: contexto.contadores }));
  }
});
servidor.requestTimeout = 20000;
servidor.headersTimeout = 5000;
servidor.listen(4000, '0.0.0.0', () => console.log('Gateway GraphQL escuchando en 4000'));
for (const senal of ['SIGINT', 'SIGTERM']) process.on(senal, () => {
  servidor.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10000).unref();
});
