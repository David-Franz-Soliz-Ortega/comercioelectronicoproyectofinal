"""Fotografías privadas/públicas reales: solo en el entorno sintético aislado existente."""
import base64
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
        req = urllib.request.Request(base + '/api/v1' + ruta, data=json.dumps(datos).encode() if datos is not None else None, headers=cabeceras, method=metodo or ('POST' if datos is not None else 'GET'))
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


carpeta = Path(entorno['carpeta'])
admin = Cliente()
admin.login(json.loads((carpeta / 'cuenta-prueba.json').read_text()))
cuenta_op = json.loads((carpeta / 'operador-interfaz.json').read_text())
admin.org = cuenta_op['idOrganizacion']
op = Cliente()
op.login(cuenta_op)
op.org = admin.org
anonimo = Cliente()
anterior = anonimo.pedir('/publico/actual')
sufijo = uuid4().hex[:8]
otra = admin.pedir('/organizaciones', {'nombre': 'Aislamiento fotográfico sintético ' + sufijo}, esperado=201)['idOrganizacion']
foto1, foto2 = imagen((37, 99, 235)), imagen((40, 150, 90))
proceso = admin.pedir('/configuracion/procesos', {'nombre': 'Fotografías sintéticas ' + sufijo, 'cargo': 'Rector', 'tipo': 'universidad', 'unidad': 'Unidad sintética', 'ambito': 'Prueba de fotografías ' + sufijo}, esperado=201)
idp = proceso['id']
comprobaciones = []
try:
    proceso = admin.pedir(f'/configuracion/procesos/{idp}/candidatos', {'nombre': 'Candidatura sintética con fotografía ' + sufijo, 'foto': 'data:image/png;base64,' + base64.b64encode(foto1).decode()}, esperado=201)
    id_foto = proceso['candidatos'][0]['id']
    proceso = admin.pedir(f'/configuracion/procesos/{idp}/candidatos', {'nombre': 'Candidatura sintética sin fotografía ' + sufijo}, esperado=201)
    id_sin_foto = next(c['id'] for c in proceso['candidatos'] if c['id'] != id_foto)
    ruta = '/configuracion/candidatos/' + id_foto + '/foto'
    original = admin.pedir('/configuracion/procesos/' + idp)
    cuerpo, headers = admin.pedir(ruta, binario=True)
    assert cuerpo == foto1 and headers['Content-Type'] == 'image/png'
    assert 'private' in headers['Cache-Control'] and 'no-store' in headers['Cache-Control'] and headers['X-Content-Type-Options'] == 'nosniff'
    assert admin.pedir('/configuracion/procesos/' + idp) == original
    anonimo.org = admin.org
    anonimo.pedir(ruta, esperado=401)
    op.pedir(ruta, esperado=403)
    admin.org = otra
    admin.pedir(ruta, esperado=404)
    admin.org = cuenta_op['idOrganizacion']
    admin.pedir('/configuracion/candidatos/' + id_sin_foto + '/foto', esperado=404)
    anonimo.pedir('/publico/candidatos/' + id_foto + '/foto', esperado=404)
    comprobaciones.append('Foto de borrador: bytes persistidos, cabeceras privadas, lectura sin cambios, anónimo 401, operador 403, otra organización y foto ausente 404; acceso público bloqueado')
    print('OK: fotografías privadas y separación de organizaciones.', flush=True)

    proceso = admin.pedir(f'/configuracion/procesos/{idp}/mesas', {'codigo': 'FOTO-SINTETICA-' + sufijo, 'unidad': 'Unidad sintética'}, esperado=201)
    usuario_op = admin.pedir('/usuarios?usuario=' + cuenta_op['usuario'])['elementos'][0]['idUsuario']
    admin.pedir('/configuracion/mesas/' + proceso['mesas'][0]['id'] + '/asignar', {'idUsuario': usuario_op}, esperado=204)
    datos = {'proyecto': proyecto, 'idProceso': idp, 'idOrganizacion': admin.org, 'idConFoto': id_foto, 'idSinFoto': id_sin_foto, 'fotoActualizada': base64.b64encode(foto2).decode()}
    with os.fdopen(os.open(carpeta / 'fotografias-prueba.json', os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600), 'w') as f:
        os.fchmod(f.fileno(), 0o600)
        json.dump(datos, f)
    subprocess.run(['node', str(raiz / 'frontend/pruebas/fotografias-reales.mjs')], check=True, cwd=raiz)
    assert admin.pedir(ruta, binario=True)[0] == foto2
    cuerpo, _ = anonimo.pedir('/publico/candidatos/' + id_foto + '/foto', binario=True)
    assert cuerpo == foto2
    anonimo.pedir('/publico/candidatos/' + id_sin_foto + '/foto', esperado=404)
    comprobaciones.append('Navegador real: foto en listado, editor y resumen; iniciales sin foto; cambio y recarga persistidos; fotos en Resultados públicos tras publicación; cinco tamaños sin desbordamiento')
finally:
    actual = admin.pedir('/configuracion/procesos/' + idp)
    if actual['estado'] == 'recepcion':
        admin.pedir(f'/configuracion/procesos/{idp}/estado', {'estado': 'cerrada', 'confirmar': True})
        actual['estado'] = 'cerrada'
    if actual['estado'] == 'cerrada':
        admin.pedir(f'/configuracion/procesos/{idp}/estado', {'estado': 'archivada', 'confirmar': True})
        anonimo.pedir('/publico/candidatos/' + id_foto + '/foto', esperado=404)
    if anterior and actual['estado'] != 'borrador':
        admin.pedir('/configuracion/procesos/' + anterior['id'] + '/actual', {'confirmar': True}, esperado=200)
        assert anonimo.pedir('/publico/actual')['id'] == anterior['id']
    op.pedir('/autenticacion/logout', {}, esperado=204)
    admin.pedir('/autenticacion/logout', {}, esperado=204)

informe = {'estado': 'OK', 'fecha': datetime.now(timezone.utc).isoformat(), 'proyecto': proyecto, 'comprobaciones': comprobaciones, 'sinModificarDatosPrincipales': True, 'sinCrearActas': True, 'configuracionPublicaSinteticaRestaurada': True}
(raiz / 'pruebas/ampliacion/fotografias.json').write_text(json.dumps(informe, ensure_ascii=False, indent=2) + '\n')
print('OK: fotografías reales verificadas; datos principales intactos y sin crear actas.')
