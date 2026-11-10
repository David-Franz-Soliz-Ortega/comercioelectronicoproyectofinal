"""Orquesta una ejecución CRUD aislada; no elimina contenedores ni volúmenes."""
from datetime import datetime, timezone
import argparse
import json
import os
import re
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile

RAIZ=Path(__file__).resolve().parents[2]


def principal():
    parser=argparse.ArgumentParser(); parser.add_argument('--reanudar'); parser.add_argument('--desde-swagger',action='store_true'); args=parser.parse_args()
    if args.reanudar:
        previo=json.loads(Path(args.reanudar).read_text())
        proyecto=previo['proyecto']; carpeta=Path(previo['evidencia']); entorno=Path(previo['entorno_privado'])
        assert proyecto.startswith('sigape-crud-p1-') and entorno.is_file()
    else:
        assert not args.desde_swagger, '--desde-swagger requiere --reanudar'
        proyecto='sigape-crud-p1-'+datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')+'-'+secrets.token_hex(2)
        carpeta=Path(tempfile.mkdtemp(prefix=proyecto+'-'))
        entorno=carpeta/'entorno.env'
        lineas=[]
        for linea in (RAIZ/'.env.example').read_text().splitlines():
            if not linea or linea.startswith('#'): continue
            clave,valor=linea.split('=',1)
            if 'CLAVE' in clave: valor=secrets.token_hex(32)
            lineas.append(clave+'='+valor)
        entorno.write_text('\n'.join(lineas)+'\n'); entorno.chmod(0o600)
    componer=['docker','compose','--env-file',str(entorno),'-p',proyecto,'-f',str(RAIZ/'docker-compose.yml'),'-f',str(RAIZ/'pruebas/integracion/compose.crud-p1.yml')]
    manifiesto={'proyecto':proyecto,'entorno_privado':str(entorno),'evidencia':str(carpeta),'creado':datetime.now(timezone.utc).isoformat()}
    (carpeta/'ejecucion.json').write_text(json.dumps(manifiesto,indent=2))
    print('Proyecto aislado:',proyecto,'Evidencia:',carpeta,flush=True)
    def ejecutar(argumentos,**opciones):
        return subprocess.run(argumentos,cwd=RAIZ,check=True,text=True,**opciones)
    ejecutar(componer+['config','--quiet'])
    ejecutar(componer+['up','-d','--build','--wait','--wait-timeout','180','entrada-nginx'])
    puerto=ejecutar(componer+['port','entrada-nginx','80'],capture_output=True).stdout.strip().rsplit(':',1)[1]
    base='http://127.0.0.1:'+puerto
    ejecutar(componer+['exec','-T','entrada-nginx','nginx','-s','reload'])
    manifiesto['base']=base
    (carpeta/'ejecucion.json').write_text(json.dumps(manifiesto,indent=2))
    if args.desde_swagger:
        assert args.reanudar and json.loads((carpeta/'crud.json').read_text())['correcto'] and json.loads((carpeta/'carga.json').read_text())['correcto']
    else:
        ejecutar([sys.executable,str(RAIZ/'pruebas/integracion/crud-p1.py'),'--base',base,'--evidencia',str(carpeta/'crud.json')])
        # Carga SQL propia del productor, repetida para verificar idempotencia.
        for indice in (1,2):
            resultado=ejecutar(componer+['exec','-T','elecciones','node','dist/cargar-demostracion.js'],capture_output=True)
            assert re.search(r'insertados: '+('10000' if indice==1 else '0')+r'\.',resultado.stdout),resultado.stdout
            (carpeta/f'carga-{indice}.txt').write_text(resultado.stdout)
            print(resultado.stdout.strip(),flush=True)
        ejecutar([sys.executable,str(RAIZ/'pruebas/integracion/crud-p1.py'),'--base',base,'--evidencia',str(carpeta/'carga.json'),'--solo-carga'])
    ejecutar(['node',str(RAIZ/'pruebas/integracion/swagger-p1.mjs'),'--base',base,'--evidencia',str(carpeta/'swagger.json')])
    # Reinicios únicamente en el proyecto aislado; se conservan los volúmenes.
    ejecutar(componer+['restart','base-postgres','base-mongodb'])
    ejecutar(componer+['up','-d','--wait','--wait-timeout','120','entrada-nginx'])
    ejecutar(componer+['exec','-T','entrada-nginx','nginx','-s','reload'])
    ejecutar([sys.executable,str(RAIZ/'pruebas/integracion/crud-p1.py'),'--base',base,'--evidencia',str(carpeta/'persistencia.json'),'--verificar',str(carpeta/'crud.json')])
    ejecutar([sys.executable,str(RAIZ/'pruebas/integracion/crud-p1.py'),'--base',base,'--evidencia',str(carpeta/'carga-tras-reinicio.json'),'--solo-carga'])
    (carpeta/'correcto.txt').write_text('CRUD, contratos, Swagger, carga y persistencia verificados.\n')
    print('PRUEBAS COMPLETADAS; datos y volúmenes de prueba conservados:',carpeta,flush=True)
if __name__=='__main__': principal()
