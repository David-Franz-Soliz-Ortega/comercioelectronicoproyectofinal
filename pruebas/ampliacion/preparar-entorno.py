"""Prepara exclusivamente un proyecto Docker de pruebas nuevo, con secretos fuera de Git."""
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import tempfile
from uuid import uuid4
raiz=Path(__file__).resolve().parents[2]
proyecto='tuvoto-prueba-sectores-'+uuid4().hex[:8]
carpeta=Path(tempfile.mkdtemp(prefix=proyecto+'-'));os.chmod(carpeta,0o700)
s=socket.socket();s.bind(('127.0.0.1',18891));s.close()
lineas=[]
for linea in (raiz/'.env.example').read_text().splitlines():
 if not linea.startswith('TUVOTO_'):continue
 k,v=linea.split('=',1)
 if 'CLAVE' in k or 'INTERNA' in k:v=secrets.token_hex(32)
 elif k=='TUVOTO_PUERTO':v='18891'
 elif k=='TUVOTO_ORIGEN':v='http://127.0.0.1:18891'
 elif k=='TUVOTO_COOKIE_SEGURA':v='false'
 lineas.append(k+'='+v)
entorno=carpeta/'entorno.env'
with os.fdopen(os.open(entorno,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'w') as f:f.write('\n'.join(lineas)+'\n')
memorias={'base-postgres':'256m','base-mongodb':'512m','mensajeria-rabbitmq':'512m','cache-redis':'64m','identidad':'256m','elecciones':'256m','actas':'256m','resultados':'192m','resultados-conteo':'192m','resultados-auditoria':'192m','gateway-graphql':'128m','frontend':'64m','entrada-nginx':'64m'}
limites=carpeta/'limites.yml';limites.write_text('services:\n'+''.join(f'  {n}:\n    mem_limit: {m}\n    cpus: 1.0\n' for n,m in memorias.items()))
comando=['docker','compose','--env-file',str(entorno),'-p',proyecto,'-f',str(raiz/'docker-compose.yml'),'-f',str(limites)]
r=subprocess.run(comando+['config','--format','json'],capture_output=True,text=True,check=True);config=json.loads(r.stdout)
assert config['name']==proyecto
for tipo in ('networks','volumes'):
 for valor in config[tipo].values():assert not valor.get('external') and valor['name'].startswith(proyecto+'_')
for valor in config['services'].values():
 assert not valor.get('container_name')
 for montaje in valor.get('volumes',[]):assert montaje['type']!='bind' or montaje.get('read_only')
Path('/tmp/tuvoto-ampliacion-entorno.json').write_text(json.dumps({'proyecto':proyecto,'carpeta':str(carpeta),'comando':comando,'url':'http://127.0.0.1:18891'}))
print('Entorno de prueba validado:',proyecto,'puerto 18891. Credenciales nuevas privadas; sin volúmenes/redes externos ni archivos compartidos de escritura.')
r=subprocess.run(comando+['up','-d','--build','--wait','--wait-timeout','240'])
raise SystemExit(r.returncode)
