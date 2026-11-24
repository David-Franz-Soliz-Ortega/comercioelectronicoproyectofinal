import json
import logging
import time
from collections import defaultdict
from uuid import uuid4, UUID
from fastapi import HTTPException, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

BUCKETS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0)


class MetricasPrometheus:
    def __init__(self, servicio: str):
        self.servicio = servicio
        self.solicitudes = defaultdict(int)
        self.duracion_sum = 0.0
        self.duracion_count = 0
        self.duracion_buckets = defaultdict(int)
        self.actas_contabilizadas = 0
        self.votos_validos = 0
        self.mesas_total = 100

    def registrar(self, metodo: str, estado: int, duracion_segundos: float):
        self.solicitudes[(metodo, str(estado))] += 1
        self.duracion_sum += duracion_segundos
        self.duracion_count += 1
        for b in BUCKETS:
            if duracion_segundos <= b:
                self.duracion_buckets[b] += 1

    def generar_texto(self) -> str:
        lineas = [
            '# HELP tuvoto_http_requests_total Total de solicitudes HTTP procesadas',
            '# TYPE tuvoto_http_requests_total counter',
        ]
        if not self.solicitudes:
            lineas.append(f'tuvoto_http_requests_total{{servicio="{self.servicio}",metodo="GET",estado="200"}} 0')
        for (metodo, estado), cantidad in self.solicitudes.items():
            lineas.append(f'tuvoto_http_requests_total{{servicio="{self.servicio}",metodo="{metodo}",estado="{estado}"}} {cantidad}')

        lineas.extend([
            '# HELP tuvoto_http_request_duration_seconds Duracion de solicitudes HTTP en segundos',
            '# TYPE tuvoto_http_request_duration_seconds histogram',
        ])
        for b in BUCKETS:
            c = self.duracion_buckets[b]
            lineas.append(f'tuvoto_http_request_duration_seconds_bucket{{servicio="{self.servicio}",le="{b}"}} {c}')
        lineas.append(f'tuvoto_http_request_duration_seconds_bucket{{servicio="{self.servicio}",le="+Inf"}} {self.duracion_count}')
        lineas.append(f'tuvoto_http_request_duration_seconds_sum{{servicio="{self.servicio}"}} {self.duracion_sum:.6f}')
        lineas.append(f'tuvoto_http_request_duration_seconds_count{{servicio="{self.servicio}"}} {self.duracion_count}')

        lineas.extend([
            '# HELP tuvoto_actas_contabilizadas_total Total de actas contabilizadas',
            '# TYPE tuvoto_actas_contabilizadas_total counter',
            f'tuvoto_actas_contabilizadas_total{{servicio="{self.servicio}"}} {self.actas_contabilizadas}',
            '# HELP tuvoto_votos_validos_total Total de votos validos escrutados',
            '# TYPE tuvoto_votos_validos_total counter',
            f'tuvoto_votos_validos_total{{servicio="{self.servicio}"}} {self.votos_validos}',
            '# HELP tuvoto_mesas_total Total de mesas electorales',
            '# TYPE tuvoto_mesas_total gauge',
            f'tuvoto_mesas_total{{servicio="{self.servicio}"}} {self.mesas_total}',
        ])
        return '\n'.join(lineas) + '\n'


def instalar_http(app, servicio):
    metricas = MetricasPrometheus(servicio)
    app.state.metricas = metricas

    def problema(req, estado, detalle):
        return JSONResponse(status_code=estado, media_type='application/problem+json', content={'type': 'about:blank', 'title': 'Operación no completada', 'status': estado, 'detail': detalle, 'instance': req.url.path, 'idCorrelacion': getattr(req.state, 'correlacion', '')})

    @app.exception_handler(HTTPException)
    async def http_error(req, error):
        return problema(req, error.status_code, str(error.detail))

    @app.exception_handler(RequestValidationError)
    async def entrada_invalida(req, _error):
        return problema(req, 422, 'Revisa los campos y formatos requeridos')

    @app.exception_handler(Exception)
    async def fallo(req, _error):
        return problema(req, 500, 'No se pudo completar la operación')

    @app.get('/metrics', include_in_schema=False)
    def obtener_metricas():
        try:
            if hasattr(app.state, 'base') and app.state.base is not None:
                metricas.actas_contabilizadas = app.state.base.mesas_actas.count_documents({})
        except Exception:
            pass
        return Response(content=metricas.generar_texto(), media_type='text/plain; version=0.0.4; charset=utf-8')

    @app.middleware('http')
    async def registrar(req, siguiente):
        recibido = req.headers.get('X-Correlation-ID', '')
        try:
            identificador = str(UUID(recibido))
        except ValueError:
            identificador = str(uuid4())
        req.state.correlacion = identificador
        inicio = time.monotonic()
        respuesta = await siguiente(req)
        duracion = time.monotonic() - inicio
        metricas.registrar(req.method, respuesta.status_code, duracion)
        respuesta.headers['X-Correlation-ID'] = identificador
        logging.getLogger('uvicorn.error').info(json.dumps({'servicio': servicio, 'idCorrelacion': identificador, 'metodo': req.method, 'estado': respuesta.status_code, 'duracionMs': round(duracion * 1000)}))
        return respuesta
