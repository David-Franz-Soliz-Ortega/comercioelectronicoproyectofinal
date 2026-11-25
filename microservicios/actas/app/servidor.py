import json
import hashlib
import os
import threading
import time
from contextlib import asynccontextmanager
from uuid import UUID, uuid4
from typing import Literal
from urllib.request import Request as Peticion, urlopen
from urllib.error import HTTPError, URLError

import pika
import psycopg
from psycopg.rows import dict_row
from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field, StrictInt, model_validator
from .cliente_mesas import consultar_mesa, registro_mesa
from .dominio import decodificar_foto, validar_conteo, huella_solicitud, construir_evento
from .lectura import leer_foto


def conectar():
    return psycopg.connect(host=os.environ['DB_HOST'], port=int(os.getenv('DB_PORT','5432')), dbname=os.environ['DB_NAME'], user=os.environ['DB_USER'], password=os.environ['DB_PASSWORD'], connect_timeout=5, row_factory=dict_row)


def cabeceras(req):
    return {k: req.headers.get(k, '') for k in ('Cookie', 'Origin', 'X-CSRF-Token', 'X-Organizacion')}


def remoto(url, headers, datos=None):
    try:
        with urlopen(Peticion(url, headers={**headers, 'Content-Type': 'application/json'}, data=json.dumps(datos).encode() if datos is not None else None), timeout=4) as r:
            return json.load(r)
    except HTTPError as e:
        raise HTTPException(e.code if e.code in (401, 403, 404) else 503, 'Acceso no disponible') from None
    except (URLError, TimeoutError, OSError):
        raise HTTPException(503, 'Dependencia no disponible') from None


def autorizar(req, escritura=False):
    return remoto(os.getenv('IDENTIDAD_URL', 'http://identidad:3000') + '/api/v1/interno/autorizar', {**cabeceras(req), 'X-Servicio': 'actas', 'X-Clave-Servicio': os.environ['CLAVE_SERVICIO']}, {'accion': 'actas:registrar' if escritura else 'actas:consultar', 'escritura': escritura, 'idOrganizacion': req.headers.get('X-Organizacion')})


ESQUEMA = '''CREATE TABLE IF NOT EXISTS versiones_actas(
 id UUID PRIMARY KEY,id_proceso UUID NOT NULL,id_mesa UUID NOT NULL,id_organizacion UUID NOT NULL,id_operador UUID NOT NULL,
 version INTEGER NOT NULL,id_solicitud UUID NOT NULL,huella TEXT NOT NULL,foto BYTEA NOT NULL,mime TEXT NOT NULL,foto_hash TEXT NOT NULL,
 estado TEXT NOT NULL CHECK(estado IN ('publicada','observada','anulada')),conteo JSONB NOT NULL,creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(id_mesa,version),UNIQUE(id_organizacion,id_operador,id_solicitud));
 DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='versiones_actas'::regclass AND conname='versiones_actas_estado_check' AND position('anulada' IN pg_get_constraintdef(oid))=0) THEN ALTER TABLE versiones_actas DROP CONSTRAINT versiones_actas_estado_check; ALTER TABLE versiones_actas ADD CONSTRAINT versiones_actas_estado_check CHECK(estado IN ('publicada','observada','anulada')); END IF; END $$;
 ALTER TABLE versiones_actas ADD COLUMN IF NOT EXISTS sector TEXT NOT NULL DEFAULT 'general';
 ALTER TABLE versiones_actas ADD COLUMN IF NOT EXISTS id_acta_origen UUID REFERENCES versiones_actas(id);
 CREATE TABLE IF NOT EXISTS bandeja_actas(id UUID PRIMARY KEY,evento JSONB NOT NULL,publicado_en TIMESTAMPTZ);'''


def publicar_pendientes(detener):
    while not detener.is_set():
        try:
            con = pika.BlockingConnection(pika.ConnectionParameters(host=os.environ['RABBITMQ_HOST'], port=int(os.getenv('RABBITMQ_PUERTO','5672')), credentials=pika.PlainCredentials(os.environ['RABBITMQ_USUARIO'], os.environ['RABBITMQ_CLAVE']), heartbeat=20, blocked_connection_timeout=5, socket_timeout=5))
            try:
                canal = con.channel(); canal.exchange_declare(exchange='tuvoto.actas', exchange_type='topic', durable=True); canal.confirm_delivery()
                with conectar() as db:
                    while not detener.is_set():
                        with db.transaction():
                            fila = db.execute('SELECT id,evento FROM bandeja_actas WHERE publicado_en IS NULL ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1').fetchone()
                            if fila:
                                canal.basic_publish(exchange='tuvoto.actas', routing_key='acta.actualizada.v1', body=json.dumps(fila['evento']).encode(), mandatory=True, properties=pika.BasicProperties(content_type='application/json', delivery_mode=2, message_id=str(fila['id'])))
                                db.execute('UPDATE bandeja_actas SET publicado_en=now() WHERE id=%s', (fila['id'],))
                        con.process_data_events(time_limit=0.2)
                        if not fila: detener.wait(1)
            finally:
                if con.is_open: con.close()
        except Exception:
            # Mantener la bandeja pendiente; no imprimir cuerpo, rutas de fotos ni credenciales.
            detener.wait(2)


@asynccontextmanager
async def vida(app):
    with conectar() as db: db.execute(ESQUEMA)
    detener = threading.Event(); hilo = threading.Thread(target=publicar_pendientes, args=(detener,), daemon=True); hilo.start()
    yield
    detener.set(); hilo.join(timeout=7)


app = FastAPI(title='TUVOTO · Actas', lifespan=vida, docs_url=None, version='0.2.0')


@app.middleware('http')
async def limitar(req, siguiente):
    # Acotar también cuerpos fragmentados antes de que el analizador JSON los cargue.
    cuerpo = bytearray()
    async for fragmento in req.stream():
        cuerpo.extend(fragmento)
        if len(cuerpo) > 15000000:
            return Response(status_code=413)
    req._body = bytes(cuerpo)
    return await siguiente(req)


class Voto(BaseModel):
    model_config = ConfigDict(extra='forbid')
    idCandidato: UUID
    cantidad: StrictInt = Field(ge=0, le=1000000)


class NuevaActa(BaseModel):
    model_config = ConfigDict(extra='forbid')
    idMesa: UUID
    idSolicitud: UUID
    versionAnterior: StrictInt = Field(ge=0)
    foto: str | None = Field(default=None,max_length=14000000)
    idActaOrigen: UUID | None = None
    votos: list[Voto] = Field(min_length=1, max_length=100)
    blancos: StrictInt = Field(ge=0, le=1000000)
    nulos: StrictInt = Field(ge=0, le=1000000)
    total: StrictInt = Field(ge=0, le=1000000)
    confirmado: bool

    @model_validator(mode='after')
    def documento_unico(self):
        if bool(self.foto)==bool(self.idActaOrigen):raise ValueError('Sube una fotografía o selecciona un acta de origen, no ambas')
        return self


class FotoParaLectura(BaseModel):
    model_config = ConfigDict(extra='forbid')
    idMesa: UUID | None = None
    candidatas: list[UUID] = Field(default_factory=list, max_length=60, description='Mesas asignadas entre las que se identifica el destino de la foto')
    foto: str = Field(min_length=1, max_length=14000000)

    @model_validator(mode='after')
    def destino_unico(self):
        if bool(self.idMesa) == bool(self.candidatas): raise ValueError('Indica la mesa o las mesas candidatas, no ambas')
        return self


class VotoLeido(BaseModel):
    idCandidato: UUID
    cantidad: int | None = Field(ge=0, le=1000000)


class PropuestaLectura(BaseModel):
    votos: list[VotoLeido]
    blancos: int | None
    nulos: int | None
    total: int | None
    completa: bool
    sumaCoincide: bool | None
    advertencias: list[str]
    requiereRevision: Literal[True]
    motor: Literal['tesseract']
    idMesa: UUID | None = None
    detectada: bool = False
    opciones: list[UUID] = []


@app.post('/api/v1/actas/lectura', response_model=PropuestaLectura, summary='Proponer destino y cifras de una fotografía, sin registrar ni publicar')
def leer(datos: FotoParaLectura, req: Request, respuesta: Response):
    # Mismos permisos/CSRF que el registro, pero sin persistencia ni eventos.
    autorizar(req, True)
    respuesta.headers['Cache-Control'] = 'no-store'
    if datos.idMesa:
        mesa = consultar_mesa(req, datos.idMesa)
        if mesa['estado'] != 'recepcion':
            raise HTTPException(409, 'La recepción está cerrada para esta mesa.')
        mesas = None
    else:
        # Elecciones confirma cada mesa: las ajenas o cerradas no participan en la detección.
        mesas = []
        for identificador in dict.fromkeys(datos.candidatas):
            try:
                candidata = consultar_mesa(req, identificador)
            except HTTPException as e:
                if e.status_code in (403, 404):
                    continue
                raise
            if candidata['estado'] == 'recepcion':
                mesas.append(candidata)
        if not mesas:
            raise HTTPException(409, 'No tienes mesas con la recepción abierta.')
        mesa = None
    try:
        contenido, _, _ = decodificar_foto(datos.foto)
        return leer_foto(contenido, mesa, mesas)
    except ValueError as e:
        raise HTTPException(422, str(e)) from None


@app.get('/api/v1/salud')
def salud():
    with conectar() as db: db.execute('SELECT 1')
    return {'servicio': 'actas', 'estado': 'saludable'}


@app.get('/api/v1/actas/mesa/{id_mesa}')
def consultar(id_mesa: UUID, req: Request):
    actor = autorizar(req)
    consultar_mesa(req,id_mesa)
    with conectar() as db:
        filas = db.execute('SELECT id,version,estado,conteo,creado_en,sector,id_acta_origen AS "idActaOrigen" FROM versiones_actas WHERE id_mesa=%s AND id_organizacion=%s ORDER BY version DESC', (id_mesa, actor['idOrganizacion'])).fetchall()
    return {'elementos': filas, 'versionAnterior': filas[0]['version'] if filas else 0}


@app.get('/api/v1/actas/{id_acta}/foto')
def foto(id_acta: UUID, req: Request):
    actor = autorizar(req)
    with conectar() as db:
        fila = db.execute('SELECT id_mesa,foto,mime FROM versiones_actas WHERE id=%s AND id_organizacion=%s', (id_acta, actor['idOrganizacion'])).fetchone()
    if not fila: raise HTTPException(404, 'Acta no disponible')
    consultar_mesa(req,fila['id_mesa'])
    return Response(bytes(fila['foto']), media_type=fila['mime'], headers={'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})


@app.post('/api/v1/actas', status_code=201)
def registrar(datos: NuevaActa, req: Request):
    actor = autorizar(req, True)
    with registro_mesa(req,datos.idMesa) as mesa:
        return registrar_en_recepcion(datos,req,actor,mesa)

def registrar_en_recepcion(datos,req,actor,mesa):
    if not datos.confirmado: raise HTTPException(422, 'Debe confirmar la comparación con la fotografía')
    d = datos.model_dump(mode='json')
    try:
        if datos.idActaOrigen:
            with conectar() as db:
                origen=db.execute("SELECT id_mesa,id_proceso,foto,mime,foto_hash,sector,estado FROM versiones_actas WHERE id=%s AND id_organizacion=%s",(datos.idActaOrigen,actor['idOrganizacion'])).fetchone()
            if not origen:raise HTTPException(404,'Acta de origen no disponible')
            consultar_mesa(req,origen['id_mesa'])
            if str(origen['id_proceso'])==str(mesa['idProceso']) or origen['estado']=='anulada' or origen['sector']!=mesa.get('sector','general'):
                raise HTTPException(422,'Solo se reutiliza explícitamente una foto de otro cargo y del mismo sector')
            contenido,mime,foto_hash=bytes(origen['foto']),origen['mime'],origen['foto_hash']
        else:
            contenido, mime, foto_hash = decodificar_foto(datos.foto)
        estado = validar_conteo(d['votos'], mesa['candidatos'], datos.blancos, datos.nulos, datos.total)
    except ValueError as e: raise HTTPException(422, str(e)) from None
    huella = huella_solicitud(d, foto_hash)
    with conectar() as db:
        with db.transaction():
            db.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,2))', (actor['idUsuario'] + ':' + str(datos.idSolicitud),))
            db.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))', (str(datos.idMesa),))
            previa = db.execute('SELECT id,version,estado,huella FROM versiones_actas WHERE id_organizacion=%s AND id_operador=%s AND id_solicitud=%s', (actor['idOrganizacion'], actor['idUsuario'], datos.idSolicitud)).fetchone()
            if previa:
                if previa['huella'] != huella: raise HTTPException(409, 'Solicitud reutilizada con otros datos')
                return {k: str(v) if isinstance(v, UUID) else v for k, v in previa.items() if k != 'huella'}
            ultima = db.execute('SELECT coalesce(max(version),0) AS version FROM versiones_actas WHERE id_mesa=%s', (datos.idMesa,)).fetchone()['version']
            if ultima != datos.versionAnterior: raise HTTPException(409, 'La mesa cambió. Consulte su última versión antes de corregir')
            db.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,1))', (mesa['idProceso'] + foto_hash,))
            duplicada = db.execute('SELECT 1 FROM versiones_actas WHERE id_proceso=%s AND foto_hash=%s AND id_mesa<>%s LIMIT 1', (mesa['idProceso'], foto_hash, datos.idMesa)).fetchone()
            if duplicada: raise HTTPException(409, 'La misma fotografía ya está registrada para otra mesa')
            version = ultima + 1; id_acta = uuid4(); id_evento = uuid4()
            conteo = {'votos': d['votos'], 'blancos': datos.blancos, 'nulos': datos.nulos, 'total': datos.total}
            db.execute('INSERT INTO versiones_actas(id,id_proceso,id_mesa,id_organizacion,id_operador,version,id_solicitud,huella,foto,mime,foto_hash,estado,conteo,sector,id_acta_origen) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s)', (id_acta, mesa['idProceso'], datos.idMesa, actor['idOrganizacion'], actor['idUsuario'], version, datos.idSolicitud, huella, contenido, mime, foto_hash, estado, json.dumps(conteo),mesa.get('sector','general'),datos.idActaOrigen))
            aporte = conteo if estado == 'publicada' else None
            if estado == 'observada':
                anterior = db.execute("SELECT conteo FROM versiones_actas WHERE id_mesa=%s AND estado='publicada' AND version>coalesce((SELECT max(version) FROM versiones_actas WHERE id_mesa=%s AND estado='anulada'),0) ORDER BY version DESC LIMIT 1", (datos.idMesa,datos.idMesa)).fetchone()
                if anterior: aporte = anterior['conteo']
            evento = construir_evento(str(id_evento), mesa, version, aporte, estado == 'observada', actor['idOrganizacion'])
            db.execute('INSERT INTO bandeja_actas(id,evento) VALUES(%s,%s::jsonb)', (id_evento, json.dumps(evento)))
    return {'id': str(id_acta), 'version': version, 'estado': estado}


# El control es interno por REST de identidad; declarar también el contrato de sesión.
def contrato_openapi():
    if app.openapi_schema is None:
        from fastapi.openapi.utils import get_openapi
        esquema = get_openapi(title=app.title, version=app.version, routes=app.routes)
        esquema.setdefault('components', {}).setdefault('securitySchemes', {})['sesion'] = {'type': 'apiKey', 'in': 'cookie', 'name': 'tuvoto-sesion'}
        for ruta, operaciones in esquema['paths'].items():
            if ruta.startswith('/api/v1/actas'):
                for operacion in operaciones.values():
                    operacion['security'] = [{'sesion': []}]
        app.openapi_schema = esquema
    return app.openapi_schema
app.openapi = contrato_openapi

# El control real está en autorizar(); documentarlo también en el contrato publicado.
_openapi_original = app.openapi

def documentacion():
    contrato = _openapi_original()
    contrato.setdefault('components', {}).setdefault('securitySchemes', {})['sesion'] = {'type': 'apiKey', 'in': 'cookie', 'name': 'tuvoto-sesion'}
    for ruta, metodos in contrato['paths'].items():
        if ruta.startswith('/api/v1/actas'):
            for operacion in metodos.values():
                operacion['security'] = [{'sesion': []}]
                if any(metodos.get(m) is operacion for m in ('post','put','delete')):operacion.setdefault('responses',{})['409']={'description':'Recepción cerrada, versión o solicitud en conflicto; sin cambios'}
                operacion['description'] = 'Requiere OPERADOR asignado. Escrituras solo en recepción: Origin autorizado, cookie CSRF y X-CSRF-Token. No acepta identidad del cliente.'
    return contrato

app.openapi = documentacion


@app.get('/api/v1/publico/actas/{id_proceso}/avance')
def avance_publico(id_proceso:UUID):
    actual = remoto(os.environ['ELECCIONES_URL']+'/api/v1/publico/procesos/'+str(id_proceso),{})
    if not actual or actual['id']!=str(id_proceso):raise HTTPException(404,'Proceso no publicado')
    with conectar() as db:
        fila=db.execute('SELECT count(DISTINCT id_mesa)::int AS "mesasConActa",count(*)::int AS versiones FROM versiones_actas WHERE id_proceso=%s',(id_proceso,)).fetchone()
    return {'idProceso':str(id_proceso),**fila}


@app.get('/docs',include_in_schema=False)
def documentacion_interactiva():
    from fastapi.openapi.docs import get_swagger_ui_html
    return get_swagger_ui_html(openapi_url='/api/v1/esquemas/actas',title='TUVOTO · actas')


@app.get('/api/v1/actas')
def listar_actas(req:Request,pagina:int=Query(1,ge=1),limite:int=Query(20,ge=1,le=100),estado:str|None=None):
    actor=autorizar(req)
    if estado not in (None,'publicada','observada','anulada'):raise HTTPException(422,'Estado inválido')
    valores=[actor['idOrganizacion'],bool(actor.get('esAuditor')),actor['idUsuario']]
    where='id_organizacion=%s AND (%s OR id_operador=%s)'
    if estado:where+=' AND estado=%s';valores.append(estado)
    with conectar() as db:
        total=db.execute('SELECT count(*)::int AS n FROM versiones_actas WHERE '+where,valores).fetchone()['n']
        filas=db.execute('SELECT id,id_mesa,id_mesa AS "idMesa",id_proceso AS "idProceso",sector,version,estado,creado_en FROM versiones_actas WHERE '+where+' ORDER BY creado_en,id LIMIT %s OFFSET %s',[*valores,limite,(pagina-1)*limite]).fetchall()
    return {'elementos':filas,'pagina':pagina,'limite':limite,'total':total}


@app.put('/api/v1/actas/mesas/{id_mesa}')
def corregir_acta(id_mesa:UUID,datos:NuevaActa,req:Request):
    if id_mesa!=datos.idMesa or datos.versionAnterior<1:raise HTTPException(422,'Se requiere mesa y versión vigente para corregir')
    return registrar(datos,req)


class Anulacion(BaseModel):
    model_config=ConfigDict(extra='forbid')
    idSolicitud:UUID
    versionAnterior:StrictInt=Field(ge=1)
    motivo:str=Field(min_length=5,max_length=500)


@app.delete('/api/v1/actas/mesas/{id_mesa}',status_code=204)
def anular_acta(id_mesa:UUID,datos:Anulacion,req:Request):
    actor=autorizar(req,True)
    with registro_mesa(req,id_mesa) as mesa:
        return anular_en_recepcion(id_mesa,datos,req,actor,mesa)

def anular_en_recepcion(id_mesa,datos,req,actor,mesa):
    huella=hashlib.sha256(('anulacion:'+str(id_mesa)+json.dumps(datos.model_dump(mode='json'),sort_keys=True)).encode()).hexdigest()
    with conectar() as db:
        with db.transaction():
            db.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,2))',(actor['idUsuario']+':'+str(datos.idSolicitud),))
            db.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))',(str(id_mesa),))
            previa=db.execute('SELECT huella FROM versiones_actas WHERE id_organizacion=%s AND id_operador=%s AND id_solicitud=%s',(actor['idOrganizacion'],actor['idUsuario'],datos.idSolicitud)).fetchone()
            if previa:
                if previa['huella']!=huella:raise HTTPException(409,'Solicitud reutilizada')
                return Response(status_code=204)
            ultima=db.execute('SELECT * FROM versiones_actas WHERE id_mesa=%s AND id_organizacion=%s ORDER BY version DESC LIMIT 1',(id_mesa,actor['idOrganizacion'])).fetchone()
            if not ultima:raise HTTPException(404,'Acta no disponible')
            if ultima['version']!=datos.versionAnterior:raise HTTPException(409,'La mesa cambió')
            if ultima['estado']=='anulada':return Response(status_code=204)
            version=ultima['version']+1;identificador=uuid4();id_evento=uuid4()
            conteo={**ultima['conteo'],'motivoAnulacion':datos.motivo}
            db.execute("INSERT INTO versiones_actas(id,id_proceso,id_mesa,id_organizacion,id_operador,version,id_solicitud,huella,foto,mime,foto_hash,estado,conteo,sector,id_acta_origen) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'anulada',%s::jsonb,%s,%s)",(identificador,mesa['idProceso'],id_mesa,actor['idOrganizacion'],actor['idUsuario'],version,datos.idSolicitud,huella,ultima['foto'],ultima['mime'],ultima['foto_hash'],json.dumps(conteo),ultima['sector'],ultima['id_acta_origen']))
            evento=construir_evento(str(id_evento),mesa,version,None,False,actor['idOrganizacion'])
            db.execute('INSERT INTO bandeja_actas(id,evento) VALUES(%s,%s::jsonb)',(id_evento,json.dumps(evento)))
    return Response(status_code=204)

from .http import instalar_http
instalar_http(app,'actas')
