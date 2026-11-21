"""Prueba real de la ampliación SOLO en el proyecto sintético preparado por preparar-entorno.py."""
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
import http.cookiejar
import io
import json
import os
from pathlib import Path
import secrets
import subprocess
import time
import urllib.request
import urllib.error
from uuid import uuid4
import zipfile
from xml.sax.saxutils import escape

contexto=json.loads(Path('/tmp/tuvoto-ampliacion-entorno.json').read_text())
proyecto=contexto['proyecto'];base=contexto['url'];assert proyecto.startswith('tuvoto-prueba-sectores-') and base=='http://127.0.0.1:18891'
ids=subprocess.check_output(['docker','ps','-q','--filter','label=com.docker.compose.project='+proyecto],text=True).split();cs=json.loads(subprocess.check_output(['docker','inspect',*ids],text=True));assert len(cs)==13
for c in cs:
 assert c['State']['Health']['Status']=='healthy'
 assert all(n.startswith(proyecto+'_') for n in c['NetworkSettings']['Networks'])
 for m in c['Mounts']:
  if m['Type']=='volume':
   refs=subprocess.check_output(['docker','ps','-aq','--no-trunc','--filter','volume='+m['Name']],text=True).split();assert set(refs)<={v['Id'] for v in cs}
  elif m['Type']=='bind':assert not m['RW']
class Cliente:
 def __init__(self):self.cookies=http.cookiejar.CookieJar();self.http=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies));self.org=None
 def pedir(self,ruta,datos=None,metodo=None,esperado=200,crudo=False):
  headers={'Origin':base}
  if self.org:headers['X-Organizacion']=self.org
  for c in self.cookies:
   if c.name=='tuvoto-csrf':headers['X-CSRF-Token']=c.value
  if datos is not None:headers['Content-Type']='application/json'
  req=urllib.request.Request(base+ruta,data=json.dumps(datos).encode() if datos is not None else None,headers=headers,method=metodo or ('POST' if datos is not None else 'GET'))
  try:
   with self.http.open(req,timeout=120) as r:estado=r.status;contenido=r.read()
  except urllib.error.HTTPError as e:estado=e.code;contenido=e.read()
  assert estado==esperado,f'{req.method} {ruta}: HTTP {estado}, esperado {esperado}'
  if crudo:return contenido
  return json.loads(contenido) if contenido else None
 def login(self,usuario,clave):self.pedir('/api/v1/autenticacion/csrf');self.pedir('/api/v1/autenticacion/login',{'usuario':usuario,'contrasena':clave})

def excel(columnas,filas):
 def letra(n):return chr(65+n)
 rows=''.join('<row r="'+str(i+1)+'">'+''.join('<c r="'+letra(j)+str(i+1)+'" t="inlineStr"><is><t xml:space="preserve">'+escape(str(v))+'</t></is></c>' for j,v in enumerate(f))+'</row>' for i,f in enumerate([columnas,*filas]))
 archivos={'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>', '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>', 'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Datos" sheetId="1" r:id="rId1"/></sheets></workbook>', 'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>', 'xl/worksheets/sheet1.xml':'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+rows+'</sheetData></worksheet>'}
 buffer=io.BytesIO()
 with zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as z:
  for n,v in archivos.items():z.writestr(n,v)
 return base64.b64encode(buffer.getvalue()).decode()

comprobaciones=[]
def ok(nombre):comprobaciones.append(nombre);print('OK:',nombre,flush=True)
raiz=Path(__file__).resolve().parents[2]
carpeta=Path(contexto['carpeta']);credenciales=carpeta/'cuenta-prueba.json'
if credenciales.exists():cred=json.loads(credenciales.read_text())
else:
 cred={'usuario':'admin.pruebas','contrasena':secrets.token_urlsafe(24)}
 r=subprocess.run(['docker','exec','-i',proyecto+'-identidad-1','node','dist/administrar.js'],input=json.dumps(cred),text=True,capture_output=True);assert r.returncode==0,'Bootstrap aislado no confirmado'
 with os.fdopen(os.open(credenciales,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'w') as f:json.dump(cred,f)
admin=Cliente();admin.login(cred['usuario'],cred['contrasena']);anonimo=Cliente();anonimo.pedir('/api/v1/usuarios',esperado=401)
sufijo=uuid4().hex[:8]
org=admin.pedir('/api/v1/organizaciones',{'nombre':'Organización sintética '+sufijo},esperado=201)['idOrganizacion'];admin.org=org
otra=admin.pedir('/api/v1/organizaciones',{'nombre':'Otra organización sintética '+sufijo},esperado=201)['idOrganizacion']
usuario='operador.'+sufijo;clave=secrets.token_urlsafe(20)
archivo=excel(['usuario','contrasena'],[[usuario,clave],['auxiliar.'+sufijo,secrets.token_urlsafe(20)]])
ruta='/api/v1/importaciones/operadores';datos={'archivo':archivo,'idOrganizacion':org}
v=admin.pedir(ruta+'/previsualizar',datos);assert not v['errores'],'La plantilla de operadores no validó';assert clave not in json.dumps(v)
admin.pedir(ruta+'/confirmar',{**datos,'huella':v['huella'],'confirmar':True},esperado=201)
v=admin.pedir(ruta+'/previsualizar',datos);assert v['errores'];admin.pedir(ruta+'/confirmar',{**datos,'huella':v['huella'],'confirmar':True},esperado=409)
op=Cliente();op.login(usuario,clave);op.org=org;op.pedir(ruta+'/previsualizar',datos,esperado=403)
archivo_invalido=excel(['usuario','contrasena'],[['valido.'+sufijo,secrets.token_urlsafe(20)],['invalido.'+sufijo,'corta']]);d={'archivo':archivo_invalido,'idOrganizacion':org};v=admin.pedir(ruta+'/previsualizar',d);assert v['errores'];admin.pedir(ruta+'/confirmar',{**d,'huella':v['huella'],'confirmar':True},esperado=409);assert admin.pedir('/api/v1/usuarios?usuario=valido.'+sufijo)['total']==0
ok('Excel operadores: bcrypt/login real, claves ocultas, duplicados sin cambiar contraseña, rollback de lote y 403 al operador')
operador=admin.pedir('/api/v1/usuarios?usuario='+usuario)['elementos'][0]['idUsuario']
with os.fdopen(os.open(carpeta/'operador-interfaz.json',os.O_WRONLY|os.O_CREAT|os.O_TRUNC|os.O_NOFOLLOW,0o600),'w') as f:
 os.fchmod(f.fileno(),0o600);json.dump({'usuario':usuario,'contrasena':clave,'idOrganizacion':org},f)
sectores=[{'codigo':'docentes','nombre':'Docentes','pesoBps':3000},{'codigo':'estudiantes','nombre':'Estudiantes','pesoBps':7000}]
config={'nombre':'Rector sintético '+sufijo,'cargo':'Rector','tipo':'universidad','unidad':'Carrera','ambito':'Universidad sintética','vuelta':1,'idPrimeraVuelta':None,'sectores':sectores,'ponderacion':True,'reglaSegundaVuelta':{'modo':'por_sector','umbral':50,'estricto':True}}
admin.pedir('/api/v1/configuracion/procesos',{**config,'sectores':[{**sectores[0],'pesoBps':5000},sectores[1]]},esperado=422)
p=admin.pedir('/api/v1/configuracion/procesos',config,esperado=201);idp=p['id']

# Mismo Excel: en la ruta individual se explican las columnas; en la conjunta se valida sin cambiar datos.
archivo_conjunto=excel(['cargo','ambito','vuelta','nombre','orden'],[['Rector',config['ambito'],1,'Candidatura de formato sintética',1]])
ruta_individual=f'/api/v1/configuracion/procesos/{idp}/importaciones/candidatos/previsualizar'
r=admin.pedir(ruta_individual,{'archivo':archivo_conjunto},esperado=422);assert 'Columnas incorrectas' in r['detail'] and 'nombre, orden' in r['detail']
v=admin.pedir('/api/v1/configuracion/importaciones-generales/candidatos/previsualizar',{'archivo':archivo_conjunto});assert not v['errores'] and v['total']==1
assert not admin.pedir('/api/v1/configuracion/procesos/'+idp)['candidatos']
ok('Formato de candidatos: archivo conjunto rechazado con columnas precisas en ruta individual, aceptado en ruta conjunta sin escribir datos')


def importar(idp,tipo,columnas,filas):
 ruta=f'/api/v1/configuracion/procesos/{idp}/importaciones/{tipo}';d={'archivo':excel(columnas,filas)}
 plantilla=admin.pedir(ruta+'/plantilla',crudo=True);assert plantilla[:2]==b'PK'
 v=admin.pedir(ruta+'/previsualizar',d);assert not v['errores'],f'Vista previa {tipo}: '+str(v['errores'])
 admin.pedir(ruta+'/confirmar',{**d,'huella':v['huella'],'confirmar':True},esperado=201)
 return admin.pedir('/api/v1/configuracion/procesos/'+idp)
# Las asignaciones organizan el trabajo; no certifican un catálogo terminado.
previa=admin.pedir('/api/v1/configuracion/procesos',{**config,'nombre':'Preparación sintética '+sufijo,'cargo':'Decano'},esperado=201)
idprevia=previa['id']
previa=admin.pedir(f'/api/v1/configuracion/procesos/{idprevia}/mesas',{'codigo':'PRE-DOC','unidad':'Facultad sintética','sector':'docentes'},esperado=201)
midprevia=previa['mesas'][0]['id']
previa=admin.pedir(f'/api/v1/configuracion/procesos/{idprevia}/mesas',{'codigo':'PRE-EST','unidad':'Facultad sintética','sector':'estudiantes'},esperado=201)
ruta_previa=f'/api/v1/configuracion/mesas/{midprevia}/asignar'
anonimo.pedir(ruta_previa,{'idUsuario':operador},esperado=401)
op.pedir(ruta_previa,{'idUsuario':operador},esperado=403)
admin.pedir(ruta_previa,{'idUsuario':operador},esperado=204)
admin.pedir(ruta_previa,{'idUsuario':operador},esperado=204)
assert len(admin.pedir(f'/api/v1/configuracion/procesos/{idprevia}/asignaciones')['elementos'])==1
admin.org=otra
try:admin.pedir(ruta_previa,{'idUsuario':operador},esperado=404)
finally:admin.org=org
previa=importar(idprevia,'asignaciones',['usuario','codigoMesa'],[[usuario,'PRE-EST']])
assert not previa['candidatos'] and len(admin.pedir(f'/api/v1/configuracion/procesos/{idprevia}/asignaciones')['elementos'])==2
admin.pedir(f'/api/v1/configuracion/procesos/{idprevia}/actual',{'confirmar':True},esperado=422)
admin.pedir(f'/api/v1/configuracion/procesos/{idprevia}/candidatos',{'nombre':'Decano sintético A'},esperado=201)
previa=importar(idprevia,'candidatos',['nombre','orden'],[['Decano sintético B','2']])
assert len(previa['candidatos'])==2 and previa['estado']=='borrador'
ok('Preparación flexible: asignaciones REST y Excel sin candidatos, reintento sin duplicar, 401/403/404, inicio incompleto rechazado y candidatos añadidos después')
# Importación de cargos por institución, sin habilitar recepción ni mezclar grupos.
org_cargos=admin.pedir('/api/v1/organizaciones',{'nombre':'Universidad de cargos '+sufijo},esperado=201)['idOrganizacion'];admin.org=org_cargos
operador_cargos=admin.pedir('/api/v1/usuarios',{'usuario':'mesas.cargos.'+sufijo,'contrasena':secrets.token_urlsafe(24),'idOrganizacion':org_cargos,'rol':'OPERADOR'},esperado=201)['idUsuario']
ruta_cargos='/api/v1/configuracion/importaciones/cargos'
columnas_cargos=['cargo','facultad','grupoCarreras','carreras']
facultad='Tecnología sintética '+sufijo
filas_cargos=[['Rector','','',''],['Vicerrector','','',''],['Decano',facultad,'',''],['Director',facultad,'A','Sistemas; Civil'],['Director',facultad,'B','Química; Industrial']]
assert admin.pedir(ruta_cargos+'/plantilla',crudo=True).startswith(b'PK')
dc={'nombre':'Universidad sintética '+sufijo,'archivo':excel(columnas_cargos,filas_cargos)}
anonimo.pedir(ruta_cargos+'/previsualizar',dc,esperado=401);op.pedir(ruta_cargos+'/previsualizar',dc,esperado=403)
v=admin.pedir(ruta_cargos+'/previsualizar',dc);assert not v['errores'] and v['total']==5
admin.pedir(ruta_cargos+'/confirmar',{**dc,'huella':'invalida','confirmar':True},esperado=409)
admin.pedir(ruta_cargos+'/confirmar',{**dc,'huella':v['huella'],'confirmar':True},esperado=201)
cargos_importados=[p for p in admin.pedir('/api/v1/configuracion/procesos')['elementos'] if p['nombre']==dc['nombre']]
assert len(cargos_importados)==5 and all(p['estado']=='borrador' for p in cargos_importados)
antes_mantener=admin.pedir('/api/v1/configuracion/procesos')['elementos']
v=admin.pedir(ruta_cargos+'/previsualizar',dc);assert not v['errores'] and v['resumen']=={'creados':0,'actualizados':0,'mantenidos':5}
r=admin.pedir(ruta_cargos+'/confirmar',{**dc,'huella':v['huella'],'confirmar':True},esperado=201);assert r=={'importados':0,'creados':0,'actualizados':0,'mantenidos':5}
assert sorted(antes_mantener,key=lambda p:p['id'])==sorted(admin.pedir('/api/v1/configuracion/procesos')['elementos'],key=lambda p:p['id'])
mal={'nombre':dc['nombre'],'archivo':excel(columnas_cargos,[['Decano','No debe crearse '+sufijo,'',''],['Alcalde','','','']])}
v=admin.pedir(ruta_cargos+'/previsualizar',mal);assert v['errores'];admin.pedir(ruta_cargos+'/confirmar',{**mal,'huella':v['huella'],'confirmar':True},esperado=409)
assert not any(p.get('facultad')=='No debe crearse '+sufijo for p in admin.pedir('/api/v1/configuracion/procesos')['elementos'])
directores={p['grupoCarreras']:p for p in cargos_importados if p['cargo']=='Director'}
a,b=directores['A'],directores['B'];assert a['carreras']==['Sistemas','Civil'] and b['carreras']==['Química','Industrial']
admin.pedir(f"/api/v1/configuracion/procesos/{b['id']}/mesas",{'codigo':'GR-01','unidad':'Sistemas'},esperado=422)
a=admin.pedir(f"/api/v1/configuracion/procesos/{a['id']}/mesas",{'codigo':'GR-01','unidad':'Sistemas'},esperado=201)
b=admin.pedir(f"/api/v1/configuracion/procesos/{b['id']}/mesas",{'codigo':'GR-01','unidad':'Química'},esperado=201)
assert a['mesas'][0]['id']!=b['mesas'][0]['id']
for p in [a,b]:admin.pedir('/api/v1/configuracion/mesas/'+p['mesas'][0]['id']+'/asignar',{'idUsuario':operador_cargos},esperado=204)
asignaciones=admin.pedir('/api/v1/configuracion/asignaciones')['elementos']
assert all(any(r['idUsuario']==operador_cargos and r['idProceso']==p['id'] and r['codigo']=='GR-01' for r in asignaciones) for p in [a,b])
op.pedir('/api/v1/configuracion/asignaciones',esperado=403)
admin.org=otra
try:assert not admin.pedir('/api/v1/configuracion/asignaciones')['elementos']
finally:admin.org=org_cargos
solapada={'nombre':dc['nombre'],'archivo':excel(columnas_cargos,[['Director',facultad,'C','Sistemas']])}
v=admin.pedir(ruta_cargos+'/previsualizar',solapada);assert v['errores']
admin.pedir('/api/v1/configuracion/procesos',{'nombre':dc['nombre'],'tipo':'universidad','cargo':'Director','unidad':'Carrera','ambito':facultad+' · C','facultad':facultad,'grupoCarreras':'C','carreras':['Sistemas']},esperado=409)
ruta_b=f"/api/v1/configuracion/procesos/{b['id']}/importaciones/mesas"
v=admin.pedir(ruta_b+'/previsualizar',{'archivo':excel(['codigo','unidad'],[['FUERA','Sistemas']])});assert v['errores']
# Dos confirmaciones simultáneas del mismo lote crean una sola copia.
d2={'nombre':dc['nombre'],'archivo':excel(columnas_cargos,[['Decano','Facultad concurrente '+sufijo,'','']])};v=admin.pedir(ruta_cargos+'/previsualizar',d2)
def confirmar_cargos(_):
 try:admin.pedir(ruta_cargos+'/confirmar',{**d2,'huella':v['huella'],'confirmar':True},esperado=201);return 201
 except AssertionError as e:
  if 'HTTP 409' in str(e):return 409
  raise
with ThreadPoolExecutor(max_workers=2) as e:assert sorted(e.map(confirmar_cargos,[1,2]))==[201,409]
ok('Cargos Excel: cuatro tipos, grupos separados, carreras exclusivas por Director, lote atómico, duplicados y concurrencia; operadores consultables por mesa y cargo con separación de organizaciones')

# Reemplazar solo la configuración importable del Director A; preservar relaciones y opciones.
ra=f"/api/v1/configuracion/procesos/{a['id']}"
aconfig={'nombre':a['nombre'],'cargo':a['cargo'],'tipo':a['tipo'],'unidad':a['unidad'],'facultad':a['facultad'],'grupoCarreras':a['grupoCarreras'],'carreras':a['carreras'],'ambito':a['ambito'],'vuelta':1,'sectores':sectores,'ponderacion':True,'reglaSegundaVuelta':{'modo':'por_sector','umbral':50,'estricto':True}}
# Su mesa general impediría introducir sectores; mantener la configuración sectorial vacía.
aconfig['sectores']=[];aconfig['ponderacion']=False;aconfig['reglaSegundaVuelta']={'modo':'porcentaje','umbral':60,'estricto':True}
a=admin.pedir(ra,aconfig,metodo='PUT')
a=admin.pedir(ra+'/candidatos',{'nombre':'Candidato preservado '+sufijo},esperado=201)
asignaciones_antes=admin.pedir(ra+'/asignaciones')
reemplazo={'nombre':'Nombre del archivo no debe renombrar el proceso','archivo':excel(columnas_cargos,[['Director',facultad,'A','Sistemas; Civil; Nueva sintética']])}
v_mantener=admin.pedir(ruta_cargos+'/previsualizar',reemplazo);assert not v_mantener['errores'] and v_mantener['coincidencias'][0]['accion']=='mantener'
reemplazo['resoluciones']={'2':'reemplazar'}
admin.pedir(ruta_cargos+'/confirmar',{**reemplazo,'huella':v_mantener['huella'],'confirmar':True},esperado=409)
v=admin.pedir(ruta_cargos+'/previsualizar',reemplazo);assert not v['errores'] and v['resumen']['actualizados']==1
r=admin.pedir(ruta_cargos+'/confirmar',{**reemplazo,'huella':v['huella'],'confirmar':True},esperado=201);assert r=={'importados':1,'creados':0,'actualizados':1,'mantenidos':0}
nuevo_a=admin.pedir(ra);assert nuevo_a['carreras']==['Sistemas','Civil','Nueva sintética']
for campo in ['id','nombre','cargo','tipo','ambito','vuelta','sectores','ponderacion','reglaSegundaVuelta','estado','candidatos','mesas']:assert nuevo_a[campo]==a[campo],campo
assert admin.pedir(ra+'/asignaciones')==asignaciones_antes
# Retirar una carrera usada o tomar una carrera de otro Director cancela el lote completo.
for carreras in ['Civil','Sistemas; Química']:
 mal_reemplazo={**reemplazo,'archivo':excel(columnas_cargos,[['Director',facultad,'A',carreras],['Decano','No crear al fallar '+sufijo,'','']])}
 v=admin.pedir(ruta_cargos+'/previsualizar',mal_reemplazo);assert v['errores']
 admin.pedir(ruta_cargos+'/confirmar',{**mal_reemplazo,'huella':v['huella'],'confirmar':True},esperado=409)
 assert admin.pedir(ra)==nuevo_a
 assert not any(p.get('facultad')=='No crear al fallar '+sufijo for p in admin.pedir('/api/v1/configuracion/procesos')['elementos'])
# Mantener, reemplazar y crear en un solo lote; no sustituye configuraciones mantenidas.
mixto={'nombre':dc['nombre'],'archivo':excel(columnas_cargos,[['Rector','','',''],['Director',facultad,'A','Sistemas; Civil; Nueva sintética; Otra sintética'],['Decano','Nueva facultad '+sufijo,'','']]),'resoluciones':{'3':'reemplazar'}}
v=admin.pedir(ruta_cargos+'/previsualizar',mixto);assert not v['errores'] and v['resumen']=={'creados':1,'actualizados':1,'mantenidos':1}
r=admin.pedir(ruta_cargos+'/confirmar',{**mixto,'huella':v['huella'],'confirmar':True},esperado=201);assert r['mantenidos']==r['actualizados']==r['creados']==1
# La vista previa caduca si se edita el destino; no pisa cambios intermedios.
v=admin.pedir(ruta_cargos+'/previsualizar',reemplazo);assert not v['errores']
a_modificado=admin.pedir(ra,{**aconfig,'nombre':'Nombre cambiado entre revisiones '+sufijo},metodo='PUT')
admin.pedir(ruta_cargos+'/confirmar',{**reemplazo,'huella':v['huella'],'confirmar':True},esperado=409)
assert admin.pedir(ra)==a_modificado
# Tampoco puede reemplazar un usuario de otra organización mediante las decisiones por fila.
admin.org=otra
try:
 v=admin.pedir(ruta_cargos+'/previsualizar',reemplazo);assert not v['coincidencias'] and v['resumen']['creados']==1
finally:admin.org=org_cargos
# Recepción y cierre: mantener permitido, reemplazar denegado incluso por REST directo.
a_candidato=admin.pedir(ra)['candidatos'][0]['id'];assert a_candidato
v=admin.pedir(ruta_cargos+'/previsualizar',reemplazo);assert not v['errores']
admin.pedir(ra+'/actual',{'confirmar':True})
admin.pedir(ruta_cargos+'/confirmar',{**reemplazo,'huella':v['huella'],'confirmar':True},esperado=409)
for estado in ['recepcion','cerrada']:
 if estado=='cerrada':admin.pedir(ra+'/estado',{'estado':'cerrada','confirmar':True})
 v=admin.pedir(ruta_cargos+'/previsualizar',reemplazo);assert v['errores'] and not v['coincidencias'][0]['puedeReemplazar']
 admin.pedir(ruta_cargos+'/confirmar',{**reemplazo,'huella':v['huella'],'confirmar':True},esperado=409)
 mantener_cerrado={**reemplazo,'resoluciones':{'2':'mantener'}};v=admin.pedir(ruta_cargos+'/previsualizar',mantener_cerrado);assert not v['errores']
 antes_cerrado=admin.pedir(ra)
 r=admin.pedir(ruta_cargos+'/confirmar',{**mantener_cerrado,'huella':v['huella'],'confirmar':True},esperado=201);assert r['mantenidos']==1 and r['importados']==0
 assert admin.pedir(ra)==antes_cerrado
ok('Cargos existentes: mantener sin cambios, reemplazo selectivo sin perder IDs/candidatos/mesas/asignaciones/reglas, lote mixto, decisiones y vistas revalidadas, 409 por carreras usadas y bloqueo real en recepción/cierre')



# Una hoja por módulo para todos los cargos de una organización, con confirmación atómica.
comun=['cargo','ambito','vuelta']
gconfig={'nombre':'Lote conjunto sintético '+sufijo,'cargo':'Decano','tipo':'universidad','unidad':'Facultad'}
g1=admin.pedir('/api/v1/configuracion/procesos',{**gconfig,'ambito':'Facultad A '+sufijo},esperado=201)
g2=admin.pedir('/api/v1/configuracion/procesos',{**gconfig,'ambito':'Facultad B '+sufijo},esperado=201)
def leer_global(p):return admin.pedir('/api/v1/configuracion/procesos/'+p['id'])
def datos_global(tipo,cols,filas):return '/api/v1/configuracion/importaciones-generales/'+tipo,{'archivo':excel(comun+cols,filas)}
def confirmar_global(ruta,d):
 v=admin.pedir(ruta+'/previsualizar',d);assert not v['errores'],v['errores']
 return admin.pedir(ruta+'/confirmar',{**d,'huella':v['huella'],'confirmar':True},esperado=201)
def prefijo(p):return [p['cargo'],p['ambito'],1]
rg,dg=datos_global('candidatos',['nombre'],[prefijo(g1)+['Sintético A'],prefijo(g2)+['Sintético B']])
assert admin.pedir(rg+'/plantilla',crudo=True).startswith(b'PK')
anonimo.pedir(rg+'/previsualizar',dg,esperado=401);op.pedir(rg+'/previsualizar',dg,esperado=403)
assert confirmar_global(rg,dg)=={'importados':2,'cargos':2}
assert leer_global(g1)['candidatos'][0]['nombre']=='Sintético A' and leer_global(g2)['candidatos'][0]['nombre']=='Sintético B'
rgm,dgm=datos_global('mesas',['codigo','unidad','sector'],[prefijo(g1)+['MISMO-01','Facultad A',''],prefijo(g2)+['MISMO-01','Facultad B','']])
assert confirmar_global(rgm,dgm)['importados']==2
rga,dga=datos_global('asignaciones',['usuario','codigoMesa'],[prefijo(g1)+['mesas.cargos.'+sufijo,'MISMO-01'],prefijo(g2)+['mesas.cargos.'+sufijo,'MISMO-01']])
assert confirmar_global(rga,dga)['importados']==2
for gp in [g1,g2]:assert len(admin.pedir('/api/v1/configuracion/procesos/'+gp['id']+'/asignaciones')['elementos'])==1
# Un duplicado en B no crea la fila válida en A.
_,invalido=datos_global('candidatos',['nombre'],[prefijo(g1)+['No debe insertarse'],prefijo(g2)+['Sintético B']]);v=admin.pedir(rg+'/previsualizar',invalido);assert v['errores']
admin.pedir(rg+'/confirmar',{**invalido,'huella':v['huella'],'confirmar':True},esperado=409);assert len(leer_global(g1)['candidatos'])==1
# Duplicidad de etiqueta requiere escoger UUID explícitamente, sin cambiar archivo.
g3=admin.pedir('/api/v1/configuracion/procesos',{**gconfig,'ambito':g2['ambito']},esperado=201)
_,ambiguo=datos_global('candidatos',['nombre'],[prefijo(g2)+['Candidato elegido explícitamente']]);v=admin.pedir(rg+'/previsualizar',ambiguo);assert v['errores']
ref=v['referencias'][0]['referencia'];ambiguo['asociaciones']={ref:g3['id']};v=admin.pedir(rg+'/previsualizar',ambiguo);assert not v['errores']
# Un mapa manipulado después de revisar no conserva la huella.
admin.pedir(rg+'/confirmar',{**ambiguo,'asociaciones':{ref:g2['id']},'huella':v['huella'],'confirmar':True},esperado=409)
admin.pedir(rg+'/confirmar',{**ambiguo,'huella':v['huella'],'confirmar':True},esperado=201)
assert len(leer_global(g3)['candidatos'])==1 and len(leer_global(g2)['candidatos'])==1
ajeno={**ambiguo,'asociaciones':{ref:idp}};v=admin.pedir(rg+'/previsualizar',ajeno);assert v['errores'];admin.pedir(rg+'/confirmar',{**ajeno,'huella':v['huella'],'confirmar':True},esperado=409)
# Una sola aplicación concurrente, serializada con las importaciones individuales.
_,concurrente=datos_global('candidatos',['nombre'],[prefijo(g1)+['Candidatura concurrente']]);v=admin.pedir(rg+'/previsualizar',concurrente)
def confirmar_global_concurrente(_):
 try:admin.pedir(rg+'/confirmar',{**concurrente,'huella':v['huella'],'confirmar':True},esperado=201);return 201
 except AssertionError as e:
  if 'HTTP 409' in str(e):return 409
  raise
with ThreadPoolExecutor(max_workers=2) as e:assert sorted(e.map(confirmar_global_concurrente,[1,2]))==[201,409]
# Un cargo abierto entre revisión y confirmación invalida el lote entero.
_,tardio=datos_global('candidatos',['nombre'],[prefijo(g1)+['Tardío prohibido'],prefijo(g3)+['Tampoco insertar']]);tardio['asociaciones']={ref:g3['id']};v=admin.pedir(rg+'/previsualizar',tardio);assert not v['errores']
admin.pedir('/api/v1/configuracion/procesos/'+g1['id']+'/actual',{'confirmar':True})
admin.pedir(rg+'/confirmar',{**tardio,'huella':v['huella'],'confirmar':True},esperado=409)
assert len(leer_global(g1)['candidatos'])==2 and len(leer_global(g3)['candidatos'])==1
# Tampoco una asociación manual puede duplicar el mismo candidato por dos etiquetas distintas.
_,repetido=datos_global('candidatos',['nombre'],[['Decano','Etiqueta X',1,'Repetido'],['Decano','Etiqueta Y',1,'Repetido']]);v=admin.pedir(rg+'/previsualizar',repetido)
repetido['asociaciones']={r['referencia']:g3['id'] for r in v['referencias']};v=admin.pedir(rg+'/previsualizar',repetido);assert v['errores']
admin.pedir(rg+'/confirmar',{**repetido,'huella':v['huella'],'confirmar':True},esperado=409)
ok('Excel conjuntos: candidatos/mesas/asignaciones en dos cargos persistidos, referencias explícitas, rollback íntegro, 401/403, aislamiento, huella ligada al destino, concurrencia y bloqueo tras iniciar')

admin.org=org
p=importar(idp,'candidatos',['nombre','orden'],[['Candidatura A','1'],['Candidatura B','2']])
archivo_mesa=excel(['codigo','unidad','sector'],[['INVALIDA','Carrera sintética','no-configurado']]);ruta=f'/api/v1/configuracion/procesos/{idp}/importaciones/mesas';v=admin.pedir(ruta+'/previsualizar',{'archivo':archivo_mesa});assert v['errores'];admin.pedir(ruta+'/confirmar',{'archivo':archivo_mesa,'huella':v['huella'],'confirmar':True},esperado=409)
p=importar(idp,'mesas',['codigo','unidad','sector'],[['DOC-01','Carrera sintética','docentes'],['EST-01','Carrera sintética','estudiantes']])
admin.pedir(f'/api/v1/configuracion/procesos/{idp}/actual',{'confirmar':True},esperado=422)
p=importar(idp,'asignaciones',['usuario','codigoMesa'],[[usuario,'DOC-01'],[usuario,'EST-01']])
assert len(admin.pedir(f'/api/v1/configuracion/procesos/{idp}/asignaciones')['elementos'])==2
admin.pedir(f'/api/v1/configuracion/procesos/{idp}/actual',{'confirmar':True})
admin.pedir(f'/api/v1/configuracion/procesos/{idp}/candidatos',{'nombre':'Candidato tardío sintético'},esperado=409)
admin.pedir(f"/api/v1/configuracion/mesas/{p['mesas'][0]['id']}/asignar",{'idUsuario':operador},esperado=409)
admin.pedir(f'/api/v1/configuracion/procesos/{idp}',{**config,'ponderacion':False},metodo='PUT',esperado=409)
mesas={m['codigo']:m for m in p['mesas']};candidatos={c['nombre']:c['id'] for c in p['candidatos']}
ok('Excel candidatos, mesas y asignaciones: plantillas reales, sectores validados, referencias y configuración congelada')
png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9XcAAAAASUVORK5CYII=')
def acta(mesa,candidatos,a,b,version=0,origen=None):
 d={'idMesa':mesa,'idSolicitud':str(uuid4()),'versionAnterior':version,'votos':[{'idCandidato':candidatos['Candidatura A'],'cantidad':a},{'idCandidato':candidatos['Candidatura B'],'cantidad':b}],'blancos':0,'nulos':0,'total':a+b,'confirmado':True}
 if origen:d['idActaOrigen']=origen
 else:d['foto']='data:image/png;base64,'+base64.b64encode(png+uuid4().bytes).decode()
 return d

def registrar_gql(d):
 r=op.pedir('/graphql',{'query':'mutation($entrada:NuevaActa!){registrarActa(entrada:$entrada){id version estado}}','variables':{'entrada':d}});assert not r.get('errors'),'Mutation no confirmada';return r['data']['registrarActa']
doc=acta(mesas['DOC-01']['id'],candidatos,70,30)
op.pedir('/api/v1/actas',{**doc,'sector':'estudiantes'},esperado=422)
admin.pedir('/api/v1/actas',doc,esperado=403)
primera=registrar_gql(doc);assert registrar_gql(doc)['id']==primera['id']
est=acta(mesas['EST-01']['id'],candidatos,300,700);registrar_gql(est)

def esperar_resultado(idp,condicion):
 for _ in range(45):
  r=anonimo.pedir('/api/v1/publico/resultados/'+idp)
  if condicion(r):return r
  time.sleep(1)
 raise AssertionError('La proyección no alcanzó el estado esperado')
r=esperar_resultado(idp,lambda r:r['contabilizadas']==2)
assert r['total']==1100;assert [c['porcentajePonderado'] for c in r['candidatos']]==[42,58];assert r['regla']['estado']=='posible_segunda_vuelta'
gql=anonimo.pedir('/graphql',{'query':'query($id:ID){eleccionesPublicadas{id cargo vuelta} portal(idProceso:$id){proceso{id sectores{codigo pesoBps}} resultados{total ponderacionAplicada sectores{validos} regla{estado}} recepcion{mesasConActa}}}','variables':{'id':idp}});assert not gql.get('errors');assert gql['data']['portal']['recepcion']['mesasConActa']==2
ok('NGINX → GraphQL → Actas → gRPC → PostgreSQL/outbox → RabbitMQ → MongoDB: pesos 30/70, votos por sector y regla por sector')
config2={**config,'nombre':'Vicerrector sintético '+sufijo,'cargo':'Vicerrector','reglaSegundaVuelta':None};p2=admin.pedir('/api/v1/configuracion/procesos',config2,esperado=201);id2=p2['id']
p2=importar(id2,'candidatos',['nombre','orden'],[['Candidatura A','1'],['Candidatura B','2']]);p2=importar(id2,'mesas',['codigo','unidad','sector'],[['DOC-02','Carrera sintética','docentes'],['EST-02','Carrera sintética','estudiantes']]);p2=importar(id2,'asignaciones',['usuario','codigoMesa'],[[usuario,'DOC-02'],[usuario,'EST-02']]);admin.pedir(f'/api/v1/configuracion/procesos/{id2}/actual',{'confirmar':True})
c2={c['nombre']:c['id'] for c in p2['candidatos']};m2={m['codigo']:m for m in p2['mesas']}
reutilizada=registrar_gql(acta(m2['DOC-02']['id'],c2,70,30,origen=primera['id']))
assert op.pedir('/api/v1/actas/'+reutilizada['id']+'/foto',crudo=True)==op.pedir('/api/v1/actas/'+primera['id']+'/foto',crudo=True)
op.pedir('/api/v1/actas',acta(m2['EST-02']['id'],c2,300,700,origen=primera['id']),esperado=422)
assert anonimo.pedir('/api/v1/publico/procesos/'+idp)['id']==idp
ok('Foto compartida explícita entre cargos, sector incorrecto rechazado y elecciones publicadas consultables sin mezclar conteos')
# Solicitudes concurrentes: una sola nueva versión de la misma mesa.
def corregir(d):
 try:op.pedir('/api/v1/actas/mesas/'+d['idMesa'],d,metodo='PUT');return 200
 except AssertionError as e:
  if 'HTTP 409' in str(e):return 409
  raise
with ThreadPoolExecutor(max_workers=2) as ejecutor:estados=list(ejecutor.map(corregir,[acta(mesas['EST-01']['id'],candidatos,400,600,1),acta(mesas['EST-01']['id'],candidatos,500,500,1)]))
assert sorted(estados)==[200,409]
historial=op.pedir('/api/v1/actas/mesa/'+mesas['EST-01']['id']);assert historial['versionAnterior']==2
ok('Correcciones simultáneas: una versión aceptada, conflicto 409 y original preservado')
segunda={**config,'nombre':'Rector segunda vuelta sintética '+sufijo,'vuelta':2,'idPrimeraVuelta':idp,'reglaSegundaVuelta':None};p3=admin.pedir('/api/v1/configuracion/procesos',segunda,esperado=201)
for origen in candidatos.values():p3=admin.pedir(f"/api/v1/configuracion/procesos/{p3['id']}/candidatos",{'idCandidatoOrigen':origen},esperado=201)
assert {c['idCandidatoOrigen'] for c in p3['candidatos']}==set(candidatos.values());assert not {c['id'] for c in p3['candidatos']}&set(candidatos.values())
assert op.pedir('/api/v1/actas/mesa/'+mesas['DOC-01']['id'])['versionAnterior']==1
ok('Segunda vuelta independiente: participantes vinculados, nuevos IDs y primera vuelta intacta')
otro_usuario='ajeno.'+sufijo;otra_clave=secrets.token_urlsafe(20);admin.pedir('/api/v1/usuarios',{'usuario':otro_usuario,'contrasena':otra_clave,'idOrganizacion':otra,'rol':'OPERADOR'},esperado=201)
ajeno=Cliente();ajeno.login(otro_usuario,otra_clave);ajeno.org=otra;ajeno.pedir('/api/v1/actas/'+primera['id']+'/foto',esperado=404);ajeno.pedir('/api/v1/mesas/'+mesas['DOC-01']['id']+'/contexto',esperado=403)
op.pedir('/api/v1/usuarios/'+operador+'/roles',{'rol':'ADMINISTRADOR','idOrganizacion':org},esperado=403)
ok('Aislamiento entre organizaciones y prevención de escalamiento de rol')
# Conteo general sin pesos: plantilla anterior sigue funcionando.
simple={k:v for k,v in config.items() if k in ['nombre','cargo','tipo','unidad']};simple.update(nombre='General sintético '+sufijo,cargo='Alcaldía',tipo='municipio')
p4=admin.pedir('/api/v1/configuracion/procesos',simple,esperado=201);p4=importar(p4['id'],'candidatos',['nombre'],[['Candidatura A'],['Candidatura B']]);p4=importar(p4['id'],'mesas',['codigo','unidad'],[['GENERAL-01','Distrito sintético']]);p4=importar(p4['id'],'asignaciones',['usuario','codigoMesa'],[[usuario,'GENERAL-01']]);admin.pedir(f"/api/v1/configuracion/procesos/{p4['id']}/actual",{'confirmar':True});registrar_gql(acta(p4['mesas'][0]['id'],{c['nombre']:c['id'] for c in p4['candidatos']},3,7))
r=esperar_resultado(p4['id'],lambda r:r['contabilizadas']==1);assert not r['ponderacionAplicada'] and r['total']==10 and r['regla']['estado']=='desactivada';assert r['candidatos'][0]['porcentaje']==30
ok('Compatibilidad del conteo general: votos iguales y opciones avanzadas desactivadas')
# Ciclo básico: borrador editable, apertura, cierre inmutable y archivo sin borrar actas.
borrador=admin.pedir('/api/v1/configuracion/procesos',simple,esperado=201);assert borrador['estado']=='borrador'
admin.pedir('/api/v1/configuracion/procesos/'+borrador['id'],{**simple,'nombre':'Borrador editable '+sufijo},metodo='PUT')
admin.pedir('/api/v1/configuracion/procesos/'+borrador['id']+'/estado',{'estado':'archivada','confirmar':True},esperado=409)
admin.pedir('/api/v1/configuracion/procesos/'+borrador['id'],metodo='DELETE',esperado=204)
admin.pedir('/api/v1/configuracion/procesos/'+borrador['id'],esperado=404)
idc=p4['id'];mid=p4['mesas'][0]['id'];cc={c['nombre']:c['id'] for c in p4['candidatos']}
# Reserva real por gRPC, sin escribir votos, demuestra la exclusión con el cierre.
cabeceras={'Cookie':'; '.join(c.name+'='+c.value for c in op.cookies),'Origin':base,'X-Organizacion':org}
for cookie in op.cookies:
 if cookie.name=='tuvoto-csrf':cabeceras['X-CSRF-Token']=cookie.value
registro=str(uuid4())
def reserva(finalizar=False):
 programa="""import json,sys
from types import SimpleNamespace
from app.cliente_mesas import consultar_mesa
d=json.load(sys.stdin)
consultar_mesa(SimpleNamespace(headers=d['cabeceras']),d['mesa'],not d['finalizar'],d['registro'],d['finalizar'])
print('OK')
"""
 r=subprocess.run(['docker','exec','-i',proyecto+'-actas-1','python','-c',programa],input=json.dumps({'cabeceras':cabeceras,'mesa':mid,'registro':registro,'finalizar':finalizar}),capture_output=True,text=True)
 assert r.returncode==0 and r.stdout.strip()=='OK','Reserva gRPC no confirmada'
reserva()
admin.pedir(f'/api/v1/configuracion/procesos/{idc}/estado',{'estado':'cerrada','confirmar':True},esperado=409)
reserva(True)
op.pedir(f'/api/v1/configuracion/procesos/{idc}/estado',{'estado':'cerrada','confirmar':True},esperado=403)
admin.pedir(f'/api/v1/configuracion/procesos/{idc}/estado',{'estado':'cerrada'},esperado=422)
cerrada=admin.pedir(f'/api/v1/configuracion/procesos/{idc}/estado',{'estado':'cerrada','confirmar':True});assert cerrada['estado']=='cerrada'
assert anonimo.pedir('/api/v1/publico/procesos/'+idc)['estado']=='cerrada'
admin.pedir(f'/api/v1/configuracion/procesos/{idc}',simple,metodo='PUT',esperado=409)
admin.pedir(f'/api/v1/configuracion/procesos/{idc}/mesas',{'codigo':'TARDIA','unidad':'Sintética'},esperado=409)
admin.pedir(f'/api/v1/configuracion/candidatos/{next(iter(cc.values()))}/foto',{'foto':'data:image/png;base64,'+base64.b64encode(png).decode()},metodo='PUT',esperado=409)
ruta=f'/api/v1/configuracion/procesos/{idc}/importaciones/mesas'
admin.pedir(ruta+'/previsualizar',{'archivo':excel(['codigo','unidad'],[['TARDIA','Sintética']])},esperado=409)
op.pedir('/api/v1/actas',acta(mid,cc,3,7,1),esperado=409)
op.pedir('/api/v1/actas/mesas/'+mid,acta(mid,cc,3,7,1),metodo='PUT',esperado=409)
op.pedir('/api/v1/actas/mesas/'+mid,{'idSolicitud':str(uuid4()),'versionAnterior':1,'motivo':'Prueba sintética'},metodo='DELETE',esperado=409)
# Destacar una cerrada nunca la reabre.
assert admin.pedir(f'/api/v1/configuracion/procesos/{idc}/actual',{'confirmar':True})['estado']=='cerrada'
admin.pedir(f'/api/v1/configuracion/procesos/{idc}',metodo='DELETE',esperado=409)
assert op.pedir('/api/v1/actas/mesa/'+mid)['versionAnterior']==1
assert anonimo.pedir('/api/v1/publico/resultados/'+idc)['total']==10
archivada=admin.pedir(f'/api/v1/configuracion/procesos/{idc}/estado',{'estado':'archivada','confirmar':True});assert archivada['estado']=='archivada'
admin.pedir(f'/api/v1/configuracion/procesos/{idc}/actual',{'confirmar':True},esperado=409)
admin.pedir(f'/api/v1/configuracion/procesos/{idc}/estado',{'estado':'cerrada','confirmar':True},esperado=409)
anonimo.pedir('/api/v1/publico/procesos/'+idc,esperado=404)
assert op.pedir('/api/v1/actas/mesa/'+mid)['versionAnterior']==1
h=admin.pedir(f'/api/v1/configuracion/procesos/{idc}/historial')['elementos'];assert [v['nuevo'] for v in h]==['recepcion','cerrada','archivada']
# Mantener una elección sintética publicada para la prueba visual.
admin.pedir(f'/api/v1/configuracion/procesos/{idp}/actual',{'confirmar':True})
ok('Estados reales: edición y eliminación lógica de borrador, cierre serializado con gRPC, 409 en escrituras tardías, historial y actas conservadas al archivar')
# Repetir demostración sin borrar el intento anterior y sin compartir IDs de mesas/candidatos.
admin.pedir(f'/api/v1/configuracion/procesos/{id2}/reiniciar',{'confirmar':True},esperado=409)
admin.pedir(f'/api/v1/configuracion/procesos/{id2}/estado',{'estado':'cerrada','confirmar':True})
op.pedir(f'/api/v1/configuracion/procesos/{id2}/reiniciar',{'confirmar':True},esperado=403)
def reiniciar(_):
 try:return admin.pedir(f'/api/v1/configuracion/procesos/{id2}/reiniciar',{'confirmar':True},esperado=201)
 except AssertionError as e:
  if 'HTTP 409' in str(e):return None
  raise
with ThreadPoolExecutor(max_workers=2) as e:intentos=list(e.map(reiniciar,[1,2]))
nuevos=[p for p in intentos if p];assert len(nuevos)==1
nuevo=nuevos[0];assert nuevo['estado']=='borrador' and nuevo['id']!=id2
assert len(nuevo['mesas'])==len(p2['mesas']) and len(nuevo['candidatos'])==len(p2['candidatos'])
assert not {m['id'] for m in nuevo['mesas']}&{m['id'] for m in p2['mesas']}
assert not {c['id'] for c in nuevo['candidatos']}&{c['id'] for c in p2['candidatos']}
assert len(admin.pedir(f"/api/v1/configuracion/procesos/{nuevo['id']}/asignaciones")['elementos'])==2
assert admin.pedir(f'/api/v1/configuracion/procesos/{id2}')['estado']=='archivada'
assert op.pedir('/api/v1/actas/mesa/'+m2['DOC-02']['id'])['versionAnterior']==1
admin.pedir(f"/api/v1/configuracion/procesos/{nuevo['id']}",config2,metodo='PUT')
admin.pedir(f"/api/v1/configuracion/procesos/{nuevo['id']}/actual",{'confirmar':True})
r=anonimo.pedir('/api/v1/publico/resultados/'+nuevo['id']);assert r['total']==0 and r['contabilizadas']==0
cn={c['nombre']:c['id'] for c in nuevo['candidatos']};registrar_gql(acta(nuevo['mesas'][0]['id'],cn,1,2))
r=esperar_resultado(nuevo['id'],lambda r:r['contabilizadas']==1);assert r['total']==3
admin.pedir(f'/api/v1/configuracion/procesos/{idp}/actual',{'confirmar':True})
ok('Nuevo conteo: solo administrador, concurrencia sin copias dobles, configuración editable, asignaciones copiadas, resultado inicial cero y acta anterior conservada')
mesas_operador=op.pedir('/api/v1/mis-mesas')['elementos'];assert mesas_operador and all(m.get('cargo') for m in mesas_operador)
assert all(op.pedir('/api/v1/mesas/'+m['id']+'/contexto')['cargo']==m['cargo'] for m in mesas_operador)
ok('Operador: mesa y contexto identifican su cargo sin mezclar candidatos de cargos diferentes')
admin.pedir('/api/v1/autenticacion/logout',{},esperado=204);op.pedir('/api/v1/autenticacion/logout',{},esperado=204);ajeno.pedir('/api/v1/autenticacion/logout',{},esperado=204)
informe={'fecha':datetime.now(timezone(timedelta(hours=-4))).isoformat(),'entorno':proyecto,'tipo':'HTTP real, credenciales y datos sintéticos exclusivos','comprobaciones':comprobaciones,'estado':'OK','limitacion':'No representa certificación electoral ni prueba de carga'}
(raiz/'pruebas/ampliacion/resultados.json').write_text(json.dumps(informe,ensure_ascii=False,indent=2)+'\n')
print('OK: evidencia sin secretos guardada en pruebas/ampliacion/resultados.json',flush=True)
