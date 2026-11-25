// Disposición del mapa: nodos reales de docker-compose.yml y sus conexiones.
// Coordenadas del SVG; la franja superior (y < 0) queda libre para los anuncios.

export const ANCHO = 1080;
export const ALTO = 640;

export const NODOS = {
  operadores: { x: 80, y: 130, nombre: 'Operadores', detalle: 'Celulares con sesión', tipo: 'persona' },
  publico: { x: 80, y: 450, nombre: 'Público', detalle: 'Sin iniciar sesión', tipo: 'persona' },
  entrada: { x: 245, y: 315, nombre: 'Entrada', detalle: 'NGINX · proxy', tipo: 'entrada' },
  frontend: { x: 245, y: 560, nombre: 'Portal web', detalle: 'React · NGINX', tipo: 'entrada' },
  actas: { x: 455, y: 100, nombre: 'Actas', detalle: 'FastAPI · OCR', tipo: 'negocio' },
  identidad: { x: 455, y: 250, nombre: 'Identidad', detalle: 'Node · sesiones y roles', tipo: 'negocio' },
  elecciones: { x: 455, y: 400, nombre: 'Elecciones', detalle: 'Node · REST + gRPC', tipo: 'negocio' },
  gateway: { x: 455, y: 555, nombre: 'GraphQL', detalle: 'Gateway público', tipo: 'entrada' },
  rabbitmq: { x: 650, y: 100, nombre: 'RabbitMQ', detalle: 'Eventos de actas', tipo: 'mensajeria' },
  postgres: { x: 650, y: 300, nombre: 'PostgreSQL', detalle: 'Una base por servicio', tipo: 'datos' },
  resultados: { x: 650, y: 555, nombre: 'Resultados', detalle: 'FastAPI · cómputo', tipo: 'negocio' },
  conteo: { x: 845, y: 60, nombre: 'Conteo', detalle: 'Consumidor', tipo: 'consumidor' },
  auditoria: { x: 845, y: 175, nombre: 'Auditoría', detalle: 'Consumidor', tipo: 'consumidor' },
  redis: { x: 845, y: 555, nombre: 'Redis', detalle: 'Caché pública 3 s', tipo: 'datos' },
  mongodb: { x: 1000, y: 300, nombre: 'MongoDB', detalle: 'Proyección', tipo: 'datos' },
};

export const MEDIDAS = { persona: [120, 92], normal: [150, 68], datos: [140, 68] };

export function medidas(id) {
  const tipo = NODOS[id].tipo;
  return tipo === 'persona' ? MEDIDAS.persona : tipo === 'datos' ? MEDIDAS.datos : MEDIDAS.normal;
}

// [desde, hasta, tipo, curva opcional con dos puntos de control]
export const ARISTAS = [
  ['operadores', 'entrada', 'http'],
  ['publico', 'entrada', 'http'],
  ['entrada', 'frontend', 'http'],
  ['entrada', 'actas', 'http'],
  ['entrada', 'identidad', 'http'],
  ['entrada', 'elecciones', 'http'],
  ['entrada', 'gateway', 'http'],
  ['entrada', 'resultados', 'http', [[262, 640], [560, 650]]],
  ['actas', 'identidad', 'http'],
  ['elecciones', 'identidad', 'http'],
  ['actas', 'elecciones', 'grpc', [[340, 160], [340, 340]]],
  ['actas', 'rabbitmq', 'evento'],
  ['rabbitmq', 'conteo', 'evento'],
  ['rabbitmq', 'auditoria', 'evento'],
  ['actas', 'postgres', 'datos'],
  ['identidad', 'postgres', 'datos'],
  ['elecciones', 'postgres', 'datos'],
  ['conteo', 'mongodb', 'datos', [[965, 60], [1000, 190]]],
  ['auditoria', 'mongodb', 'datos', [[950, 175], [1000, 235]]],
  ['gateway', 'elecciones', 'http'],
  ['gateway', 'resultados', 'http'],
  ['resultados', 'redis', 'datos'],
  ['resultados', 'mongodb', 'datos', [[770, 430], [860, 300]]],
];

export function clave(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function trazo(desde, hasta, curva) {
  const a = NODOS[desde];
  const b = NODOS[hasta];
  if (curva) return `M${a.x},${a.y} C${curva[0][0]},${curva[0][1]} ${curva[1][0]},${curva[1][1]} ${b.x},${b.y}`;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < 4 || Math.abs(dy) < 4) return `M${a.x},${a.y} L${b.x},${b.y}`;
  if (Math.abs(dx) >= Math.abs(dy) * 0.6) return `M${a.x},${a.y} C${a.x + dx / 2},${a.y} ${b.x - dx / 2},${b.y} ${b.x},${b.y}`;
  return `M${a.x},${a.y} C${a.x},${a.y + dy / 2} ${b.x},${b.y - dy / 2} ${b.x},${b.y}`;
}

export function existeArista(a, b) {
  return ARISTAS.some(([x, y]) => clave(x, y) === clave(a, b));
}

// Recorrido visible de una solicitud: origen → entrada → servicio dueño.
export function recorrido(origen, servicio) {
  if (servicio === 'entrada') return [origen, 'entrada'];
  return [origen, 'entrada', servicio];
}
