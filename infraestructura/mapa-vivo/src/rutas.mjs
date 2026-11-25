// Describe una solicitud registrada por NGINX. Replica el enrutamiento de
// infraestructura/tuvoto/nginx.conf solo para dibujarlo; no decide permisos.

const PREFIJOS = [
  ['/api/v1/interno', 'entrada'],
  ['/interno', 'entrada'],
  ['/api/v1/autenticacion', 'identidad'],
  ['/api/v1/importaciones', 'identidad'],
  ['/api/v1/usuarios', 'identidad'],
  ['/api/v1/organizaciones', 'identidad'],
  ['/api/v1/configuracion', 'elecciones'],
  ['/api/v1/mis-mesas', 'elecciones'],
  ['/api/v1/mesas', 'elecciones'],
  ['/api/v1/publico/resultados', 'resultados'],
  ['/api/v1/publico/actas', 'actas'],
  ['/api/v1/publico', 'elecciones'],
  ['/api/v1/informes', 'resultados'],
  ['/api/v1/actas', 'actas'],
];

const DOCUMENTACION = /^\/api\/v1\/(?:documentacion|esquemas)\/(identidad|elecciones|actas|resultados)\b/;
const RECURSO_ESTATICO = /\.(?:js|mjs|css|png|jpe?g|svg|webp|ico|ttf|woff2?|map|json|pdf|xlsx|txt)$/i;

// Llamadas internas que el código de cada servicio realiza para esa ruta.
const AUTORIZA = ['identidad'];
const REGISTRO = ['identidad', 'elecciones', 'postgres'];

export function servicioDeRuta(uri) {
  if (uri === '/graphql') return 'gateway';
  if (uri === '/salud') return 'entrada';
  const documento = DOCUMENTACION.exec(uri);
  if (documento) return documento[1];
  for (const [prefijo, servicio] of PREFIJOS) if (uri.startsWith(prefijo)) return servicio;
  if (uri.startsWith('/api/')) return 'entrada';
  return 'frontend';
}

function accionDe(metodo, uri, servicio) {
  if (servicio === 'entrada') {
    if (uri === '/salud') return { accion: 'Sonda de entrada', ramas: [], menor: true };
    if (uri.startsWith('/api/v1/interno') || uri.startsWith('/interno')) return { accion: 'Ruta interna desde fuera', ramas: [] };
    return { accion: 'Ruta inexistente', ramas: [], menor: true };
  }
  if (servicio === 'frontend') {
    return RECURSO_ESTATICO.test(uri)
      ? { accion: 'Recurso del portal', ramas: [], menor: true, estatico: true }
      : { accion: 'Portal web', ramas: [], menor: true };
  }
  if (DOCUMENTACION.test(uri)) return { accion: 'Documentación OpenAPI', ramas: [], menor: true };
  if (servicio === 'gateway') return { accion: 'Portal público (GraphQL)', ramas: ['elecciones', 'resultados'] };
  if (servicio === 'identidad') {
    if (uri === '/api/v1/autenticacion/login') return { accion: 'Inicio de sesión', ramas: ['postgres'] };
    if (uri === '/api/v1/autenticacion/logout') return { accion: 'Cierre de sesión', ramas: ['postgres'] };
    if (uri === '/api/v1/autenticacion/token') return { accion: 'Token JWT', ramas: ['postgres'] };
    if (uri.startsWith('/api/v1/autenticacion')) return { accion: 'Sesión', ramas: ['postgres'], menor: true };
    if (uri.startsWith('/api/v1/importaciones')) return { accion: 'Importación de cuentas', ramas: ['postgres'] };
    return { accion: 'Administración de cuentas', ramas: ['postgres'] };
  }
  if (servicio === 'actas') {
    if (uri === '/api/v1/actas/lectura' && metodo === 'POST') return { accion: 'Lectura OCR del acta', ramas: ['identidad', 'elecciones'] };
    if (uri === '/api/v1/actas' && metodo === 'POST') return { accion: 'Registro de acta', ramas: REGISTRO };
    if (uri.startsWith('/api/v1/actas/mesas/') && metodo === 'PUT') return { accion: 'Corrección de acta', ramas: REGISTRO };
    if (uri.startsWith('/api/v1/actas/mesas/') && metodo === 'DELETE') return { accion: 'Anulación de acta', ramas: REGISTRO };
    if (uri.startsWith('/api/v1/publico/actas')) return { accion: 'Avance público de actas', ramas: ['postgres'] };
    if (uri.endsWith('/foto')) return { accion: 'Fotografía privada del acta', ramas: REGISTRO, menor: true };
    return { accion: 'Consulta de actas', ramas: REGISTRO, menor: true };
  }
  if (servicio === 'elecciones') {
    if (uri.startsWith('/api/v1/mis-mesas')) return { accion: 'Mesas del operador', ramas: [...AUTORIZA, 'postgres'] };
    if (uri.startsWith('/api/v1/mesas')) return { accion: 'Contexto de mesa', ramas: [...AUTORIZA, 'postgres'] };
    if (uri.startsWith('/api/v1/publico')) return { accion: 'Portada pública', ramas: ['postgres'], menor: true };
    return { accion: 'Configuración electoral', ramas: [...AUTORIZA, 'postgres'] };
  }
  if (servicio === 'resultados') {
    if (uri.startsWith('/api/v1/publico/resultados')) return { accion: 'Resultados públicos', ramas: ['redis', 'mongodb'] };
    return { accion: 'Informes', ramas: ['mongodb'] };
  }
  return { accion: 'Solicitud', ramas: [] };
}

export function resultadoDe(estado) {
  if (estado < 400) return 'ok';
  if (estado === 401 || estado === 403) return 'denegado';
  if (estado === 409) return 'conflicto';
  if (estado === 400 || estado === 413 || estado === 422) return 'rechazado';
  if (estado === 429) return 'ocupado';
  if (estado === 404) return 'no-encontrado';
  if (estado >= 502 && estado <= 504) return 'caido';
  return 'error';
}

export const MOTIVOS = {
  ok: 'Completada',
  denegado: 'Permiso denegado',
  conflicto: 'Conflicto de versión o de mesa',
  rechazado: 'Datos rechazados por validación',
  ocupado: 'Servicio ocupado; reintentar',
  'no-encontrado': 'No encontrado',
  caido: 'Servicio no disponible',
  error: 'Error interno',
};

const PUBLICAS = ['gateway', 'frontend'];

export function describirSolicitud({ metodo, uri, estado }) {
  const servicio = servicioDeRuta(uri);
  const { accion, ramas, menor = false, estatico = false } = accionDe(metodo, uri, servicio);
  const resultado = resultadoDe(estado);
  const origen = PUBLICAS.includes(servicio) || uri.startsWith('/api/v1/publico') ? 'publico' : 'operadores';
  let rechazoEn = null;
  if (resultado === 'denegado') rechazoEn = servicio === 'entrada' ? 'entrada' : ramas.includes('identidad') ? 'identidad' : servicio;
  else if (resultado !== 'ok') rechazoEn = servicio;
  return { servicio, accion, ramas, menor, estatico, resultado, motivo: MOTIVOS[resultado], origen, rechazoEn };
}
