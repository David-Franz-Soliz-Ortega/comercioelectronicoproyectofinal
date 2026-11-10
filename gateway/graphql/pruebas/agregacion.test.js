import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSchema, graphql } from 'graphql';
import { crearContexto, resolverCampo } from '../src/agregacion.js';

const esquema = buildSchema(readFileSync(process.env.CONTRATO_GRAPHQL ?? new URL('../../../compartido/contratos/graphql/esquema.graphql', import.meta.url), 'utf8'));
const primero = '10000000-0000-4000-8000-000000000001';
const segundo = '10000000-0000-4000-8000-000000000002';
const eleccion = idEleccion => ({ idEleccion, nombre: 'Elección sintética', estado: 'borrador', creadoEn: '2026-11-10T00:00:00Z', actualizadoEn: '2026-11-10T00:00:00Z' });
const pagina = elementos => ({ elementos, pagina: 1, limite: 100, total: elementos.length });
function preparar(opciones = {}) {
  const llamadas = [];
  const transporte = async (direccion, configuracion) => {
    const ruta = new URL(direccion);
    llamadas.push({ ruta, configuracion });
    if (opciones.transporte) return opciones.transporte(ruta, configuracion);
    const recurso = ruta.pathname.split('/')[3];
    let datos;
    if (recurso === 'elecciones') datos = pagina([eleccion(primero), eleccion(segundo)]);
    if (recurso === 'candidaturas') datos = pagina([primero, segundo].map((idEleccion, i) => ({ idCandidatura: 'c' + i, idEleccion, nombre: 'Postulación sintética' })));
    if (recurso === 'inscripciones') datos = pagina([primero, segundo].map((idEleccion, i) => ({ idInscripcion: 'i' + i, idEleccion, elegible: true })));
    return Response.json(datos);
  };
  return { llamadas, contexto: crearContexto({ ...opciones, idCorrelacion: 'prueba', transporte, registrar: () => {} }) };
}
function consultar(source, contexto) { return graphql({ schema: esquema, source, contextValue: contexto, fieldResolver: resolverCampo }); }

test('agrupa tres elecciones, dos claves únicas y sus relaciones con solo tres peticiones REST', async () => {
  const { contexto, llamadas } = preparar();
  const respuesta = await consultar(`{ eleccionesPorIds(ids:["${segundo}","${primero}","${primero}"]) {
    idEleccion candidaturas { total elementos { nombre eleccion { idEleccion } } }
    otra: candidaturas { total } inscripciones { total elementos { eleccion { idEleccion } } }
  } }`, contexto);
  assert.equal(respuesta.errors, undefined);
  assert.deepEqual(respuesta.data.eleccionesPorIds.map(f => f.idEleccion), [segundo, primero, primero]);
  assert.equal(llamadas.length, 3);
  assert.deepEqual(contexto.contadores, { elecciones: 1, candidaturas: 1, padron: 1 });
  assert.ok(llamadas.every(l => l.configuracion.headers['X-Correlation-ID'] === 'prueba'));
});

test('la caché no se comparte entre operaciones', async () => {
  const uno = preparar(); const dos = preparar();
  const consulta = `{ eleccionesPorIds(ids:["${primero}","${segundo}"]) { nombre } }`;
  await consultar(consulta, uno.contexto); await consultar(consulta, dos.contexto);
  assert.equal(uno.llamadas.length, 1); assert.equal(dos.llamadas.length, 1);
});

test('recorre páginas y no confunde claves faltantes con el orden de respuestas', async () => {
  const { contexto, llamadas } = preparar({ transporte: async ruta => Response.json({
    elementos: ruta.searchParams.get('pagina') === '1' ? Array.from({ length: 100 }, () => eleccion(segundo)) : [eleccion(primero)],
    pagina: Number(ruta.searchParams.get('pagina')), limite: 100, total: 101,
  }) });
  const resultado = await contexto.cargadores.elecciones.loadMany([primero, segundo]);
  assert.deepEqual(resultado.map(r => r.idEleccion), [primero, segundo]);
  assert.equal(llamadas.length, 2);
});

test('no entrega un lote incompleto al superar el límite de páginas', async () => {
  const { contexto } = preparar({ maximoPaginas: 1, transporte: async () => Response.json({ elementos: [eleccion(segundo)], total: 101 }) });
  const resultados = await contexto.cargadores.elecciones.loadMany([primero, segundo]);
  assert.ok(resultados.every(r => r.extensions.code === 'LIMITE_DE_CARGA'));
});

test('un fallo de candidaturas permite conservar las otras proyecciones', async () => {
  const { contexto } = preparar({ transporte: async ruta => {
    if (ruta.pathname.endsWith('/candidaturas')) return Response.json({}, { status: 503 });
    return Response.json(pagina([eleccion(primero)]));
  } });
  const respuesta = await consultar('{ elecciones { elementos { nombre candidaturas { total } } } }', contexto);
  assert.equal(respuesta.data.elecciones.elementos[0].nombre, 'Elección sintética');
  assert.equal(respuesta.data.elecciones.elementos[0].candidaturas, null);
  assert.equal(respuesta.errors[0].extensions.code, 'SERVICIO_NO_DISPONIBLE');
});

test('una mutación invalida el caché de lecturas de la misma operación', async () => {
  let nuevoNombre = 'Anterior';
  const { contexto, llamadas } = preparar({ transporte: async (_, opciones) => {
    if (opciones.method === 'POST') nuevoNombre = JSON.parse(opciones.body).nombre;
    return Response.json({ ...eleccion(primero), nombre: nuevoNombre });
  } });
  assert.equal((await contexto.cargadores.elecciones.load(primero)).nombre, 'Anterior');
  await contexto.crear('elecciones', 'elecciones', { nombre: 'Nuevo', estado: 'borrador' });
  assert.equal((await contexto.cargadores.elecciones.load(primero)).nombre, 'Nuevo');
  assert.equal(llamadas.length, 2);
});
