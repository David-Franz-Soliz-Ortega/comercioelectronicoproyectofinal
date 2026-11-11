"""Prueba el frontend en nueve contenedores nuevos; conserva P1 y todos los datos."""
import argparse,json,os,shutil,subprocess,sys,time
from pathlib import Path
RAIZ=Path(__file__).resolve().parents[2]

def principal():
    parser=argparse.ArgumentParser();parser.add_argument('--reanudar');parser.add_argument('--mantener-activo',action='store_true');args=parser.parse_args()
    def ejecutar(comando,**opciones):return subprocess.run(comando,cwd=RAIZ,check=True,text=True,**opciones)
    referencia=ejecutar(['git','rev-parse','main','v1.0-p1^{commit}'],capture_output=True).stdout
    assert len(set(referencia.splitlines()))==1
    if args.reanudar:
        ruta=Path(args.reanudar);meta=json.loads(ruta.read_text());carpeta=ruta.parent
        assert meta['proyecto'].startswith('sigape-cierre-p1-') and carpeta.name.startswith('sigape-cierre-p1-')
        shutil.copytree(RAIZ/'frontend',Path(meta['clon'])/'frontend',dirs_exist_ok=True,ignore=shutil.ignore_patterns('node_modules','dist','__pycache__'))
    else:
        salida=ejecutar([sys.executable,str(RAIZ/'pruebas/cierre-p1/preparar-candidato.py')],capture_output=True)
        carpeta=Path(json.loads(salida.stdout)['carpeta']);ruta=carpeta/'ejecucion.json';meta=json.loads(ruta.read_text());assert meta['proyecto'].startswith('sigape-cierre-p1-')
    evidencia=Path(meta['evidencia']);print('Carpeta aislada:',carpeta,flush=True)
    Path(meta['override']).write_text('''services:
  candidaturas:
    healthcheck:
      start_period: 40s
  entrada-nginx:
    ports: !override
      - "127.0.0.1::80"
    depends_on: !override
      identidad: {condition: service_healthy}
      elecciones: {condition: service_healthy}
      candidaturas: {condition: service_healthy}
      padron-electoral: {condition: service_healthy}
      gateway-graphql: {condition: service_healthy}
      frontend: {condition: service_healthy}
''')
    compose=['docker','compose','--env-file',meta['entorno_privado'],'-p',meta['proyecto'],'-f',str(Path(meta['clon'])/'docker-compose.yml'),'-f',meta['override']]
    def fotografia():
        ids=ejecutar(['docker','ps','-aq','--filter','label=com.docker.compose.project=sigape'],capture_output=True).stdout.split()
        filas=json.loads(ejecutar(['docker','inspect',*ids],capture_output=True).stdout)
        return sorted([{'nombre':f['Name'],'id':f['Id'],'inicio':f['State']['StartedAt'],'reinicios':f['RestartCount'],'volumenes':sorted(m['Name'] for m in f['Mounts'] if m['Type']=='volume')} for f in filas],key=lambda f:f['nombre'])
    antes=fotografia();(evidencia/'principal-antes.json').write_text(json.dumps(antes,indent=2))
    ejecutar([sys.executable,str(RAIZ/'pruebas/integracion/conservacion-p1.py'),'capturar',str(evidencia/'datos-principal.json')])
    assert sum(f['total'] for f in json.loads((evidencia/'datos-principal.json').read_text()).values() if isinstance(f,dict))==10013
    resultado={'correcto':False}
    try:
        ejecutar(compose+['config','--quiet'])
        with (evidencia/'construccion.txt').open('w') as registro:ejecutar(compose+['up','-d','--build','--wait','--wait-timeout','240','entrada-nginx'],stdout=registro,stderr=subprocess.STDOUT)
        ejecutar(compose+['exec','-T','entrada-nginx','nginx','-s','reload'])
        estados=[json.loads(l) for l in ejecutar(compose+['ps','--format','json'],capture_output=True).stdout.splitlines() if l];assert len(estados)==9 and all(e['Health']=='healthy' for e in estados)
        (evidencia/'contenedores.json').write_text(json.dumps([{'servicio':e['Service'],'salud':e['Health']} for e in estados],indent=2))
        puerto=ejecutar(compose+['port','entrada-nginx','80'],capture_output=True).stdout.strip().rsplit(':',1)[1];meta['base']='http://127.0.0.1:'+puerto;ruta.write_text(json.dumps(meta,indent=2))
        # Datos identificados como prueba; solo solicitudes REST al NGINX aislado.
        entorno={**os.environ,'URL_BASE':meta['base'],'MANIFIESTO_FRONTEND':str(ruta),'EVIDENCIA_FRONTEND':str(evidencia)}
        if not (evidencia/'datos-prueba.json').exists():
            ejecutar(['node',str(RAIZ/'frontend/pruebas/preparar-datos.mjs')],env=entorno)
        with (evidencia/'navegador.txt').open('w') as registro:ejecutar(['npm','run','probar-navegador','--prefix','frontend'],env=entorno,stdout=registro,stderr=subprocess.STDOUT)
        # Reiniciar únicamente PostgreSQL del proyecto nuevo y confirmar el registro creado.
        ejecutar(compose+['restart','base-postgres'])
        ejecutar(compose+['up','-d','--wait','--wait-timeout','120','entrada-nginx'])
        ejecutar(compose+['exec','-T','entrada-nginx','nginx','-s','reload'])
        ejecutar(['node',str(RAIZ/'frontend/pruebas/verificar-persistencia.mjs')],env=entorno)
        resultado={'correcto':True,'proyecto':meta['proyecto'],'base':meta['base'],'contenedores_saludables':9,'persistencia_tras_reinicio':True}
    except Exception as error:
        resultado={'correcto':False,'error':str(error)};raise
    finally:
        despues=fotografia();(evidencia/'principal-despues.json').write_text(json.dumps(despues,indent=2));resultado['principal_sin_cambios']=antes==despues
        comparacion=subprocess.run([sys.executable,str(RAIZ/'pruebas/integracion/conservacion-p1.py'),'comparar',str(evidencia/'datos-principal.json')],cwd=RAIZ,text=True,capture_output=True)
        resultado['referencias_p1_intactas']=referencia==ejecutar(['git','rev-parse','main','v1.0-p1^{commit}'],capture_output=True).stdout
        resultado['datos_originales_conservados']=comparacion.returncode==0
        if not args.mantener_activo:
            ejecutar(compose+['stop'])
        resultado['entorno_pruebas_detenido']=not args.mantener_activo
        (evidencia/'resultado.json').write_text(json.dumps(resultado,ensure_ascii=False,indent=2));assert resultado['principal_sin_cambios'] and resultado['referencias_p1_intactas'] and resultado['datos_originales_conservados']
    print('Pruebas completas, datos y volúmenes conservados:',evidencia,flush=True)
if __name__=='__main__':principal()
