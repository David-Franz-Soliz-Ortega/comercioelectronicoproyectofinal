"""CRUD real y validación de contratos; DELETE solo en proyecto aislado autorizado."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import time
from urllib.error import HTTPError
from urllib.parse import urlencode,urlparse
from urllib.request import Request,urlopen
from uuid import uuid4
import warnings
import yaml
warnings.filterwarnings('ignore', category=DeprecationWarning)
from jsonschema import Draft202012Validator,FormatChecker,RefResolver
from openapi_spec_validator import validate_spec
warnings.filterwarnings('ignore', category=DeprecationWarning)
RAIZ=Path(__file__).resolve().parents[2]
SERVICIOS=[('identidad','identidades','idIdentidad','Identidad'),('elecciones','elecciones','idEleccion','Eleccion'),('candidaturas','candidaturas','idCandidatura','Candidatura'),('padron-electoral','inscripciones','idInscripcion','Inscripcion')]

class Pruebas:
    def __init__(self,base,destino):
        self.base=base; self.destino=Path(destino); self.casos=[]; self.preservados={}; self.creados={}; self.prefijo='CRUD P1 '+str(uuid4()); self.contratos={}
        for servicio,recurso,_,_ in SERVICIOS:
            with urlopen(base+'/api/v1/'+recurso+'/openapi.yaml',timeout=10) as r: contrato=yaml.safe_load(r.read())
            validate_spec(contrato)
            assert contrato==yaml.safe_load((RAIZ/'compartido/contratos/openapi'/f'{servicio}.yaml').read_text()),'El contrato servido no coincide con la fuente'
            self.contratos[recurso]=contrato
    def validar(self,recurso,nombre,cuerpo):
        contrato=self.contratos[recurso]
        Draft202012Validator(contrato['components']['schemas'][nombre],resolver=RefResolver.from_schema(contrato),format_checker=FormatChecker()).validate(cuerpo)
    def solicitar(self,recurso,metodo,ruta,esperado,cuerpo=None,modelo=None):
        # Prohibir toda eliminación fuera de los IDs creados por esta ejecución.
        if metodo=='DELETE': assert ruta.split('/')[-1] in self.creados.get(recurso,set())
        identificador='prueba-crud-'+str(uuid4())
        request=Request(self.base+'/api/v1/'+ruta,method=metodo,headers={'Content-Type':'application/json','X-Correlation-ID':identificador},data=None if cuerpo is None else cuerpo if isinstance(cuerpo,bytes) else json.dumps(cuerpo).encode())
        inicio=time.monotonic()
        try: respuesta=urlopen(request,timeout=12)
        except HTTPError as e: respuesta=e
        with respuesta:
            bruto=respuesta.read(); codigo=respuesta.status; tipo=respuesta.headers.get('Content-Type',''); correlacion=respuesta.headers.get('X-Correlation-ID')
            dato=json.loads(bruto) if bruto else None
        registro={'servicio':recurso,'metodo':metodo,'ruta':ruta,'esperado':esperado,'recibido':codigo,'ms':round((time.monotonic()-inicio)*1000,2),'tipo':tipo,'correlacion_preservada':correlacion==identificador,'correcto':False}
        self.casos.append(registro)
        assert codigo==esperado,(registro,dato)
        assert correlacion==identificador
        if codigo>=400:
            assert tipo.startswith('application/problem+json'),(registro,tipo)
            self.validar(recurso,'Problema',dato); assert dato['status']==codigo
        elif modelo:
            self.validar(recurso,modelo,dato)
        if codigo==204: assert bruto==b''
        registro['correcto']=True
        return dato
    def guardar(self,correcto,error=None):
        self.destino.write_text(json.dumps({'fecha':datetime.now(timezone.utc).isoformat(),'base':self.base,'prefijo':self.prefijo,'correcto':correcto,'error':error,'contratos_validados':list(self.contratos),'casos':self.casos,'preservados':self.preservados},ensure_ascii=False,indent=2))
    def ejecutar_crud(self):
        eleccion=str(uuid4())
        for servicio,recurso,clave,modelo in SERVICIOS:
            self.creados[recurso]=set()
            def entrada(indice):
                if recurso=='inscripciones': return {'idEleccion':eleccion,'elegible':indice!=2}
                dato={'nombre':self.prefijo+' '+recurso+' '+str(indice),'estado':'activa' if recurso=='identidades' else 'borrador'}
                if recurso=='candidaturas': dato.update({'idEleccion':eleccion,'tipo':'individual'})
                return dato
            filas=[]
            for indice in range(3):
                fila=self.solicitar(recurso,'POST',recurso,201,entrada(indice),modelo); self.creados[recurso].add(fila[clave]); filas.append(fila)
            id_principal=filas[0][clave]; ruta=recurso+'/'+id_principal
            assert self.solicitar(recurso,'GET',ruta,200,modelo=modelo)==filas[0]
            nuevo=entrada(0)
            if recurso=='inscripciones': nuevo['elegible']=False
            else: nuevo['nombre']+=' actualizado'
            if recurso=='identidades': nuevo['estado']='suspendida'
            if recurso=='candidaturas': nuevo['tipo']='lista'
            actualizado=self.solicitar(recurso,'PUT',ruta,200,nuevo,modelo)
            assert all(actualizado[k]==v for k,v in nuevo.items())
            assert self.solicitar(recurso,'GET',ruta,200,modelo=modelo)==actualizado
            assert actualizado['creadoEn']==filas[0]['creadoEn'] and actualizado['actualizadoEn']>=actualizado['creadoEn']
            pagina1=self.solicitar(recurso,'GET',recurso+'?pagina=1&limite=1',200,modelo={'Identidad':'PaginaIdentidades','Eleccion':'PaginaElecciones','Candidatura':'PaginaCandidaturas','Inscripcion':'PaginaInscripciones'}[modelo])
            pagina2=self.solicitar(recurso,'GET',recurso+'?pagina=2&limite=1',200)
            assert pagina1['pagina']==pagina2['limite']==1 and pagina2['pagina']==2
            assert pagina1['total']>=3 and pagina1['elementos'][0][clave]!=pagina2['elementos'][0][clave]
            filtro={'elegible':'false','idEleccion':eleccion} if recurso=='inscripciones' else {'estado':'suspendida' if recurso=='identidades' else 'borrador'}
            if recurso=='candidaturas': filtro['idEleccion']=eleccion
            if recurso=='elecciones': filtro['nombre']=self.prefijo
            filtrados=self.solicitar(recurso,'GET',recurso+'?'+urlencode(filtro),200)
            assert filtrados['total']>=1
            for fila in filtrados['elementos']:
                if recurso=='inscripciones': assert fila['elegible'] is False and fila['idEleccion']==eleccion
                else: assert fila['estado']==filtro['estado']
                if recurso=='candidaturas': assert fila['idEleccion']==eleccion
                if recurso=='elecciones': assert self.prefijo in fila['nombre']
            if recurso in ('candidaturas','inscripciones'):
                vacio=self.solicitar(recurso,'GET',recurso+'?idEleccion='+str(uuid4()),200); assert vacio['total']==0 and vacio['elementos']==[]
            self.solicitar(recurso,'POST',recurso,422 if recurso=='candidaturas' else 400,b'{')
            self.solicitar(recurso,'POST',recurso,422,{'datoNoPermitido':True})
            erroneo=entrada(0); erroneo['datoNoPermitido']=True
            self.solicitar(recurso,'POST',recurso,422,erroneo)
            self.solicitar(recurso,'PUT',ruta,422,{'datoNoPermitido':True})
            if recurso!='inscripciones':
                for nombre in ('',' '*3,'x'*121):
                    erroneo=entrada(0); erroneo['nombre']=nombre; self.solicitar(recurso,'POST',recurso,422,erroneo)
                erroneo=entrada(0); erroneo['estado']='desconocido'; self.solicitar(recurso,'POST',recurso,422,erroneo)
                self.solicitar(recurso,'GET',recurso+'?estado=desconocido',400)
            else:
                self.solicitar(recurso,'POST',recurso,422,{'idEleccion':eleccion,'elegible':'talvez'})
                self.solicitar(recurso,'GET',recurso+'?elegible=talvez',400)
            self.solicitar(recurso,'GET',recurso+'/no-es-uuid',400)
            self.solicitar(recurso,'GET',recurso+'/'+str(uuid4()),404)
            for consulta in ('pagina=0','limite=0','limite=101'):
                self.solicitar(recurso,'GET',recurso+'?'+consulta,422 if recurso=='candidaturas' else 400)
            # Errores 409 con recursos propios; no se elimina ni actualiza el registro protegido.
            if recurso in ('elecciones','candidaturas'):
                protegido=entrada(1); protegido['estado']='en_curso' if recurso=='elecciones' else 'aprobada'
                protegido=self.solicitar(recurso,'PUT',recurso+'/'+filas[1][clave],200,protegido,modelo)
                self.solicitar(recurso,'DELETE',recurso+'/'+filas[1][clave],409)
                if recurso=='elecciones': self.solicitar(recurso,'PUT',recurso+'/'+filas[1][clave],409,entrada(1))
                assert self.solicitar(recurso,'GET',recurso+'/'+filas[1][clave],200,modelo=modelo)==protegido
            self.solicitar(recurso,'DELETE',ruta,204)
            self.solicitar(recurso,'GET',ruta,404)
            self.solicitar(recurso,'PUT',ruta,404,entrada(0))
            self.solicitar(recurso,'DELETE',ruta,404)
            if recurso=='elecciones': eleccion=filas[2][clave]
            restante=self.solicitar(recurso,'GET',recurso+'/'+filas[2][clave],200,modelo=modelo)
            self.preservados[recurso]={'id':filas[2][clave],'modelo':modelo,'registro':restante}
            print('OK: CRUD completo, contratos, filtros, paginación, errores y validación:',servicio,flush=True)
    def verificar(self,ruta):
        anterior=json.loads(Path(ruta).read_text())
        for recurso,dato in anterior['preservados'].items():
            actual=self.solicitar(recurso,'GET',recurso+'/'+dato['id'],200,modelo=dato['modelo'])
            assert actual==dato['registro']
            self.preservados[recurso]=dato
        print('OK: persistencia de los cuatro servicios tras reinicio de las bases aisladas',flush=True)
    def cargar(self):
        encontrados=set()
        for numero in range(1,101):
            ruta='elecciones?'+urlencode({'pagina':numero,'limite':100,'nombre':'Elección sintética P1 ','estado':'borrador'})
            dato=self.solicitar('elecciones','GET',ruta,200,modelo='PaginaElecciones')
            assert dato['total']==10000 and len(dato['elementos'])==100
            ids=[f['idEleccion'] for f in dato['elementos']]
            assert not encontrados.intersection(ids)
            encontrados.update(ids)
        assert len(encontrados)==10000
        vacio=self.solicitar('elecciones','GET','elecciones?'+urlencode({'pagina':101,'limite':100,'nombre':'Elección sintética P1 '}),200)
        assert vacio['elementos']==[] and vacio['total']==10000
        self.preservados['carga_elecciones']={'total':10000,'ids_distintos':len(encontrados),'paginas_completas':100}
        print('OK: 10000 elecciones distintas, 100 páginas y página final vacía; contratos válidos',flush=True)


def principal():
    parser=argparse.ArgumentParser();parser.add_argument('--base',required=True);parser.add_argument('--evidencia',required=True);parser.add_argument('--solo-carga',action='store_true');parser.add_argument('--verificar');args=parser.parse_args()
    # La evidencia vive junto al manifiesto que solo genera el orquestador aislado.
    meta=json.loads((Path(args.evidencia).parent/'ejecucion.json').read_text())
    assert meta['proyecto'].startswith('sigape-crud-p1-') and meta['base']==args.base
    assert urlparse(args.base).hostname=='127.0.0.1' and urlparse(args.base).port!=8080
    prueba=Pruebas(args.base,args.evidencia)
    try:
        if args.solo_carga: prueba.cargar()
        elif args.verificar: prueba.verificar(args.verificar)
        else: prueba.ejecutar_crud()
    except Exception as error:
        prueba.guardar(False,str(error));raise
    prueba.guardar(True)
    print('Evidencia JSON:',args.evidencia,flush=True)
if __name__=='__main__':principal()
