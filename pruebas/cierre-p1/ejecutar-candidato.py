"""Levanta solo el proyecto de cierre y verifica que el principal no cambie."""
import argparse,json,subprocess,sys,time
from pathlib import Path
RAIZ=Path(__file__).resolve().parents[2]
def principal():
    parser=argparse.ArgumentParser();parser.add_argument('manifiesto');parser.add_argument('--sin-reconstruir',action='store_true');args=parser.parse_args();ruta=Path(args.manifiesto);meta=json.loads(ruta.read_text());assert meta['proyecto'].startswith('sigape-cierre-p1-')
    evidencia=Path(meta['evidencia']);clon=Path(meta['clon'])
    compose=['docker','compose','--env-file',meta['entorno_privado'],'-p',meta['proyecto'],'-f',str(clon/'docker-compose.yml'),'-f',meta['override']]
    def ejecutar(comando,**opciones):return subprocess.run(comando,cwd=clon,check=True,text=True,**opciones)
    def fotografia():
        ids=subprocess.check_output(['docker','ps','-aq','--filter','label=com.docker.compose.project=sigape'],text=True).split()
        datos=json.loads(subprocess.check_output(['docker','inspect',*ids],text=True))
        return sorted([{'nombre':d['Name'],'id':d['Id'],'inicio':d['State']['StartedAt'],'estado':d['State']['Status'],'reinicios':d['RestartCount'],'volumenes':sorted(m['Name'] for m in d['Mounts'] if m['Type']=='volume')} for d in datos],key=lambda d:d['nombre'])
    antes=fotografia();(evidencia/'principal-antes.json').write_text(json.dumps(antes,indent=2))
    subprocess.run([sys.executable,str(RAIZ/'pruebas/integracion/conservacion-p1.py'),'capturar',str(evidencia/'datos-principal-antes.json')],cwd=RAIZ,check=True)
    resultado={'correcto':False}
    try:
        ejecutar(compose+['config','--quiet']);print('OK: compose config',flush=True)
        if not args.sin_reconstruir:
            with (evidencia/'arranque.log').open('w') as salida:ejecutar(compose+['up','-d','--build'],stdout=salida,stderr=subprocess.STDOUT)
        limite=time.monotonic()+300
        while True:
            estado=[json.loads(l) for l in ejecutar(compose+['ps','-a','--format','json'],capture_output=True).stdout.splitlines() if l]
            permanentes=[d for d in estado if d['Service']!='configurar-mensajeria']
            tarea=[d for d in estado if d['Service']=='configurar-mensajeria']
            if len(permanentes)==15 and all(d['Health']=='healthy' for d in permanentes) and len(tarea)==1 and tarea[0]['State']=='exited' and tarea[0]['ExitCode']==0:break
            assert time.monotonic()<limite, 'No alcanzó salud completa y tarea finalizada en 300 s'
            time.sleep(2)
        (evidencia/'contenedores.json').write_text(json.dumps([{'servicio':d['Service'],'estado':d['State'],'salud':d['Health'],'salida':d['ExitCode']} for d in estado],indent=2))
        permanentes=[d for d in estado if d['Service']!='configurar-mensajeria'];assert len(permanentes)==15 and all(d['Health']=='healthy' for d in permanentes)
        tarea=[d for d in estado if d['Service']=='configurar-mensajeria'];assert len(tarea)==1 and tarea[0]['ExitCode']==0
        puerto=ejecutar(compose+['port','entrada-nginx','80'],capture_output=True).stdout.strip().rsplit(':',1)[1];meta['base']='http://127.0.0.1:'+puerto;ruta.write_text(json.dumps(meta,ensure_ascii=False,indent=2))
        ejecutar([sys.executable,str(clon/'pruebas/cierre-p1/verificar-rutas.py'),str(ruta)])
        programa=(clon/'microservicios/resultados/pruebas/principal.py').read_text()
        with (evidencia/'rabbitmq.txt').open('w') as salida:ejecutar(compose+['exec','-T','resultados','python','-'],input=programa,stdout=salida,stderr=subprocess.STDOUT)
        ejecutar(['node',str(RAIZ/'pruebas/integracion/swagger-p1.mjs'),'--base',meta['base'],'--evidencia',str(evidencia/'swagger.json')])
        resultado={'correcto':True,'configuracion_valida':True,'contenedores_saludables':15,'tarea_rabbitmq_salida':0,'base':meta['base'],'alcance':'HEAD clonado más archivos locales publicables; imágenes compiladas y bases nuevas, sin node_modules ni .env del original'}
    except Exception as error:
        resultado={'correcto':False,'error':str(error)};raise
    finally:
        despues=fotografia();(evidencia/'principal-despues.json').write_text(json.dumps(despues,indent=2));resultado['principal_sin_cambios']=antes==despues
        comparacion=subprocess.run([sys.executable,str(RAIZ/'pruebas/integracion/conservacion-p1.py'),'comparar',str(evidencia/'datos-principal-antes.json')],cwd=RAIZ,text=True,capture_output=True)
        resultado['datos_principal_conservados']=comparacion.returncode==0
        (evidencia/'resultado.json').write_text(json.dumps(resultado,ensure_ascii=False,indent=2));assert antes==despues and comparacion.returncode==0
    print('OK: candidato completo aislado; principal y datos conservados',flush=True)
if __name__=='__main__':principal()
