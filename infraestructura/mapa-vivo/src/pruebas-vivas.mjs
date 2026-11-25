// Acciones del presentador que generan tráfico real a través de NGINX.
// Las respuestas provienen de los servicios; aquí no se fabrica ningún estado.
import { randomUUID } from 'node:crypto';
import { percentil } from './estadisticas.mjs';

export function crearPruebasVivas({ entradaUrl, origen, pedir = fetch }) {
  let rafagaEnCurso = false;

  async function solicitar(ruta, opciones, etiqueta) {
    const respuesta = await pedir(entradaUrl + ruta, { ...opciones, headers: { ...opciones.headers, 'X-Mapa-Vivo-Prueba': etiqueta }, signal: AbortSignal.timeout(5000) });
    await respuesta.arrayBuffer().catch(() => {});
    return respuesta.status;
  }

  return {
    // Registro de un acta con una cookie de sesión inventada: Identidad debe rechazarla.
    async ataqueSesion() {
      const cuerpo = { idMesa: randomUUID(), idSolicitud: randomUUID(), versionAnterior: 0, idActaOrigen: randomUUID(),
        votos: [{ idCandidato: randomUUID(), cantidad: 999 }], blancos: 0, nulos: 0, total: 999, confirmado: true };
      const estado = await solicitar('/api/v1/actas', { method: 'POST', body: JSON.stringify(cuerpo),
        headers: { 'Content-Type': 'application/json', Cookie: 'tuvoto-sesion=sesion-falsificada-en-demostracion', Origin: origen, 'X-CSRF-Token': 'falso' } }, 'ataque');
      return { tipo: 'ataque-sesion', estado };
    },
    // Una ruta interna entre servicios no debe ser accesible desde fuera.
    async ataqueInterno() {
      const estado = await solicitar('/api/v1/interno/autorizar', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }, 'ataque');
      return { tipo: 'ataque-interno', estado };
    },
    async rafaga({ cantidad = 300, concurrencia = 24, idProceso = null } = {}) {
      if (rafagaEnCurso) throw Object.assign(new Error('Ya hay una ráfaga en curso'), { estado: 409 });
      rafagaEnCurso = true;
      const ruta = idProceso ? `/api/v1/publico/resultados/${encodeURIComponent(idProceso)}` : '/api/v1/publico/eventos';
      const tiempos = [];
      let correctas = 0;
      let siguiente = 0;
      const inicio = performance.now();
      try {
        await Promise.all(Array.from({ length: Math.min(concurrencia, cantidad) }, async () => {
          while (siguiente < cantidad) {
            siguiente += 1;
            const t = performance.now();
            try {
              const estado = await solicitar(ruta, { method: 'GET' }, 'rafaga');
              if (estado < 400) correctas += 1;
            } catch { /* cuenta como fallida */ }
            tiempos.push(performance.now() - t);
          }
        }));
      } finally {
        rafagaEnCurso = false;
      }
      return { tipo: 'rafaga', cantidad, correctas, fallidas: cantidad - correctas, duracionMs: Math.round(performance.now() - inicio), p95Ms: Math.round(percentil(tiempos, 95) ?? 0), ruta: idProceso ? 'resultados' : 'portada' };
    },
  };
}
