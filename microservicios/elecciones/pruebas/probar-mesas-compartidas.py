"""Mesas físicas, retirada de borradores y conteos separados, solo con datos sintéticos."""
import base64
from concurrent.futures import ThreadPoolExecutor
import time
import io
import zipfile
from xml.sax.saxutils import escape
from datetime import datetime, timezone
import http.cookiejar
import json
import os
from pathlib import Path
import struct
import subprocess
import urllib.error
import urllib.request
from uuid import uuid4
import zlib

raiz = Path(__file__).resolve().parents[3]
entorno = json.loads(Path('/tmp/tuvoto-ampliacion-entorno.json').read_text())
proyecto, base = entorno['proyecto'], entorno['url']
assert proyecto.startswith('tuvoto-prueba-sectores-') and base == 'http://127.0.0.1:18891'
ids = subprocess.check_output(['docker', 'ps', '-q', '--filter', 'label=com.docker.compose.project=' + proyecto], text=True).split()
contenedores = json.loads(subprocess.check_output(['docker', 'inspect', *ids], text=True))
assert len(contenedores) == 13
for c in contenedores:
    assert c['State']['Health']['Status'] == 'healthy'
    assert all(n.startswith(proyecto + '_') for n in c['NetworkSettings']['Networks'])
    for montaje in c['Mounts']:
        if montaje['Type'] == 'volume':
            volumen = json.loads(subprocess.check_output(['docker', 'volume', 'inspect', montaje['Name']], text=True))[0]
            assert volumen['Driver'] == 'local' and not volumen.get('Options')
            if not montaje['Name'].startswith(proyecto + '_'):
                # Redis declara /data como volumen anónimo: comprobar su origen y referencias reales.
                assert 'com.docker.volume.anonymous' in (volumen.get('Labels') or {})
                assert montaje['Destination'] in c['Config'].get('Volumes', {})
            referencias = subprocess.check_output(['docker', 'ps', '-aq', '--no-trunc', '--filter', 'volume=' + montaje['Name']], text=True).split()
            assert set(referencias) <= {v['Id'] for v in contenedores}
        else:
            assert montaje['Type'] == 'bind' and not montaje['RW']


class Cliente:
    def __init__(self):
        self.cookies = http.cookiejar.CookieJar()
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
        self.org = None

    def pedir(self, ruta, datos=None, metodo=None, esperado=200, binario=False):
        cabeceras = {'Origin': base}
        if self.org:
            cabeceras['X-Organizacion'] = self.org
        for cookie in self.cookies:
            if cookie.name == 'tuvoto-csrf':
                cabeceras['X-CSRF-Token'] = cookie.value
        if datos is not None:
            cabeceras['Content-Type'] = 'application/json'
        req = urllib.request.Request(base + (ruta if ruta.startswith('/graphql') else '/api/v1' + ruta), data=json.dumps(datos).encode() if datos is not None else None, headers=cabeceras, method=metodo or ('POST' if datos is not None else 'GET'))
        try:
            with self.http.open(req, timeout=30) as respuesta:
                estado, cuerpo, headers = respuesta.status, respuesta.read(), respuesta.headers
        except urllib.error.HTTPError as respuesta:
            estado, cuerpo, headers = respuesta.code, respuesta.read(), respuesta.headers
        assert estado == esperado, f'HTTP {estado}, esperado {esperado}; contenido sensible omitido'
        return (cuerpo, headers) if binario else json.loads(cuerpo) if cuerpo else None

    def login(self, cuenta):
        self.pedir('/autenticacion/csrf')
        self.pedir('/autenticacion/login', {'usuario': cuenta['usuario'], 'contrasena': cuenta['contrasena']})


def imagen(color):
    def bloque(nombre, datos):
        return struct.pack('!I', len(datos)) + nombre + datos + struct.pack('!I', zlib.crc32(nombre + datos) & 0xffffffff)
    pixeles = b''.join(b'\0' + bytes(color) * 64 for _ in range(64))
    return b'\x89PNG\r\n\x1a\n' + bloque(b'IHDR', struct.pack('!2I5B', 64, 64, 8, 2, 0, 0, 0)) + bloque(b'IDAT', zlib.compress(pixeles)) + bloque(b'IEND', b'')



def excel(columnas, filas):
    def celda(valor, j):
        return '<c r="'+chr(65+j)+'{fila}" t="inlineStr"><is><t xml:space="preserve">'+escape(str(valor))+'</t></is></c>'
    rows=''.join('<row r="'+str(i+1)+'">'+''.join(celda(v,j).replace('{fila}',str(i+1)) for j,v in enumerate(f))+'</row>' for i,f in enumerate([columnas,*filas]))
    archivos={'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>', '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>', 'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Datos" sheetId="1" r:id="rId1"/></sheets></workbook>', 'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>', 'xl/worksheets/sheet1.xml':'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+rows+'</sheetData></worksheet>'}
    b=io.BytesIO()
    with zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED) as z:
        for k,v in archivos.items():z.writestr(k,v)
    return base64.b64encode(b.getvalue()).decode()

carpeta=Path(entorno['carpeta'])
cred=json.loads((carpeta/'cuenta-prueba.json').read_text());cuenta_op=json.loads((carpeta/'operador-interfaz.json').read_text())
admin=Cliente();admin.login(cred);admin.org=cuenta_op['idOrganizacion']
op=Cliente();op.login(cuenta_op);op.org=admin.org
anonimo=Cliente();anterior=anonimo.pedir('/publico/actual')
sufijo=uuid4().hex[:8];facultad='Facultad sintética '+sufijo;unidad=facultad+' · Grupo A';ambito='Universidad sintética '+sufijo
sectores=[{'codigo':'docentes','nombre':'Docentes','pesoBps':0},{'codigo':'estudiantes','nombre':'Estudiantes','pesoBps':0}]
config={'nombre':'Mesa compartida sintética '+sufijo,'cargo':'Rector','tipo':'universidad','unidad':'Carrera','ambito':ambito,'sectores':sectores}
ps=[];comprobaciones=[]
def sql(texto):
    return subprocess.check_output(['docker','exec',proyecto+'-base-postgres-1','psql','-U','tuvoto_admin','-d','elecciones_db','-Atqc',texto],text=True).strip()
def ok(texto):
    comprobaciones.append(texto);print('OK: '+texto,flush=True)
try:
    for cargo in ['Rector','Vicerrector','Director']:
        d={**config,'cargo':cargo}
        if cargo=='Director':d.update(facultad=facultad,grupoCarreras='Grupo A',carreras=['Sistemas sintéticos '+sufijo,'Diseño sintético '+sufijo],ambito=unidad)
        p=admin.pedir('/configuracion/procesos',d,esperado=201)
        for letra in ['A','B']:p=admin.pedir('/configuracion/procesos/'+p['id']+'/candidatos',{'nombre':'Candidatura sintética '+letra+' '+sufijo},esperado=201)
        ps.append(p)
    idp=ps[0]['id'];foto=imagen((37,99,235))
    p=admin.pedir('/configuracion/procesos/'+idp+'/candidatos',{'nombre':'Candidato para retirar '+sufijo,'foto':'data:image/png;base64,'+base64.b64encode(foto).decode()},esperado=201)
    eliminar=next(c for c in p['candidatos'] if c['nombre'].startswith('Candidato para retirar'))['id'];ruta='/configuracion/candidatos/'+eliminar
    anonimo.pedir(ruta,{'confirmar':True},metodo='DELETE',esperado=401);op.pedir(ruta,{'confirmar':True},metodo='DELETE',esperado=403)
    admin.pedir(ruta,{},metodo='DELETE',esperado=422)
    admin.pedir(ruta,{'confirmar':True},metodo='DELETE',esperado=204)
    assert len(admin.pedir('/configuracion/procesos/'+idp)['candidatos'])==2
    assert sql("SELECT count(*) FROM tuvoto_candidatos WHERE id='"+eliminar+"' AND eliminada AND foto IS NOT NULL")=='1'
    admin.pedir(ruta+'/foto',esperado=404)
    p=admin.pedir('/configuracion/procesos/'+idp+'/candidatos',{'nombre':'Candidato para retirar '+sufijo},esperado=201)
    assert any(c['id']==eliminar and c['tieneFoto'] for c in p['candidatos'])
    admin.pedir(ruta,{'confirmar':True},metodo='DELETE',esperado=204)
    usuario_op=admin.pedir('/usuarios?usuario='+cuenta_op['usuario'])['elementos'][0]['idUsuario']
    p=admin.pedir('/configuracion/procesos/'+idp+'/mesas',{'codigo':'RETIRAR-'+sufijo,'unidad':unidad,'sector':'estudiantes'},esperado=201)
    mid=next(m['id'] for m in p['mesas'] if m['codigo']=='RETIRAR-'+sufijo)
    admin.pedir('/configuracion/mesas/'+mid+'/asignar',{'idUsuario':usuario_op},esperado=204)
    admin.pedir('/configuracion/mesas/'+mid,{'confirmar':True},metodo='DELETE',esperado=204)
    assert not admin.pedir('/configuracion/procesos/'+idp)['mesas']
    assert not admin.pedir('/configuracion/procesos/'+idp+'/asignaciones')['elementos']
    assert sql("SELECT count(*) FROM tuvoto_asignaciones WHERE id_mesa='"+mid+"'")=='1'
    op.pedir('/mesas/'+mid+'/contexto',esperado=403)
    ajena=admin.pedir('/organizaciones',{'nombre':'Organización de aislamiento sintética '+sufijo},esperado=201)['idOrganizacion']
    admin.org=ajena;admin.pedir('/configuracion/candidatos/'+ps[0]['candidatos'][0]['id'],{'confirmar':True},metodo='DELETE',esperado=404);admin.org=op.org
    ok('Retirada con confirmación, 401/403/404 y conservación física de candidato, foto, mesa y asignaciones')

    carrera=admin.pedir('/configuracion/procesos',{**config,'cargo':'Cargo de concurrencia '+sufijo},esperado=201)
    origen=admin.pedir('/configuracion/procesos/'+carrera['id']+'/candidatos',{'nombre':'Origen sintético concurrente'},esperado=201)['candidatos'][0]['id']
    vuelta=admin.pedir('/configuracion/procesos',{**config,'cargo':'Cargo de concurrencia '+sufijo,'vuelta':2,'idPrimeraVuelta':carrera['id']},esperado=201)
    def disputar(modo):
        c=Cliente();c.login(cred);c.org=admin.org
        try:
            try:
                if modo=='retirar':c.pedir('/configuracion/candidatos/'+origen,{'confirmar':True},metodo='DELETE',esperado=204);return 204
                c.pedir('/configuracion/procesos/'+vuelta['id']+'/candidatos',{'idCandidatoOrigen':origen},esperado=201);return 201
            except AssertionError as e:
                if 'HTTP 409,' in str(e):return 409
                if 'HTTP 422,' in str(e):return 422
                raise
        finally:c.pedir('/autenticacion/logout',{},esperado=204)
    with ThreadPoolExecutor(max_workers=2) as ejecutor:estados=list(ejecutor.map(disputar,['retirar','referenciar']))
    assert estados in [[204,422],[409,201]],str(estados)
    admin.pedir('/configuracion/procesos/'+vuelta['id'],metodo='DELETE',esperado=204)
    admin.pedir('/configuracion/procesos/'+carrera['id'],metodo='DELETE',esperado=204)
    ok('Concurrencia: retirar un candidato nunca deja una segunda vuelta referenciando un candidato retirado')

    # Referencias a otra vuelta impiden retirar un candidato todavía utilizado.
    segunda=admin.pedir('/configuracion/procesos',{**config,'vuelta':2,'idPrimeraVuelta':idp},esperado=201)
    admin.pedir('/configuracion/procesos/'+segunda['id']+'/candidatos',{'idCandidatoOrigen':ps[0]['candidatos'][0]['id']},esperado=201)
    admin.pedir('/configuracion/candidatos/'+ps[0]['candidatos'][0]['id'],{'confirmar':True},metodo='DELETE',esperado=409)
    admin.pedir('/configuracion/procesos/'+segunda['id'],metodo='DELETE',esperado=204)
    duplicado=admin.pedir('/configuracion/procesos',config,esperado=201)
    admin.pedir('/configuracion/mesas-compartidas',{'codigo':'DUP-'+sufijo,'unidad':unidad,'sector':'estudiantes','idProcesos':[idp,duplicado['id']]},esperado=422)
    admin.pedir('/configuracion/procesos/'+duplicado['id'],metodo='DELETE',esperado=204)
    columnas=['codigo','unidad','sector','recinto','apellidoDesde','apellidoHasta','cargo','ambito','vuelta','usuario']
    filas=[]
    for sector in ['estudiantes','docentes']:
        for p in ps:filas.append(['FIS-'+sector+'-'+sufijo,unidad,sector,'Recinto sintético','A','L',p['cargo'],p['ambito'],'1',cuenta_op['usuario']])
    ruta='/configuracion/mesas-compartidas/importacion'
    assert admin.pedir(ruta+'/plantilla',binario=True)[0].startswith(b'PK')
    invalido=excel(columnas,[*filas,filas[0]])
    v=admin.pedir(ruta+'/previsualizar',{'archivo':invalido});assert v['errores']
    admin.pedir(ruta+'/confirmar',{'archivo':invalido,'huella':v['huella'],'confirmar':True},esperado=409)
    assert all(not admin.pedir('/configuracion/procesos/'+p['id'])['mesas'] for p in ps)
    errado=[list(r) for r in filas];errado[2][1]=facultad+' · Grupo B'
    assert admin.pedir(ruta+'/previsualizar',{'archivo':excel(columnas,errado)})['errores']
    archivo=excel(columnas,filas);v=admin.pedir(ruta+'/previsualizar',{'archivo':archivo});assert not v['errores'],str(v['errores'])
    op.pedir(ruta+'/confirmar',{'archivo':archivo,'huella':v['huella'],'confirmar':True},esperado=403)
    r=admin.pedir(ruta+'/confirmar',{'archivo':archivo,'huella':v['huella'],'confirmar':True},esperado=201)
    assert r['mesasFisicas']==2 and r['actasEsperadas']==6
    admin.pedir(ruta+'/confirmar',{'archivo':archivo,'huella':v['huella'],'confirmar':True},esperado=409)
    v=admin.pedir(ruta+'/previsualizar',{'archivo':archivo});assert not v['errores']
    admin.pedir(ruta+'/confirmar',{'archivo':archivo,'huella':v['huella'],'confirmar':True},esperado=201)
    actuales=[admin.pedir('/configuracion/procesos/'+p['id']) for p in ps]
    assert all(len(p['mesas'])==2 for p in actuales)
    assert len({m['idMesaFisica'] for p in actuales for m in p['mesas']})==2
    assert len({m['id'] for p in actuales for m in p['mesas']})==6
    assert all(len(admin.pedir('/configuracion/procesos/'+p['id']+'/asignaciones')['elementos'])==2 for p in ps)
    ok('Excel real: dos mesas físicas, seis actas/asignaciones; sectores y grupos separados; error cancela lote y reintentos no duplican')
    # Dos solicitudes simultáneas no duplican la mesa física ni sus vínculos.
    d={'codigo':'CONC-'+sufijo,'unidad':unidad,'sector':'estudiantes','idProcesos':[p['id'] for p in ps]}
    def concurrente(_):
        c=Cliente();c.login(cred);c.org=admin.org
        try:return c.pedir('/configuracion/mesas-compartidas',d,esperado=201)
        finally:c.pedir('/autenticacion/logout',{},esperado=204)
    with ThreadPoolExecutor(max_workers=2) as ejecutor:list(ejecutor.map(concurrente,range(2)))
    grupos=[g for g in admin.pedir('/configuracion/mesas-compartidas')['elementos'] if g['codigo']==d['codigo']]
    assert len(grupos)==1 and len(grupos[0]['cargos'])==3
    for m in grupos[0]['cargos']:admin.pedir('/configuracion/mesas/'+m['idMesa'],{'confirmar':True},metodo='DELETE',esperado=204)
    ok('Concurrencia: una sola mesa física y un vínculo por cargo')
    # Recursos propios para verificar botones de eliminación desde React.
    p=admin.pedir('/configuracion/procesos/'+idp+'/candidatos',{'nombre':'Retirar desde interfaz '+sufijo},esperado=201)
    candidato_ui=next(c['id'] for c in p['candidatos'] if c['nombre'].startswith('Retirar desde interfaz'))
    p=admin.pedir('/configuracion/procesos/'+idp+'/mesas',{'codigo':'UI-RETIRAR-'+sufijo,'unidad':unidad,'sector':'estudiantes'},esperado=201)
    mesa_ui=next(m['id'] for m in p['mesas'] if m['codigo']=='UI-RETIRAR-'+sufijo)
    cargo_ui=admin.pedir('/configuracion/procesos',{**config,'cargo':'Cargo sintético para retirar '+sufijo},esperado=201)['id']
    datos={'proyecto':proyecto,'organizacion':admin.org,'idsProcesos':[p['id'] for p in ps],'candidatoEliminar':candidato_ui,'mesaEliminar':mesa_ui,'cargoEliminar':cargo_ui,'codigoUi':'UI-COMPARTIDA-'+sufijo,'unidad':unidad,'usuario':cuenta_op['usuario'],'archivo':archivo}
    with os.fdopen(os.open(carpeta/'mesas-compartidas-prueba.json',os.O_WRONLY|os.O_CREAT|os.O_TRUNC|os.O_NOFOLLOW,0o600),'w') as f:
        os.fchmod(f.fileno(),0o600);json.dump(datos,f)
    subprocess.run(['node',str(raiz/'frontend/pruebas/mesas-compartidas-reales.mjs')],check=True,cwd=raiz)
    ok('React: eliminar candidato/mesa/cargo con confirmación; crear/importar mesa compartida; operador consulta sus cargos agrupados')
    for i,p in enumerate(ps):
        actual=admin.pedir('/configuracion/procesos/'+p['id']);m=next(m for m in actual['mesas'] if m['codigo']=='FIS-estudiantes-'+sufijo)
        votos=[{'idCandidato':c['id'],'cantidad':(11,7,5)[i] if j==0 else 0} for j,c in enumerate(actual['candidatos'])]
        acta={'idMesa':m['id'],'idSolicitud':str(uuid4()),'versionAnterior':0,'votos':votos,'blancos':1,'nulos':0,'total':(11,7,5)[i]+1,'confirmado':True,'foto':'data:image/png;base64,'+base64.b64encode(imagen((37+i,99,235))+uuid4().bytes).decode()}
        admin.pedir('/actas',acta,esperado=403)
        registrado=op.pedir('/actas',acta,esperado=201);assert op.pedir('/actas',acta,esperado=201)['id']==registrado['id']
        for _ in range(40):
            resultado=anonimo.pedir('/publico/resultados/'+p['id'])
            if resultado['contabilizadas']==1:break
            time.sleep(.5)
        else:raise AssertionError('La proyección no recibió el acta sintética')
        assert resultado['total']==(12,8,6)[i] and resultado['esperadas']==len(actual['mesas'])
        assert resultado['sectores'][0]['codigo'] in ['docentes','estudiantes']
        admin.pedir('/configuracion/candidatos/'+actual['candidatos'][0]['id'],{'confirmar':True},metodo='DELETE',esperado=409)
        admin.pedir('/configuracion/mesas/'+m['id'],{'confirmar':True},metodo='DELETE',esperado=409)
        admin.pedir('/configuracion/procesos/'+p['id'],metodo='DELETE',esperado=409)
    ok('Misma mesa: tres actas reales por REST/gRPC/RabbitMQ/MongoDB; totales separados 12/8/6, reintento idempotente y eliminación bloqueada tras iniciar')
finally:
    for p in ps:
        actual=admin.pedir('/configuracion/procesos/'+p['id'])
        if actual['estado']=='recepcion':admin.pedir('/configuracion/procesos/'+p['id']+'/estado',{'estado':'cerrada','confirmar':True});actual['estado']='cerrada'
        if actual['estado']=='cerrada':admin.pedir('/configuracion/procesos/'+p['id']+'/estado',{'estado':'archivada','confirmar':True})
    if anterior:admin.pedir('/configuracion/procesos/'+anterior['id']+'/actual',{'confirmar':True})
    admin.pedir('/autenticacion/logout',{},esperado=204);op.pedir('/autenticacion/logout',{},esperado=204)
informe={'estado':'OK','fecha':datetime.now(timezone.utc).isoformat(),'entorno':proyecto,'comprobaciones':comprobaciones,'datosPrincipalesSinCambios':True,'soloActasSinteticas':True}
(raiz/'pruebas/ampliacion/mesas-compartidas.json').write_text(json.dumps(informe,ensure_ascii=False,indent=2)+'\n')
print('OK: evidencia de mesas compartidas y eliminación segura guardada.')
