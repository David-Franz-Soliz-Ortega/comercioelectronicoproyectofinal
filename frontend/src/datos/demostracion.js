// Ejemplos locales y ficticios para revisar la interfaz. Nunca se envían a una API.
const candidaturas = [
  { id: 'horizonte', nombre: 'Candidatura Horizonte', sigla: 'HO', color: 'rojo' },
  { id: 'conecta', nombre: 'Candidatura Conecta', sigla: 'CO', color: 'azul' },
  { id: 'renueva', nombre: 'Candidatura Renueva', sigla: 'RE', color: 'ambar' },
];

function crearEjemplo(id, cargo, facultad, carrera, estudiantes, docentes, actas, actasEsperadas) {
  return { id, cargo, facultad, carrera, actas, actasEsperadas,
    candidaturas: candidaturas.map((candidatura, indice) => ({ ...candidatura, estudiantes: estudiantes[indice], docentes: docentes[indice] })),
    blancos: { estudiantes: 38, docentes: 3 }, nulos: { estudiantes: 22, docentes: 2 },
  };
}

export const resultadosDemostracion = [
  crearEjemplo('decanato-tecnologia', 'Decanato', 'Ciencias y Tecnología', '', [1548, 1056, 396], [45, 39, 16], 18, 24),
  crearEjemplo('direccion-sistemas', 'Dirección de carrera', 'Ciencias y Tecnología', 'Ingeniería de Sistemas', [486, 324, 190], [12, 16, 4], 8, 10),
  crearEjemplo('decanato-derecho', 'Decanato', 'Derecho', '', [1232, 888, 680], [32, 41, 7], 16, 20),
  crearEjemplo('direccion-economia', 'Dirección de carrera', 'Ciencias Económicas', 'Economía', [352, 432, 216], [11, 15, 4], 6, 8),
  crearEjemplo('rectorado', 'Rectorado', '', '', [6048, 4752, 2700], [198, 171, 81], 72, 96),
  crearEjemplo('vicerrectorado', 'Vicerrectorado', '', '', [4725, 5805, 2970], [162, 207, 81], 70, 96),
];

export const formatearNumero = valor => new Intl.NumberFormat('es-BO').format(valor);
export const formatearPorcentaje = valor => new Intl.NumberFormat('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(valor) + ' %';
export const normalizar = texto => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
export function calcularResultado(resultado, estamento) {
  const validos = resultado.candidaturas.reduce((total, candidatura) => total + candidatura[estamento], 0);
  const candidaturas = resultado.candidaturas.map(candidatura => ({ ...candidatura, votos: candidatura[estamento], porcentaje: validos ? candidatura[estamento] / validos * 100 : 0 })).sort((a, b) => b.votos - a.votos);
  return { validos, candidaturas, avance: resultado.actasEsperadas ? resultado.actas / resultado.actasEsperadas * 100 : 0 };
}
