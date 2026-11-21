"""Contrato REST de resultados: votos originales y ponderación son magnitudes distintas."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class CandidatoResultado(BaseModel):
    model_config=ConfigDict(extra='allow')
    id:str
    nombre:str
    votos:int
    porcentaje:float
    foto:str|None=None
    porcentajePonderado:float|None=None

class AvanceUnidad(BaseModel):
    unidad:str
    esperadas:int
    contabilizadas:int
    pendientes:int

class ResultadoSector(BaseModel):
    codigo:str
    nombre:str
    pesoBps:int
    esperadas:int
    contabilizadas:int
    pendientes:int
    observadas:int
    validos:int
    blancos:int
    nulos:int
    total:int
    candidatos:list[CandidatoResultado]

class IndicadorRegla(BaseModel):
    estado:str
    descripcion:str
    candidatos:list[str]
    provisional:bool

class Resultado(BaseModel):
    esperadas:int
    contabilizadas:int
    pendientes:int
    observadas:int
    avance:float
    blancos:int
    nulos:int
    total:int
    validos:int
    candidatos:list[CandidatoResultado]
    unidades:list[AvanceUnidad]
    sectores:list[ResultadoSector]
    ponderacionAplicada:bool
    requierenRevision:int
    regla:IndicadorRegla
    actualizadoEn:datetime|None=None
