// Recibe el registro de acceso de NGINX por syslog UDP (ver nginx-registro.conf).
// El formato excluye consultas, cabeceras y cookies; la dirección del cliente
// solo se usa para contar dispositivos y se descarta tras resumirla.
import dgram from 'node:dgram';

export function interpretarLinea(texto) {
  const inicio = texto.indexOf('{');
  if (inicio < 0) return null;
  let datos;
  try { datos = JSON.parse(texto.slice(inicio)); } catch { return null; }
  const estado = Number(datos.s);
  const segundos = Number(datos.t);
  if (typeof datos.m !== 'string' || typeof datos.u !== 'string' || !Number.isInteger(estado)) return null;
  return {
    metodo: datos.m.slice(0, 10),
    uri: datos.u.slice(0, 300),
    estado,
    ms: Number.isFinite(segundos) ? Math.round(segundos * 1000) : null,
    cliente: typeof datos.c === 'string' ? datos.c : '',
    prueba: typeof datos.p === 'string' ? datos.p.slice(0, 20) : '',
  };
}

export function escucharEntrada({ puerto, alRecibir, host = '0.0.0.0' }) {
  const socket = dgram.createSocket('udp4');
  socket.on('message', mensaje => {
    const linea = interpretarLinea(mensaje.toString('utf8'));
    if (linea) alRecibir(linea);
  });
  socket.on('error', error => console.error(JSON.stringify({ componente: 'entrada', error: error.code ?? 'socket' })));
  socket.bind(puerto, host);
  return socket;
}
