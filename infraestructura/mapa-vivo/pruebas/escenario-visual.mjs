// Fixture de prueba visual con datos SINTÉTICOS. No forma parte de la imagen
// (el Dockerfile solo copia src/ y publico/) ni existe como modo del producto.
// Uso: node pruebas/escenario-visual.mjs [puerto]  →  http://127.0.0.1:<puerto>/
import { randomUUID } from 'node:crypto';
import { crearMapaVivo } from '../src/servidor.mjs';

const puerto = Number(process.argv[2] ?? 8899);
const PROCESO = '11111111-1111-4111-8111-111111111111';
const ALFA = '33333333-3333-4333-8333-333333333333';
const BETA = '44444444-4444-4444-8444-444444444444';
const mesas = Array.from({ length: 12 }, (_, i) => ({ id: randomUUID(), codigo: `PRUEBA-${String(i + 1).padStart(2, '0')}` }));
const proceso = { id: PROCESO, cargo: 'Decanatura de demostración', nombre: 'Simulacro académico', candidatos: [{ id: ALFA, nombre: 'Candidatura Alfa' }, { id: BETA, nombre: 'Candidatura Beta' }], mesas };
const votos = { [ALFA]: 0, [BETA]: 0 };
let contabilizadas = 0;

const colas = { 'resultados.conteo.v1': { mensajes: 0, consumidores: 1 }, 'resultados.auditoria.v1': { mensajes: 0, consumidores: 1 }, 'resultados.conteo.v1.dlq': { mensajes: 0, consumidores: 0 }, 'resultados.auditoria.v1.dlq': { mensajes: 0, consumidores: 0 } };
const salud = { identidad: 'ok', elecciones: 'ok', actas: 'ok', resultados: 'ok', gateway: 'ok', frontend: 'ok', entrada: 'ok', postgres: 'ok', mongodb: 'ok', redis: 'ok', rabbitmq: 'ok' };

const mapa = crearMapaVivo({
  catalogo: {
    proceso: async () => proceso,
    actual: async () => proceso,
    resultados: async () => {
      const validos = votos[ALFA] + votos[BETA];
      return { idProceso: PROCESO, cargo: proceso.cargo, nombre: proceso.nombre, esperadas: 12, contabilizadas, observadas: 0, avance: Math.round((contabilizadas / 12) * 10000) / 100, validos, blancos: contabilizadas * 3, nulos: contabilizadas * 2, total: validos + contabilizadas * 5, ponderacionAplicada: false,
        candidatos: [ALFA, BETA].map(id => ({ id, nombre: id === ALFA ? 'Candidatura Alfa' : 'Candidatura Beta', votos: votos[id], porcentaje: validos ? Math.round((votos[id] * 10000) / validos) / 100 : 0 })).sort((a, b) => b.votos - a.votos) };
    },
  },
  sondas: { estado: () => salud },
  mensajeria: { estado: () => ({ conectada: true, colas }) },
  pruebas: { ataqueSesion: async () => ({ tipo: 'ataque-sesion', estado: 401 }), ataqueInterno: async () => ({ tipo: 'ataque-interno', estado: 403 }), rafaga: async () => ({ tipo: 'rafaga', cantidad: 300, correctas: 300, fallidas: 0, duracionMs: 1840, p95Ms: 31, ruta: 'resultados' }) },
  urlOperador: 'http://192.0.2.10:8892/',
});

const cliente = () => `198.51.100.${Math.floor(Math.random() * 14) + 1}`;
const solicitud = (metodo, uri, estado, ms) => mapa.ingresarSolicitud({ metodo, uri, estado, ms, cliente: cliente(), prueba: '' });
let version = new Map();

function registrarActa() {
  const mesa = mesas[Math.floor(Math.random() * mesas.length)];
  const previa = version.get(mesa.id) ?? 0;
  const alfa = 60 + Math.floor(Math.random() * 60);
  const beta = 40 + Math.floor(Math.random() * 60);
  solicitud('POST', '/api/v1/actas/lectura', 200, 900 + Math.floor(Math.random() * 600));
  setTimeout(() => {
    solicitud(previa ? 'PUT' : 'POST', previa ? `/api/v1/actas/mesas/${mesa.id}` : '/api/v1/actas', previa ? 200 : 201, 80);
    if (!previa) { contabilizadas += 1; votos[ALFA] += alfa; votos[BETA] += beta; }
    version.set(mesa.id, previa + 1);
    setTimeout(() => mapa.ingresarEvento({ idEvento: randomUUID(), tipo: 'acta.actualizada.v1', version: 1, datos: { idProceso: PROCESO, idMesa: mesa.id, idOrganizacion: PROCESO, versionActa: previa + 1, unidad: 'Unidad de demostración', sector: 'general', conteo: { votos: [{ idCandidato: ALFA, cantidad: alfa }, { idCandidato: BETA, cantidad: beta }], blancos: 3, nulos: 2, total: alfa + beta + 5 }, observada: false } }), 400);
  }, 2600);
}

await mapa.iniciar();
mapa.servidor.listen(puerto, '127.0.0.1', () => console.log(`Escenario visual sintético en http://127.0.0.1:${puerto}/`));
setInterval(mapa.tick, 1000);
setInterval(() => solicitud('POST', '/graphql', 200, 12), 1300);
setInterval(() => solicitud('GET', '/api/v1/mis-mesas', 200, 25), 3100);
setInterval(registrarActa, 6500);
setTimeout(registrarActa, 800);
// Caída sintética del consumidor de conteo para revisar avisos y cola.
const conteo = colas['resultados.conteo.v1'];
setTimeout(() => { conteo.consumidores = 0; conteo.mensajes = 1; salud.resultados = 'degradado'; }, 15_000);
setTimeout(() => { conteo.mensajes = 4; }, 19_000);
setTimeout(() => { conteo.consumidores = 1; conteo.mensajes = 2; salud.resultados = 'ok'; }, 24_000);
setTimeout(() => { conteo.mensajes = 0; }, 26_000);
setTimeout(() => solicitud('POST', '/api/v1/actas', 401, 9), 4200);
setTimeout(() => solicitud('POST', '/api/v1/interno/autorizar', 403, 1), 5200);
