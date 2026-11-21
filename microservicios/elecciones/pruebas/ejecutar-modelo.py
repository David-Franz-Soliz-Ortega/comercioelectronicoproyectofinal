"""Prueba de migración únicamente en PostgreSQL efímero, sin volúmenes persistentes."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
from uuid import uuid4

raiz=Path(__file__).resolve().parents[3]
nombre='tuvoto-prueba-modelo-'+uuid4().hex[:10]
def docker(*args):return subprocess.check_output(['docker',*args],text=True).strip()
with tempfile.TemporaryDirectory(prefix='tuvoto-roles-') as temporal:
    compilado=Path(temporal)
    subprocess.run([str(raiz/'microservicios/elecciones/node_modules/.bin/tsc'),'-p',str(raiz/'microservicios/elecciones/tsconfig.json'),'--outDir',temporal],check=True)
    (compilado/'node_modules').symlink_to(raiz/'microservicios/elecciones/node_modules',target_is_directory=True)
    (compilado/'package.json').write_text('{"type":"module"}')
    identificador=docker('run','--detach','--rm','--pull=never','--name',nombre,'--label','tuvoto.prueba=efimera','--memory','256m','--cpus','0.5','--tmpfs','/var/lib/postgresql/data:rw,size=128m','--publish','127.0.0.1::5432','--env','POSTGRES_HOST_AUTH_METHOD=trust','--env','POSTGRES_DB=tuvoto_modelo_pruebas','postgres:17-alpine')
    try:
        inspeccion=json.loads(docker('inspect',identificador))[0]
        assert not any(m['Type']=='volume' for m in inspeccion['Mounts'])
        enlace=inspeccion['NetworkSettings']['Ports']['5432/tcp'][0]
        assert enlace['HostIp']=='127.0.0.1'
        for _ in range(40):
            if subprocess.run(['docker','exec',identificador,'pg_isready','-h','127.0.0.1','-U','postgres','-d','tuvoto_modelo_pruebas'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
            time.sleep(1)
        else:raise RuntimeError('Base efímera no disponible')
        entorno={**os.environ,'TUVOTO_COMPILACION_ELECCIONES':temporal,'TUVOTO_PRUEBA_MODELO':'SOLO_DATOS_EFIMEROS','TUVOTO_PRUEBA_PG_PUERTO':enlace['HostPort']}
        resultado=subprocess.run(['node','--test','--test-isolation=none',str(Path(__file__).with_name('modelo-importacion.test.mjs'))],env=entorno,cwd=raiz)
        raise SystemExit(resultado.returncode)
    finally:docker('stop','--time','5',identificador)
