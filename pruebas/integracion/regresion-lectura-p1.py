"""Regresión sin escrituras del principal: GraphQL, gRPC, React, salud y AMQP."""
import argparse
import json
import subprocess
from pathlib import Path
from urllib.request import Request,urlopen


def principal():
    parser=argparse.ArgumentParser();parser.add_argument('--evidencia',required=True);args=parser.parse_args()
    base='http://localhost:8080';resultados=[]
    def consultar(ruta,cuerpo=None):
        peticion=Request(base+ruta,data=None if cuerpo is None else json.dumps(cuerpo).encode(),headers={'Content-Type':'application/json'})
        with urlopen(peticion,timeout=20) as r:
            bruto=r.read();resultados.append({'ruta':ruta,'http':r.status});assert r.status==200
            return json.loads(bruto) if 'json' in r.headers.get('Content-Type','') else bruto.decode()
    assert '<div id="raiz">' in consultar('/')
    for nombre in ('identidad','elecciones','candidaturas','padron-electoral','votacion','resultados','graphql'):
        consultar('/api/v1/salud/'+nombre)
    consulta='{ elecciones(limite:1){ total elementos { idEleccion } } candidaturas(limite:1){ total elementos { idCandidatura eleccion { idEleccion } } } inscripciones(limite:1){ total elementos { idInscripcion eleccion { idEleccion } } } }'
    grafico=consultar('/graphql',{'query':consulta});assert 'errors' not in grafico and len(grafico['data'])==3
    grpc=consultar('/api/v1/elecciones/fd6aab6d-3b48-48ce-8188-ae72c0ce4edb/inscripciones/7079bbd9-c850-419b-9f89-596f8a681bc2/elegibilidad');assert grpc['elegible'] is True
    # Consulta administrativa exclusivamente en memoria; no imprime credenciales.
    codigo='''import base64,json,os,urllib.request
credenciales=base64.b64encode((os.environ["RABBITMQ_USUARIO"]+":"+os.environ["RABBITMQ_CLAVE"]).encode()).decode()
def obtener(ruta):
 r=urllib.request.Request("http://mensajeria-rabbitmq:15672/api/"+ruta,headers={"Authorization":"Basic "+credenciales})
 return json.load(urllib.request.urlopen(r))
consumidores=obtener("consumers")
activos=[{"cola":c["queue"]["name"],"ack_manual":c["ack_required"],"prefetch":c["prefetch_count"]} for c in consumidores if c["queue"]["name"] in ("resultados.conteo.v1","resultados.auditoria.v1")]
assert len(activos)==2 and all(c["ack_manual"] and c["prefetch"]==1 for c in activos)
colas=[{"nombre":c["name"],"durable":c["durable"],"tipo":c["type"]} for c in obtener("queues") if c["name"].startswith("resultados.")]
assert len(colas)==4 and all(c["durable"] and c["tipo"]=="quorum" for c in colas)
print(json.dumps({"consumidores":activos,"colas":colas}))'''
    amqp=json.loads(subprocess.check_output(['docker','compose','exec','-T','resultados','python','-c',codigo],text=True))
    estado=subprocess.check_output(['docker','compose','ps','--format','json'],text=True)
    contenedores=[json.loads(linea) for linea in estado.splitlines() if linea.strip()]; assert len(contenedores)==15 and all(c['Health']=='healthy' for c in contenedores)
    Path(args.evidencia).write_text(json.dumps({'correcto':True,'alcance':'Solo lectura; no prueba nuevas mutations ni nuevos eventos AMQP','http':resultados,'graphql':grafico,'grpc':grpc,'rabbitmq':amqp,'contenedores':[{'servicio':c['Service'],'salud':c['Health']} for c in contenedores]},ensure_ascii=False,indent=2))
    print('OK: 15 saludables, React, GraphQL de tres servicios, gRPC y dos consumidores ACK manual; solo lectura')
if __name__=='__main__':principal()
