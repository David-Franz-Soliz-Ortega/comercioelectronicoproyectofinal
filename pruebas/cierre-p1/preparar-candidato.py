"""Clona HEAD y superpone archivos publicables locales sin cambiar Git original."""
from pathlib import Path
import hashlib,json,os,re,secrets,shutil,subprocess,tempfile
from datetime import datetime,timezone
RAIZ=Path(__file__).resolve().parents[2]
def git(*args):return subprocess.check_output(['git','-C',str(RAIZ),*args])
def principal():
    nombres=sorted(set(n.decode() for n in git('ls-files','--cached','--others','--exclude-standard','-z').split(b'\0') if n))
    valores=[]
    for linea in (RAIZ/'.env').read_text().splitlines():
        if '=' not in linea or linea.startswith('#'):continue
        clave,valor=linea.split('=',1)
        if any(p in clave for p in ('CLAVE','PASSWORD','SECRET','TOKEN')) and len(valor.strip())>=8:valores.append(valor.strip().strip('\"\'').encode())
    alertas=[]; patrones=[rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',rb'gh[pousr]_[A-Za-z0-9]{30,}',rb'AKIA[0-9A-Z]{16}',rb'(?i)https?://[^\s/:]+:[^\s/@]+@']
    archivos=[]
    for nombre in nombres:
        ruta=RAIZ/nombre
        assert not ruta.is_symlink(), 'Revisar enlace antes de exportar: '+nombre
        assert ruta.is_file(), 'Archivo seguido ausente: '+nombre
        assert '.git' not in Path(nombre).parts and (not ruta.name.startswith('.env') or ruta.name=='.env.example')
        contenido=ruta.read_bytes()
        if any(v in contenido for v in valores) or any(re.search(p,contenido) for p in patrones):alertas.append(nombre)
        archivos.append({'ruta':nombre,'sha256':hashlib.sha256(contenido).hexdigest()})
    assert not alertas, 'Revisar posibles secretos en: '+repr(alertas)
    carpeta=Path(tempfile.mkdtemp(prefix='sigape-cierre-p1-')); clon=carpeta/'candidato'; evidencia=carpeta/'evidencias';evidencia.mkdir()
    subprocess.run(['git','clone','--no-hardlinks','--no-checkout',str(RAIZ),str(clon)],check=True,capture_output=True)
    subprocess.run(['git','-C',str(clon),'checkout','--detach',git('rev-parse','HEAD').decode().strip()],check=True,capture_output=True)
    for archivo in archivos:
        origen=RAIZ/archivo['ruta'];destino=clon/archivo['ruta'];destino.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(origen,destino)
        assert hashlib.sha256(destino.read_bytes()).hexdigest()==archivo['sha256']
    proyecto='sigape-cierre-p1-'+secrets.token_hex(4)
    entorno=carpeta/'entorno.env';lineas=[]
    for linea in (RAIZ/'.env.example').read_text().splitlines():
        if not linea or linea.startswith('#'):continue
        clave,valor=linea.split('=',1)
        if 'CLAVE' in clave:valor=secrets.token_hex(32)
        if clave=='PUERTO_HTTP_PUBLICO':valor='0'
        lineas.append(clave+'='+valor)
    descriptor=os.open(entorno,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(descriptor,'w') as f:f.write('\n'.join(lineas)+'\n')
    override=carpeta/'compose.aislado.yml';override.write_text('services:\n  entrada-nginx:\n    ports: !override\n      - "127.0.0.1::80"\n')
    meta={'fecha':datetime.now(timezone.utc).isoformat(),'proyecto':proyecto,'carpeta':str(carpeta),'clon':str(clon),'entorno_privado':str(entorno),'override':str(override),'evidencia':str(evidencia),'head':git('rev-parse','HEAD').decode().strip(),'rama':git('branch','--show-current').decode().strip(),'remotos':git('remote','-v').decode(),'estado_git':git('status','--porcelain=v1','-uall').decode(),'archivos':archivos,'secretos':{'archivos_revisados':len(archivos),'coincidencias':alertas,'limite':'Valores locales y patrones seleccionados; no certifica ausencia absoluta ni examina remoto.'},'alcance':'Clon local de HEAD más superposición exacta de archivos publicables locales; no equivale a clon del futuro commit remoto.'}
    (carpeta/'ejecucion.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
    Path('/tmp/sigape-cierre-actual.txt').write_text(str(carpeta))
    print(json.dumps({'carpeta':str(carpeta),'proyecto':proyecto,'archivos':len(archivos),'secretos_confirmados':0},ensure_ascii=False))
if __name__=='__main__':principal()
