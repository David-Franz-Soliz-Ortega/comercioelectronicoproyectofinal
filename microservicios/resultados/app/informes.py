"""CRUD de informes congelados; nunca permite escribir votos manualmente."""
import json
import os
from datetime import datetime, timezone
from uuid import UUID, uuid4
from urllib.request import Request as Peticion, urlopen
from urllib.error import HTTPError, URLError
from fastapi import APIRouter, HTTPException, Request, Query, Response
from pydantic import BaseModel, ConfigDict, Field

router=APIRouter(prefix='/api/v1/informes',tags=['Informes'])


def pedir(url,req,datos=None):
    headers={k:req.headers.get(k,'') for k in ('Cookie','Origin','X-CSRF-Token','X-Organizacion','X-Correlation-ID')}
    headers.update({'Content-Type':'application/json','X-Servicio':'resultados','X-Clave-Servicio':os.environ['CLAVE_SERVICIO']})
    try:
        with urlopen(Peticion(url,headers=headers,data=json.dumps(datos).encode() if datos is not None else None),timeout=4) as r:return json.load(r)
    except HTTPError as e:raise HTTPException(e.code if e.code in (401,403,404) else 503,'Dependencia no disponible') from None
    except (URLError,OSError,TimeoutError):raise HTTPException(503,'Dependencia no disponible') from None


def autorizar(req,escritura=False):
    return pedir(os.environ['IDENTIDAD_URL']+'/api/v1/interno/autorizar',req,{'accion':'informes:administrar' if escritura else 'informes:consultar','idOrganizacion':req.headers.get('X-Organizacion'),'escritura':escritura})


class NuevoInforme(BaseModel):
    model_config=ConfigDict(extra='forbid')
    titulo:str=Field(min_length=1,max_length=120)
    idProceso:UUID


class EditarInforme(BaseModel):
    model_config=ConfigDict(extra='forbid')
    titulo:str=Field(min_length=1,max_length=120)


def visible(fila):return {k:v for k,v in fila.items() if k not in ('_id','idOrganizacion','activo')}|{'id':fila['_id']}


@router.get('')
def listar(req:Request,pagina:int=Query(1,ge=1),limite:int=Query(20,ge=1,le=100),titulo:str|None=Query(None,max_length=120)):
    actor=autorizar(req);filtro={'idOrganizacion':actor['idOrganizacion'],'activo':True}
    if titulo:
        import re
        filtro['titulo']={'$regex':re.escape(titulo),'$options':'i'}
    coleccion=req.app.state.base.informes
    filas=list(coleccion.find(filtro).sort([('creadoEn',-1),('_id',1)]).skip((pagina-1)*limite).limit(limite))
    return {'elementos':[visible(f) for f in filas],'pagina':pagina,'limite':limite,'total':coleccion.count_documents(filtro)}


@router.post('',status_code=201)
def crear(datos:NuevoInforme,req:Request):
    actor=autorizar(req,True)
    proceso=pedir(os.environ['ELECCIONES_URL']+'/api/v1/configuracion/procesos/'+str(datos.idProceso),req)
    # La fuente del informe es el cálculo real, no cantidades proporcionadas por el cliente.
    from .servidor import resultados
    fotografia=resultados(datos.idProceso)
    fila={'_id':str(uuid4()),'idOrganizacion':actor['idOrganizacion'],'idProceso':str(datos.idProceso),'titulo':datos.titulo.strip(),'proceso':{'nombre':proceso['nombre'],'cargo':proceso['cargo']},'resultado':fotografia,'activo':True,'creadoEn':datetime.now(timezone.utc)}
    if not fila['titulo']:raise HTTPException(422,'Título vacío')
    req.app.state.base.informes.insert_one(fila);return visible(fila)


def obtener(identificador,req,escritura=False):
    actor=autorizar(req,escritura)
    fila=req.app.state.base.informes.find_one({'_id':str(identificador),'idOrganizacion':actor['idOrganizacion'],'activo':True})
    if not fila:raise HTTPException(404,'Informe no disponible')
    return fila,actor


@router.get('/{identificador}')
def consultar(identificador:UUID,req:Request):return visible(obtener(identificador,req)[0])


@router.put('/{identificador}')
def editar(identificador:UUID,datos:EditarInforme,req:Request):
    fila,actor=obtener(identificador,req,True);titulo=datos.titulo.strip()
    if not titulo:raise HTTPException(422,'Título vacío')
    cambiado=req.app.state.base.informes.find_one_and_update({'_id':str(identificador),'idOrganizacion':actor['idOrganizacion'],'activo':True},{'$set':{'titulo':titulo}},return_document=True)
    if not cambiado:raise HTTPException(409,'El informe cambió')
    return visible(cambiado)


@router.delete('/{identificador}',status_code=204)
def retirar(identificador:UUID,req:Request):
    fila,actor=obtener(identificador,req,True)
    req.app.state.base.informes.update_one({'_id':str(identificador),'idOrganizacion':actor['idOrganizacion']},{'$set':{'activo':False,'retiradoEn':datetime.now(timezone.utc)}})
    return Response(status_code=204)
