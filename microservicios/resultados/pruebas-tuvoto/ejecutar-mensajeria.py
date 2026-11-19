"""RabbitMQ/MongoDB efímeros: sin datos ni volúmenes existentes."""
import subprocess, os, json, time, secrets, sys
from pathlib import Path
from uuid import uuid4
import pika
from pymongo import MongoClient
R=Path(__file__).resolve().parents[3]
prefijo='tuvoto-prueba-eventos-'+uuid4().hex[:8]
creados=[];procesos=[]
def docker(*args,env=None):return subprocess.run(['docker',*args],env=env,text=True,capture_output=True,check=True).stdout

def lanzar(nombre,imagen,puerto,montajes,variables={},archivo=None):
    argumentos=['run','-d','--rm','--pull=never','--name',prefijo+'-'+nombre,'--label','tuvoto.prueba=efimera','--memory','768m','--cpus','0.5','-p',f'127.0.0.1::{puerto}']
    for m in montajes:argumentos+=['--tmpfs',m]
    if archivo:argumentos+=['--mount','type=bind,source='+str(archivo)+',target=/docker-entrypoint-initdb.d/10-bases.sh,readonly']
    for k in variables:argumentos+=['-e',k]
    ident=docker(*argumentos,imagen,env={**os.environ,**variables}).strip();creados.append(ident)
    datos=json.loads(docker('inspect',ident))[0]
    if any(m['Type']=='volume' for m in datos['Mounts']):raise RuntimeError('Volumen persistente inesperado')
    enlace=datos['NetworkSettings']['Ports'][str(puerto)+'/tcp'][0]
    if enlace['HostIp']!='127.0.0.1':raise RuntimeError('Puerto no aislado')
    return int(enlace['HostPort'])

def esperar(condicion,segundos=75):
    limite=time.monotonic()+segundos
    while time.monotonic()<limite:
        try:
            if condicion():return
        except Exception:pass
        time.sleep(1)
    raise RuntimeError('Prueba no confirmada dentro del plazo')

try:
    clave=secrets.token_hex(24)
    pm=lanzar('mongo','mongo:8.0',27017,['/data/db:rw,size=384m','/data/configdb:rw,size=16m'],{'MONGO_INITDB_ROOT_USERNAME':'tuvoto_prueba','MONGO_INITDB_ROOT_PASSWORD':clave,'RESULTADOS_DB_CLAVE':clave},R/'infraestructura/tuvoto/inicializar-mongodb.sh')
    pr=lanzar('rabbit','rabbitmq:4-management',5672,['/var/lib/rabbitmq:rw,size=128m'],{'RABBITMQ_DEFAULT_USER':'tuvoto_prueba','RABBITMQ_DEFAULT_PASS':clave})
    mongo=MongoClient('127.0.0.1',pm,username='tuvoto_prueba',password=clave,authSource='admin',serverSelectionTimeoutMS=1000)
    esperar(lambda:mongo.admin.command('ping')['ok'])
    esperar(lambda:bool(mongo.resultados_db.command('usersInfo','resultados_app')['users']))
    parametros=pika.ConnectionParameters(host='127.0.0.1',port=pr,credentials=pika.PlainCredentials('tuvoto_prueba',clave),socket_timeout=2,connection_attempts=1)
    def disponible():
        c=pika.BlockingConnection(parametros);c.close();return True
    esperar(disponible)
    for modo in ['conteo','auditoria']:
        env={**os.environ,'MODO_CONSUMIDOR':modo,'MONGODB_HOST':'127.0.0.1','MONGODB_PUERTO':str(pm),'MONGODB_DATABASE':'resultados_db','MONGODB_USERNAME':'resultados_app','MONGODB_PASSWORD':clave,'RABBITMQ_HOST':'127.0.0.1','RABBITMQ_PUERTO':str(pr),'RABBITMQ_USUARIO':'tuvoto_prueba','RABBITMQ_CLAVE':clave,'CONTRATO_EVENTO':str(R/'compartido/contratos/eventos/acta.actualizada.v1.schema.json')}
        procesos.append(subprocess.Popen([sys.executable,'-m','app.consumidor'],cwd=R/'microservicios/resultados',env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL))
    esperar(lambda:mongo.resultados_db.salud_consumidores.count_documents({})==2)
    conexion=pika.BlockingConnection(parametros);canal=conexion.channel();canal.confirm_delivery()
    org,proceso,mesa,a,b=[str(uuid4()) for _ in range(5)]
    def evento(version,va,vb):return {'idEvento':str(uuid4()),'tipo':'acta.actualizada.v1','version':1,'datos':{'idProceso':proceso,'idMesa':mesa,'idOrganizacion':org,'versionActa':version,'unidad':'Unidad de prueba','observada':False,'conteo':{'votos':[{'idCandidato':a,'cantidad':va},{'idCandidato':b,'cantidad':vb}],'blancos':1,'nulos':0,'total':va+vb+1}}}
    primero=evento(1,3,2);segundo=evento(2,4,1)
    for e in [primero,primero,segundo,primero,segundo]:canal.basic_publish(exchange='tuvoto.actas',routing_key='acta.actualizada.v1',body=json.dumps(e).encode(),mandatory=True,properties=pika.BasicProperties(delivery_mode=2))
    esperar(lambda:mongo.resultados_db.auditoria_actas.count_documents({})==2 and mongo.resultados_db.mesas_actas.find_one({'_id':proceso+':'+mesa,'versionActa':2}))
    fila=mongo.resultados_db.mesas_actas.find_one({'_id':proceso+':'+mesa})
    assert mongo.resultados_db.mesas_actas.count_documents({})==1 and fila['conteo']['votos'][0]['cantidad']==4
    canal.basic_publish(exchange='tuvoto.actas',routing_key='acta.actualizada.v1',body=b'{"invalido":true}',mandatory=True,properties=pika.BasicProperties(delivery_mode=2))
    esperar(lambda:all(canal.queue_declare(queue='resultados.'+m+'.v1.dlq',passive=True).method.message_count>=1 for m in ['conteo','auditoria']))
    consumidores=docker('exec',creados[1],'rabbitmqctl','list_consumers','queue_name','ack_required','prefetch_count')
    assert 'resultados.conteo.v1' in consumidores and 'resultados.auditoria.v1' in consumidores
    assert consumidores.count('true\t1')>=2
    conexion.close();mongo.close()
    print('OK: dos consumidores reales, ACK manual/prefetch 1, duplicados sin doble suma, versión anterior ignorada y mensaje inválido en ambas DLQ.')
finally:
    for p in procesos:
        p.terminate()
        try:p.wait(timeout=5)
        except subprocess.TimeoutExpired:p.kill();p.wait()
    for ident in reversed(creados):docker('stop','--time','5',ident)
