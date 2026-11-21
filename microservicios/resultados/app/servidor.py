import hashlib
import redis
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from uuid import UUID
from urllib.request import urlopen
from urllib.error import HTTPError, URLError
from fastapi import FastAPI, HTTPException
from .configuracion import conectar_mongo
from .proyeccion import resumir
from .modelos import Resultado


@asynccontextmanager
async def vida(app):
    cliente, base = conectar_mongo(); app.state.cliente = cliente; app.state.base = base
    base.informes.create_index([('idOrganizacion',1),('activo',1),('creadoEn',-1)])
    yield
    cliente.close()


app = FastAPI(title='TUVOTO · Resultados preliminares', lifespan=vida, docs_url=None, version='0.2.0')


@app.get('/api/v1/salud')
def salud():
    app.state.cliente.admin.command('ping')
    desde = datetime.now(timezone.utc) - timedelta(seconds=20)
    vivos = {r['_id'] for r in app.state.base.salud_consumidores.find({'instante': {'$gte': desde}})}
    if not {'conteo', 'auditoria'}.issubset(vivos): raise HTTPException(503, 'Consumidores no disponibles')
    return {'servicio': 'resultados', 'estado': 'saludable'}


@app.get('/api/v1/publico/resultados/{id_proceso}',response_model=Resultado)
def resultados(id_proceso: UUID, unidad: str | None = None):
    try:
        with urlopen(os.environ['ELECCIONES_URL']+'/api/v1/publico/procesos/'+str(id_proceso), timeout=4) as r: proceso = json.load(r)
    except HTTPError as error:
        raise HTTPException(404 if error.code==404 else 503,'Proceso no publicado o configuración no disponible') from None
    except (URLError, OSError, ValueError): raise HTTPException(503, 'Configuración no disponible') from None
    if not proceso or proceso['id'] != str(id_proceso): raise HTTPException(404, 'Elección no publicada')
    if unidad:
        mesas_unidad = [m for m in proceso['mesas'] if m['unidad'] == unidad]
        if not mesas_unidad: raise HTTPException(404, 'Unidad no configurada')
        proceso = {**proceso, 'mesas': mesas_unidad, 'filtroUnidad':True}
    cache = redis.Redis(host=os.getenv('REDIS_HOST','cache-redis'),socket_connect_timeout=1,socket_timeout=1)
    clave = 'tuvoto:publico:'+str(id_proceso)+':'+hashlib.sha256(json.dumps(proceso,sort_keys=True).encode()).hexdigest()
    try:
        guardado = cache.get(clave)
        if guardado: return json.loads(guardado)
    except redis.RedisError: pass
    mesas = list(app.state.base.mesas_actas.find({'idProceso': str(id_proceso), 'idMesa': {'$in': [m['id'] for m in proceso['mesas']]}}))
    resultado = resumir(proceso, mesas)
    resultado['actualizadoEn'] = max((m['actualizadoEn'] for m in mesas if m.get('actualizadoEn') is not None), default=None)
    try: cache.setex(clave,3,json.dumps(resultado,default=lambda valor:valor.isoformat()))
    except redis.RedisError: pass
    return resultado


@app.get('/docs',include_in_schema=False)
def documentacion_interactiva():
    from fastapi.openapi.docs import get_swagger_ui_html
    return get_swagger_ui_html(openapi_url='/api/v1/esquemas/resultados',title='TUVOTO · resultados')

from .informes import router as informes
app.include_router(informes)

from .http import instalar_http
instalar_http(app,'resultados')
