from starlette.concurrency import run_in_threadpool
from app.autorizacion import autorizar, comprobar_eleccion, Acceso
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse
from pymongo.errors import PyMongoError
from starlette.exceptions import HTTPException

from app.configuracion import conectar_mongo


@asynccontextmanager
async def ciclo_vida(app):
    cliente, base = conectar_mongo()
    app.state.cliente = cliente
    app.state.base = base
    yield
    cliente.close()


app = FastAPI(title="SIGAPE: conteo de registros sintéticos", version="1.0.0", lifespan=ciclo_vida)


def problema(solicitud, codigo, detalle):
    return JSONResponse(status_code=codigo, media_type="application/problem+json", content={
        "type": "about:blank", "title": "Error de solicitud", "status": codigo,
        "detail": detalle, "instance": solicitud.url.path,
        "idCorrelacion": getattr(solicitud.state, "correlacion", ""),
    })


@app.middleware("http")
async def controlar_acceso(solicitud: Request,siguiente):
    if not solicitud.url.path.startswith('/api/v1/resultados/'):return await siguiente(solicitud)
    try:
        await run_in_threadpool(autorizar,solicitud,'resultados:leer')
        identificador=solicitud.url.path.split('/')[4]
        await run_in_threadpool(comprobar_eleccion,solicitud,identificador)
        return await siguiente(solicitud)
    except Acceso as e:
        return JSONResponse(status_code=e.codigo,media_type='application/problem+json',content={'type':'about:blank','title':'Acceso no disponible','status':e.codigo,'detail':'Sesión requerida' if e.codigo==401 else 'Permiso denegado' if e.codigo==403 else 'Elección no disponible'})


@app.middleware("http")
async def correlacion(solicitud: Request, siguiente):
    solicitud.state.correlacion = solicitud.headers.get("X-Correlation-ID") or str(uuid4())
    respuesta = await siguiente(solicitud)
    respuesta.headers["X-Correlation-ID"] = solicitud.state.correlacion
    return respuesta


@app.exception_handler(RequestValidationError)
async def error_validacion(solicitud, error):
    return problema(solicitud, 422, "El identificador debe ser UUID")


@app.exception_handler(HTTPException)
async def error_http(solicitud, error):
    return problema(solicitud, error.status_code, str(error.detail))


@app.exception_handler(PyMongoError)
async def error_persistencia(solicitud, error):
    return problema(solicitud, 503, "Persistencia no disponible")


@app.get("/api/v1/salud")
def salud(solicitud: Request):
    try:
        solicitud.app.state.cliente.admin.command("ping")
        limite = datetime.now(timezone.utc) - timedelta(seconds=15)
        activos = {fila["_id"] for fila in solicitud.app.state.base.salud_consumidores.find({"instante": {"$gte": limite}})}
        estados = {nombre: nombre in activos for nombre in ("conteo", "auditoria")}
        disponible = all(estados.values())
        return JSONResponse(status_code=200 if disponible else 503, content={
            "servicio": "resultados", "mongodb": True, "consumidores": estados,
        })
    except PyMongoError:
        return JSONResponse(status_code=503, content={"servicio": "resultados", "mongodb": False})


@app.get("/api/v1/resultados/{idEleccion}")
def consultar(idEleccion: UUID, solicitud: Request):
    total = solicitud.app.state.base.registros_conteo.count_documents({"idEleccion": str(idEleccion)})
    return {"idEleccion": str(idEleccion), "totalRegistros": total}


@app.get("/api/v1/resultados/{idEleccion}/auditoria")
def consultar_auditoria(idEleccion: UUID, solicitud: Request):
    total = solicitud.app.state.base.registros_auditoria.count_documents({"idEleccion": str(idEleccion)})
    return {"idEleccion": str(idEleccion), "totalEventosAuditados": total}


@app.get("/openapi.yaml", include_in_schema=False)
def contrato():
    return FileResponse("/app/contrato.yaml", media_type="application/yaml")
