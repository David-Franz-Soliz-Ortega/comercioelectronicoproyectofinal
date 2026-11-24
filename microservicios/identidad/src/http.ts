import type { Express, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0];

export function instalarHttp(app: Express, servicio: string) {
  const solicitudes = new Map<string, number>();
  let duracionSum = 0;
  let duracionCount = 0;
  const duracionBuckets = new Map<number, number>();
  BUCKETS.forEach(b => duracionBuckets.set(b, 0));

  app.get('/metrics', (_req: Request, res: Response) => {
    const lineas = [
      '# HELP tuvoto_http_requests_total Total de solicitudes HTTP procesadas',
      '# TYPE tuvoto_http_requests_total counter',
    ];
    if (solicitudes.size === 0) {
      lineas.push(`tuvoto_http_requests_total{servicio="${servicio}",metodo="GET",estado="200"} 0`);
    } else {
      for (const [clave, val] of solicitudes.entries()) {
        const [metodo, estado] = clave.split(':');
        lineas.push(`tuvoto_http_requests_total{servicio="${servicio}",metodo="${metodo}",estado="${estado}"} ${val}`);
      }
    }
    lineas.push(
      '# HELP tuvoto_http_request_duration_seconds Duracion de solicitudes HTTP en segundos',
      '# TYPE tuvoto_http_request_duration_seconds histogram'
    );
    for (const b of BUCKETS) {
      lineas.push(`tuvoto_http_request_duration_seconds_bucket{servicio="${servicio}",le="${b}"} ${duracionBuckets.get(b) ?? 0}`);
    }
    lineas.push(`tuvoto_http_request_duration_seconds_bucket{servicio="${servicio}",le="+Inf"} ${duracionCount}`);
    lineas.push(`tuvoto_http_request_duration_seconds_sum{servicio="${servicio}"} ${duracionSum.toFixed(6)}`);
    lineas.push(`tuvoto_http_request_duration_seconds_count{servicio="${servicio}"} ${duracionCount}`);
    lineas.push(
      '# HELP tuvoto_actas_contabilizadas_total Total de actas contabilizadas',
      '# TYPE tuvoto_actas_contabilizadas_total counter',
      `tuvoto_actas_contabilizadas_total{servicio="${servicio}"} 0`,
      '# HELP tuvoto_votos_validos_total Total de votos validos escrutados',
      '# TYPE tuvoto_votos_validos_total counter',
      `tuvoto_votos_validos_total{servicio="${servicio}"} 0`
    );
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(lineas.join('\n') + '\n');
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/metrics') return next();
    const recibido = req.header('X-Correlation-ID') ?? '';
    const id = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(recibido) ? recibido : randomUUID();
    req.headers['x-correlation-id'] = id;
    res.set('X-Correlation-ID', id);
    const inicio = performance.now();
    const enviar = res.json.bind(res);
    res.json = (contenido: any) =>
      res.statusCode >= 400
        ? enviar({
            type: 'about:blank',
            title: 'Operación no completada',
            status: res.statusCode,
            detail: contenido?.detalle ?? contenido?.detail ?? 'Revisa la solicitud',
            instance: req.path,
            idCorrelacion: id,
          })
        : enviar(contenido);

    res.on('finish', () => {
      const ms = performance.now() - inicio;
      const segundos = ms / 1000;
      const clave = `${req.method}:${res.statusCode}`;
      solicitudes.set(clave, (solicitudes.get(clave) ?? 0) + 1);
      duracionSum += segundos;
      duracionCount += 1;
      for (const b of BUCKETS) {
        if (segundos <= b) {
          duracionBuckets.set(b, (duracionBuckets.get(b) ?? 0) + 1);
        }
      }
      console.log(JSON.stringify({ servicio, idCorrelacion: id, metodo: req.method, ruta: req.route?.path ?? 'recurso', estado: res.statusCode, duracionMs: Math.round(ms) }));
    });
    next();
  });
}
