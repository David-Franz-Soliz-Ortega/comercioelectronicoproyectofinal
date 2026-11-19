"""Solo pruebas efímeras: sin volúmenes persistentes ni proyectos existentes."""
import os
import subprocess
import json
import time
from pathlib import Path
from uuid import uuid4
import sys
import secrets
nombre = 'tuvoto-prueba-actas-' + uuid4().hex[:10]
def docker(*argumentos):
    r=subprocess.run(['docker',*argumentos],env=globals().get('entorno_init',os.environ),capture_output=True,text=True,check=True);return r.stdout
entorno_init = {**os.environ, 'IDENTIDAD_DB_USUARIO':'identidad_app','IDENTIDAD_DB_CLAVE':secrets.token_hex(24),'ELECCIONES_DB_USUARIO':'elecciones_app','ELECCIONES_DB_CLAVE':secrets.token_hex(24),'ACTAS_DB_USUARIO':'actas_app','ACTAS_DB_CLAVE':secrets.token_hex(24)}
identificador = docker('run','--detach','--rm','--pull=never','--name',nombre,'--label','tuvoto.prueba=efimera','--memory','256m','--cpus','0.5','--tmpfs','/var/lib/postgresql/data:rw,size=128m','--publish','127.0.0.1::5432','--env','POSTGRES_HOST_AUTH_METHOD=trust','--env','POSTGRES_DB=tuvoto_pruebas','--env','IDENTIDAD_DB_USUARIO','--env','IDENTIDAD_DB_CLAVE','--env','ELECCIONES_DB_USUARIO','--env','ELECCIONES_DB_CLAVE','--env','ACTAS_DB_USUARIO','--env','ACTAS_DB_CLAVE','--mount','type=bind,source='+str(Path(__file__).resolve().parents[3]/'infraestructura/tuvoto/inicializar-postgres.sh')+',target=/docker-entrypoint-initdb.d/10-bases.sh,readonly','postgres:17-alpine').strip()
try:
    inspeccion=json.loads(docker('inspect',identificador))[0]
    if any(m['Type']=='volume' for m in inspeccion['Mounts']):raise RuntimeError('No se permiten volúmenes persistentes de prueba')
    enlace=inspeccion['NetworkSettings']['Ports']['5432/tcp'][0]
    if enlace['HostIp']!='127.0.0.1':raise RuntimeError('Prueba no limitada a loopback')
    for _ in range(40):
        r=subprocess.run(['docker','exec',identificador,'pg_isready','-h','127.0.0.1','-U','postgres','-d','tuvoto_pruebas'],capture_output=True)
        if r.returncode==0:break
        time.sleep(1)
    else:raise RuntimeError('PostgreSQL efímero no listo')
    entorno={**os.environ,'TUVOTO_PRUEBA_CONFIRMACION':'SOLO_DATOS_EFIMEROS','TUVOTO_PRUEBA_PG_PUERTO':enlace['HostPort']}
    r=subprocess.run([sys.executable,str(Path(__file__).with_name('test_persistencia.py'))],env=entorno)
    raise SystemExit(r.returncode)
finally:
    # Solo el contenedor recién creado por este ejecutor; --rm retira su estado efímero.
    docker('stop','--time','5',identificador)
