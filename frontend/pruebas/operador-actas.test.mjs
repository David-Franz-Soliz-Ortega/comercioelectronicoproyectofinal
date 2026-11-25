import test from 'node:test';
import assert from 'node:assert/strict';
import { fotoAdmitida, ultimasVersiones, estadoMesa, avance, opcionesDestino, camposDePropuesta, revisarConteo, datosRegistro } from '../src/api/operadorActas.js';
import { generarHojas, nombreSector } from '../public/ejemplos/actas-practica-datos.js';

const mesas = [
  { id: 'm1', codigo: '9', cargo: 'Decano', estado: 'recepcion', idMesaFisica: 'f9' },
  { id: 'm2', codigo: '9', cargo: 'Rector', estado: 'recepcion', idMesaFisica: 'f9' },
  { id: 'm3', codigo: '10', cargo: 'Rector', estado: 'cerrada' },
];

test('la foto debe ser JPEG o PNG de hasta 10 MB', () => {
  assert.equal(fotoAdmitida({ type: 'image/jpeg', size: 4_000_000 }), '');
  assert.match(fotoAdmitida({ type: 'image/heic', size: 1000 }), /JPEG o PNG/);
  assert.match(fotoAdmitida({ type: 'image/png', size: 10_000_001 }), /10 MB/);
});

test('el estado de cada mesa sale de su última versión y no cuenta mesas cerradas', () => {
  const ultimas = ultimasVersiones([{ idMesa: 'm1', version: 1, estado: 'publicada' }, { idMesa: 'm1', version: 2, estado: 'observada' }, { id_mesa: 'm3', version: 1, estado: 'publicada' }]);
  assert.deepEqual(estadoMesa(mesas[0], ultimas), { clave: 'observada', texto: 'Observada · v2', version: 2 });
  assert.equal(estadoMesa(mesas[1], ultimas).clave, 'pendiente');
  assert.equal(estadoMesa({ ...mesas[2], id: 'otra' }, ultimas).clave, 'cerrada');
  assert.deepEqual(avance(mesas, ultimas), { registradas: 1, total: 2, pendientes: 1 });
  assert.equal(estadoMesa(mesas[1], new Map([['m2', { version: 3, estado: 'anulada' }]])).clave, 'pendiente');
});

test('las opciones de destino respetan el empate de la lectura y excluyen mesas cerradas', () => {
  assert.deepEqual(opcionesDestino(mesas, ['m2', 'm3']).map(m => m.id), ['m2']);
  assert.deepEqual(opcionesDestino(mesas, []).map(m => m.id), ['m1', 'm2']);
  assert.deepEqual(opcionesDestino(mesas, ['ajena']).map(m => m.id), ['m1', 'm2']);
});

test('la propuesta solo llena lo leído y la suma se comprueba sin corregir', () => {
  const candidatos = [{ id: 'a' }, { id: 'b' }];
  const c = camposDePropuesta(candidatos, { votos: [{ idCandidato: 'a', cantidad: 120 }, { idCandidato: 'b', cantidad: null }], blancos: 3, nulos: 2, total: 205 });
  assert.deepEqual(c.votos, { a: 120, b: '' });
  assert.deepEqual([...c.leidos].sort(), ['a', 'blancos', 'nulos', 'total']);
  assert.deepEqual(revisarConteo(c), { completos: false, faltan: 1, suma: 125, coincide: false });
  assert.equal(revisarConteo({ ...c, votos: { a: 120, b: '80' } }).coincide, true);
  assert.equal(revisarConteo({ ...c, votos: { a: 120, b: '81' } }).coincide, false);
  assert.equal(revisarConteo({ ...c, votos: { a: 120, b: '-1' } }).completos, false);
  assert.equal(camposDePropuesta(candidatos, null).leidos.size, 0);
});

test('el registro envía números y la confirmación explícita', () => {
  const d = datosRegistro({ idMesa: 'm1', idSolicitud: 's', versionAnterior: 0, foto: 'data:image/png;base64,AA', votos: { a: '120' }, blancos: '3', nulos: '2', total: '125' });
  assert.deepEqual(d, { idMesa: 'm1', idSolicitud: 's', versionAnterior: 0, foto: 'data:image/png;base64,AA', votos: [{ idCandidato: 'a', cantidad: 120 }], blancos: 3, nulos: 2, total: 125, confirmado: true });
});

test('las actas de práctica cuadran, son reproducibles y marcan las variantes', () => {
  const proceso = { id: 'p1', nombre: 'Decano Facultad de Tecnología', sectores: [{ codigo: 'docentes', nombre: 'Docentes' }],
    candidatos: [{ nombre: 'Candidatura Alfa' }, { nombre: 'Candidatura Beta' }],
    mesas: [{ id: 'x2', codigo: 'Mesa 10', unidad: 'Tecnología', sector: 'docentes' }, { id: 'x1', codigo: 'Mesa 9', unidad: 'Tecnología', sector: 'general' }] };
  const hojas = generarHojas([proceso], { semilla: 7, erronea: true, correccion: true });
  assert.equal(hojas.length, 4);
  assert.deepEqual(hojas.slice(0, 2).map(h => h.codigo), ['Mesa 9', 'Mesa 10']);
  for (const h of hojas.slice(0, 2)) assert.equal(h.votos.reduce((s, v) => s + v.cantidad, 0) + h.blancos + h.nulos, h.total);
  const [erronea, version2] = hojas.slice(2);
  assert.equal(erronea.total, hojas[0].total + 3);
  assert.match(erronea.practica, /Suma errónea/);
  assert.equal(version2.votos.reduce((s, v) => s + v.cantidad, 0) + version2.blancos + version2.nulos, version2.total);
  assert.notEqual(version2.votos[0].cantidad, hojas[1].votos[0].cantidad);
  assert.deepEqual(generarHojas([proceso], { semilla: 7 }), hojas.slice(0, 2));
  assert.notDeepEqual(generarHojas([proceso], { semilla: 8 })[0].votos, hojas[0].votos);
  assert.equal(nombreSector(proceso, 'docentes'), 'Docentes');
  assert.equal(nombreSector(proceso, 'general'), 'General');
  assert.equal(hojas[1].cargo, 'Decano Facultad de Tecnología');
  assert.deepEqual(generarHojas([{ ...proceso, candidatos: [] }]), []);
});
