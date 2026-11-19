import json
import logging
import time
from uuid import uuid4, UUID
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def instalar_http(app,servicio):
    def problema(req,estado,detalle):
        return JSONResponse(status_code=estado,media_type='application/problem+json',content={'type':'about:blank','title':'Operación no completada','status':estado,'detail':detalle,'instance':req.url.path,'idCorrelacion':getattr(req.state,'correlacion','')})
    @app.exception_handler(HTTPException)
    async def http_error(req,error):return problema(req,error.status_code,str(error.detail))
    @app.exception_handler(RequestValidationError)
    async def entrada_invalida(req,_error):return problema(req,422,'Revisa los campos y formatos requeridos')
    @app.exception_handler(Exception)
    async def fallo(req,_error):return problema(req,500,'No se pudo completar la operación')
    @app.middleware('http')
    async def registrar(req,siguiente):
        recibido=req.headers.get('X-Correlation-ID','')
        try:identificador=str(UUID(recibido))
        except ValueError:identificador=str(uuid4())
        req.state.correlacion=identificador;inicio=time.monotonic()
        respuesta=await siguiente(req)
        respuesta.headers['X-Correlation-ID']=identificador
        logging.getLogger('uvicorn.error').info(json.dumps({'servicio':servicio,'idCorrelacion':identificador,'metodo':req.method,'estado':respuesta.status_code,'duracionMs':round((time.monotonic()-inicio)*1000)}))
        return respuesta
