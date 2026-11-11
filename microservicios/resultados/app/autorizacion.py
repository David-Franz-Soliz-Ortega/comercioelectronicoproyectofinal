"""Cliente interno de identidad: sesión/CSRF y permisos comprobados en servidor."""
import json,os
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError

class Acceso(Exception):
    def __init__(self,codigo):self.codigo=codigo

def cabeceras(solicitud):
    return {k:solicitud.headers.get(k,'') for k in ('Cookie','Origin','X-CSRF-Token','X-Organizacion')}

def autorizar(solicitud,accion,escritura=False):
    headers={**cabeceras(solicitud),'Content-Type':'application/json','X-Servicio':'resultados','X-Clave-Servicio':os.getenv('CLAVE_SERVICIO','')}
    peticion=Request(os.getenv('IDENTIDAD_URL','http://identidad:3000')+'/api/v1/interno/autorizar',method='POST',headers=headers,data=json.dumps({'accion':accion,'idOrganizacion':solicitud.headers.get('X-Organizacion'),'escritura':escritura}).encode())
    try:
        with urlopen(peticion,timeout=3) as r:return json.load(r)
    except HTTPError as e:raise Acceso(e.code if e.code in (401,403) else 503) from None
    except (URLError,TimeoutError,OSError):raise Acceso(503) from None

def comprobar_eleccion(solicitud,identificador):
    from urllib.parse import quote
    peticion=Request(os.getenv('ELECCIONES_URL','http://elecciones:3000')+'/api/v1/elecciones/'+quote(str(identificador),safe=''),headers=cabeceras(solicitud))
    try:
        with urlopen(peticion,timeout=3) as r:return json.load(r)
    except HTTPError as e:raise Acceso(e.code if e.code in (401,403,404) else 503) from None
    except (URLError,TimeoutError,OSError):raise Acceso(503) from None
