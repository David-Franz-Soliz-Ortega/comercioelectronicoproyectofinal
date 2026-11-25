// Observa RabbitMQ sin intervenir en el conteo: una cola propia, exclusiva y
// temporal recibe copia de acta.actualizada.v1, y las colas de Resultados se
// consultan en modo pasivo (checkQueue no crea ni consume mensajes).
import amqp from 'amqplib';

const INTERCAMBIO = 'tuvoto.actas';
const CLAVE = 'acta.actualizada.v1';
export const COLAS = ['resultados.conteo.v1', 'resultados.auditoria.v1', 'resultados.conteo.v1.dlq', 'resultados.auditoria.v1.dlq'];

export function iniciarMensajeria({ url, alEvento, intervalo = 1000, conectar = amqp.connect }) {
  const estado = { conectada: false, colas: {} };
  let detenido = false;
  let conexion = null;
  let temporizador = null;

  let revisando = false;

  async function revisarColas() {
    if (!conexion || revisando) return;
    revisando = true;
    const colas = {};
    for (const nombre of COLAS) {
      let canal = null;
      try {
        // Canal por consulta: si la cola aún no existe, RabbitMQ cierra solo ese canal.
        canal = await conexion.createChannel();
        canal.on('error', () => {});
        const { messageCount, consumerCount } = await canal.checkQueue(nombre);
        colas[nombre] = { mensajes: messageCount, consumidores: consumerCount };
      } catch {
        colas[nombre] = null;
      } finally {
        try { await canal?.close(); } catch { /* canal ya cerrado por el broker */ }
      }
    }
    if (conexion) estado.colas = colas;
    revisando = false;
  }

  async function ciclo() {
    while (!detenido) {
      try {
        conexion = await conectar(url, { timeout: 5000 });
        const cerrada = new Promise(resolver => { conexion.on('close', resolver); conexion.on('error', () => {}); });
        const canal = await conexion.createChannel();
        await canal.assertExchange(INTERCAMBIO, 'topic', { durable: true });
        const { queue } = await canal.assertQueue('', { exclusive: true, autoDelete: true, durable: false, arguments: { 'x-max-length': 1000, 'x-message-ttl': 60_000 } });
        await canal.bindQueue(queue, INTERCAMBIO, CLAVE);
        await canal.consume(queue, mensaje => {
          if (!mensaje) return;
          try { alEvento(JSON.parse(mensaje.content.toString('utf8'))); } catch { /* evento ilegible: se ignora */ }
        }, { noAck: true });
        estado.conectada = true;
        await revisarColas();
        temporizador = setInterval(() => { revisarColas().catch(() => {}); }, intervalo);
        await cerrada;
      } catch {
        // Sin credenciales ni cuerpos en el registro.
      } finally {
        clearInterval(temporizador);
        estado.conectada = false;
        estado.colas = {};
        try { await conexion?.close(); } catch { /* ya cerrada */ }
        conexion = null;
      }
      if (!detenido) await new Promise(resolver => setTimeout(resolver, 2000));
    }
  }

  ciclo();
  return {
    estado: () => estado,
    async detener() { detenido = true; clearInterval(temporizador); try { await conexion?.close(); } catch { /* ya cerrada */ } },
  };
}
