"""Pruebas aditivas sobre un candidato aislado; nunca usa fixtures del principal."""
import argparse,json
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
from uuid import uuid4

def principal():
    parser=argparse.ArgumentParser();parser.add_argument('manifiesto');args=parser.parse_args();meta=json.loads(Path(args.manifiesto).read_text())
    assert meta['proyecto'].startswith('sigape-cierre-p1-')
    base=meta['base'];assert base.startswith('http://127.0.0.1:') and not base.endswith(':8080')
    casos=[]
    def pedir(ruta,cuerpo=None,esperado=200):
        solicitud=Request(base+ruta,data=None if cuerpo is None else json.dumps(cuerpo).encode(),headers={'Content-Type':'application/json','X-Correlation-ID':'cierre-p1-'+meta['proyecto']})
        try:r=urlopen(solicitud,timeout=20)
        except HTTPError as error:r=error
        with r:
            bruto=r.read();dato=json.loads(bruto) if 'json' in r.headers.get('Content-Type','') else bruto.decode()
            casos.append({'ruta':ruta,'metodo':solicitud.get_method(),'esperado':esperado,'recibido':r.status,'correcto':r.status==esperado});assert r.status==esperado,(ruta,r.status,dato)
            return dato
    def gql(consulta,variables=None):
        dato=pedir('/graphql',{'query':consulta,'variables':variables or {}});assert 'errors' not in dato,dato;return dato['data']
    try:
        assert 'id="raiz"' in pedir('/')
        for servicio in ('identidad','elecciones','candidaturas','padron-electoral','votacion','resultados','graphql','frontend'):pedir('/api/v1/salud/'+servicio)
        for recurso in ('identidades','elecciones','candidaturas','inscripciones'):
            pagina=pedir('/api/v1/'+recurso+'?limite=1');assert pagina['total']==0 and pagina['elementos']==[], 'El candidato debe iniciar con bases nuevas'
        nombre='Cierre sintético '+str(uuid4())
        eleccion=gql('mutation($entrada:NuevaEleccion!){ crearEleccion(entrada:$entrada){idEleccion nombre estado} }',{'entrada':{'nombre':nombre,'estado':'borrador'}})['crearEleccion']
        candidatura=gql('mutation($entrada:NuevaCandidatura!){crearCandidatura(entrada:$entrada){idCandidatura idEleccion}}',{'entrada':{'idEleccion':eleccion['idEleccion'],'nombre':nombre,'tipo':'individual','estado':'borrador'}})['crearCandidatura']
        inscripcion=gql('mutation($entrada:NuevaInscripcion!){crearInscripcion(entrada:$entrada){idInscripcion elegible}}',{'entrada':{'idEleccion':eleccion['idEleccion'],'elegible':True}})['crearInscripcion']
        identidad=pedir('/api/v1/identidades',{'nombre':nombre,'estado':'activa'},201);assert pedir('/api/v1/identidades/'+identidad['idIdentidad'])['nombre']==nombre
        agregado=gql('query($id:ID!){eleccion(idEleccion:$id){idEleccion candidaturas{total elementos{idCandidatura eleccion{idEleccion}}} inscripciones{total elementos{idInscripcion eleccion{idEleccion}}}}}',{'id':eleccion['idEleccion']})
        fila=agregado['eleccion'];assert fila['candidaturas']['total']==fila['inscripciones']['total']==1
        assert fila['candidaturas']['elementos'][0]['idCandidatura']==candidatura['idCandidatura']
        assert fila['inscripciones']['elementos'][0]['idInscripcion']==inscripcion['idInscripcion']
        ruta='/api/v1/elecciones/'+eleccion['idEleccion']+'/inscripciones/'
        grpc=pedir(ruta+inscripcion['idInscripcion']+'/elegibilidad');assert grpc['elegible'] is True
        error=pedir(ruta+str(uuid4())+'/elegibilidad',esperado=404);assert error['codigoGrpc']==5 and error['estadoGrpc']=='NOT_FOUND'
        for recurso in ('elecciones','candidaturas','inscripciones'):
            assert pedir('/api/v1/'+recurso+'?limite=1')['total']==1
        resultado={'correcto':True,'casos':casos,'graphql':agregado,'grpc':grpc,'alcance':'Bases nuevas; mutations GraphQL y lecturas REST/gRPC; datos sintéticos conservados'}
    except Exception as error:
        resultado={'correcto':False,'casos':casos,'error':str(error)};raise
    finally:Path(meta['evidencia'],'rutas.json').write_text(json.dumps(resultado,ensure_ascii=False,indent=2))
    print('OK: ocho healthchecks, REST, tres mutations GraphQL, agregación de tres productores y gRPC real/NOT_FOUND')
if __name__=='__main__':principal()
