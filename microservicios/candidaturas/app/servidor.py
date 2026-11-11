import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import FastAPI, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pymongo import ASCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.errors import PyMongoError

cliente = MongoClient(
    host=os.environ.get("MONGODB_HOST", "base-mongodb"),
    port=int(os.environ.get("MONGODB_PORT", "27017")),
    username=os.environ.get("MONGODB_USERNAME"),
    password=os.environ.get("MONGODB_PASSWORD"),
    authSource=os.environ.get("MONGODB_AUTH_SOURCE", "admin"),
    serverSelectionTimeoutMS=2000,
    connectTimeoutMS=2000,
    socketTimeoutMS=3000,
    waitQueueTimeoutMS=2000,
    maxPoolSize=5,
    minPoolSize=0,
    maxIdleTimeMS=10000,
    tz_aware=True,
)
base = cliente[os.environ.get("MONGODB_DATABASE", "candidaturas_db")]
coleccion: Collection = base["candidaturas"]
estados = {"borrador", "pendiente", "aprobada", "rechazada", "retirada"}
tipos = {"individual", "lista"}


class NuevaCandidatura(BaseModel):
    model_config = ConfigDict(extra="forbid")
    idEleccion: UUID
    nombre: str = Field(min_length=1, max_length=120)
    tipo: str
    estado: str

    @field_validator("nombre", mode="before")
    @classmethod
    def normalizar_nombre(cls, valor):
        return valor.strip() if isinstance(valor, str) else valor


def problema(estado: int, titulo: str, detalle: str, ruta: str, correlacion: str) -> JSONResponse:
    return JSONResponse(
        status_code=estado,
        media_type="application/problem+json",
        content={
            "type": f"https://sigape.local/problemas/{estado}",
            "title": titulo,
            "status": estado,
            "detail": detalle,
            "instance": ruta,
            "idCorrelacion": correlacion,
        },
    )


def representar(documento: dict) -> dict:
    return {
        "idCandidatura": documento["_id"],
        "idEleccion": documento["idEleccion"],
        "nombre": documento["nombre"],
        "tipo": documento["tipo"],
        "estado": documento["estado"],
        "creadoEn": documento["creadoEn"].isoformat(timespec="milliseconds"),
        "actualizadoEn": documento["actualizadoEn"].isoformat(timespec="milliseconds"),
    }


@asynccontextmanager
async def ciclo_vida(_aplicacion: FastAPI):
    try:
        cliente.admin.command("ping")
        coleccion.create_index([("estado", ASCENDING), ("creadoEn", ASCENDING)])
        coleccion.create_index([("idEleccion", ASCENDING), ("estado", ASCENDING)])
        yield
    finally:
        cliente.close()


app = FastAPI(title="Propuesta de API de candidaturas SIGAPE", version="1.0.0", docs_url=None, redoc_url=None, openapi_url=None, lifespan=ciclo_vida)


@app.middleware("http")
async def correlacionar(request: Request, call_next):
    correlacion = request.headers.get("X-Correlation-ID", str(uuid4()))[:128]
    request.state.id_correlacion = correlacion
    ruta = request.scope["path"]
    if ruta.startswith("/api/v1/"):
        request.scope["path"] = ruta[len("/api/v1") :]
        request.scope["raw_path"] = request.scope["path"].encode()
    respuesta = await call_next(request)
    respuesta.headers["X-Correlation-ID"] = correlacion
    return respuesta


@app.exception_handler(RequestValidationError)
async def error_validacion(request: Request, error: RequestValidationError):
    detalle = "; ".join(f"{'.'.join(map(str, item['loc']))}: {item['msg']}" for item in error.errors())
    return problema(422, "Datos inválidos", detalle, request.url.path, request.state.id_correlacion)


@app.exception_handler(Exception)
async def error_interno(request: Request, _error: Exception):
    return problema(500, "Error interno", "No se pudo completar la operación.", request.url.path, request.state.id_correlacion)


@app.get("/salud")
def salud(request: Request):
    try:
        cliente.admin.command("ping")
    except PyMongoError:
        return problema(503, "Base no disponible", "No se pudo consultar la base de candidaturas.", request.url.path, request.state.id_correlacion)
    return {"estado": "saludable", "servicio": "candidaturas"}


@app.get("/openapi.yaml", include_in_schema=False)
def contrato():
    return Response(Path("/app/contrato.yaml").read_text(encoding="utf-8"), media_type="application/yaml")


@app.get("/docs", include_in_schema=False)
def documentacion():
    return get_swagger_ui_html(openapi_url=os.environ.get("URL_CONTRATO_OPENAPI", "/api/v1/candidaturas/openapi.yaml"), title="API de candidaturas SIGAPE")


@app.get("/candidaturas")
def listar_candidaturas(
    request: Request,
    pagina: int = Query(default=1, ge=1),
    limite: int = Query(default=20, ge=1, le=100),
    estado: str | None = None,
    idEleccion: UUID | None = None,
):
    filtro: dict = {}
    if estado is not None:
        if estado not in estados:
            return problema(400, "Filtro inválido", "estado no es un estado reconocido.", request.url.path, request.state.id_correlacion)
        filtro["estado"] = estado
    if idEleccion is not None:
        filtro["idEleccion"] = str(idEleccion)
    total = coleccion.count_documents(filtro)
    documentos = coleccion.find(filtro).sort([("creadoEn", -1), ("_id", 1)]).skip((pagina - 1) * limite).limit(limite)
    return {"elementos": [representar(documento) for documento in documentos], "pagina": pagina, "limite": limite, "total": total}


@app.post("/candidaturas", status_code=201)
def crear_candidatura(entrada: NuevaCandidatura, response: Response, request: Request):
    if entrada.tipo not in tipos or entrada.estado not in estados:
        return problema(422, "Datos inválidos", "tipo o estado no pertenece a los valores permitidos.", request.url.path, request.state.id_correlacion)
    ahora = datetime.now(timezone.utc)
    documento = {"_id": str(uuid4()), "idEleccion": str(entrada.idEleccion), "nombre": entrada.nombre.strip(), "tipo": entrada.tipo, "estado": entrada.estado, "creadoEn": ahora, "actualizadoEn": ahora}
    coleccion.insert_one(documento)
    response.headers["Location"] = f"/api/v1/candidaturas/{documento['_id']}"
    return representar(documento)


@app.get("/candidaturas/{idCandidatura}")
def consultar_candidatura(idCandidatura: str, request: Request):
    try:
        UUID(idCandidatura)
    except ValueError:
        return problema(400, "Identificador inválido", "El identificador debe ser un UUID válido.", request.url.path, request.state.id_correlacion)
    documento = coleccion.find_one({"_id": idCandidatura})
    if documento is None:
        return problema(404, "No encontrado", "La candidatura solicitada no existe.", request.url.path, request.state.id_correlacion)
    return representar(documento)


@app.put("/candidaturas/{idCandidatura}")
def actualizar_candidatura(idCandidatura: str, entrada: NuevaCandidatura, request: Request):
    try:
        UUID(idCandidatura)
    except ValueError:
        return problema(400, "Identificador inválido", "El identificador debe ser un UUID válido.", request.url.path, request.state.id_correlacion)
    if entrada.tipo not in tipos or entrada.estado not in estados:
        return problema(422, "Datos inválidos", "tipo o estado no pertenece a los valores permitidos.", request.url.path, request.state.id_correlacion)
    resultado = coleccion.update_one({"_id": idCandidatura}, {"$set": {"idEleccion": str(entrada.idEleccion), "nombre": entrada.nombre.strip(), "tipo": entrada.tipo, "estado": entrada.estado, "actualizadoEn": datetime.now(timezone.utc)}})
    if resultado.matched_count == 0:
        return problema(404, "No encontrado", "La candidatura solicitada no existe.", request.url.path, request.state.id_correlacion)
    return representar(coleccion.find_one({"_id": idCandidatura}))


@app.delete("/candidaturas/{idCandidatura}", status_code=204)
def eliminar_candidatura(idCandidatura: str, request: Request):
    try:
        UUID(idCandidatura)
    except ValueError:
        return problema(400, "Identificador inválido", "El identificador debe ser un UUID válido.", request.url.path, request.state.id_correlacion)
    documento = coleccion.find_one({"_id": idCandidatura})
    if documento is None:
        return problema(404, "No encontrado", "La candidatura solicitada no existe.", request.url.path, request.state.id_correlacion)
    if documento["estado"] != "borrador":
        return problema(409, "Conflicto de estado", "Solo se pueden eliminar candidaturas en borrador.", request.url.path, request.state.id_correlacion)
    coleccion.delete_one({"_id": idCandidatura})
    return Response(status_code=204)
