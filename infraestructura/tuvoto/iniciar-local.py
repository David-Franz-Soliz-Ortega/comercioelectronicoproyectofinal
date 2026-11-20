"""Arranca únicamente TUVOTO y verifica el contrato público, sin crear datos electorales."""
import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

RAIZ = Path(__file__).resolve().parents[2]
COMPOSE = ['docker', 'compose', '--env-file', '.env.tuvoto', '-p', 'tuvoto']


def preparar_entorno(raiz, recursos_existentes):
    archivo = raiz / '.env.tuvoto'
    if archivo.is_symlink():
        raise RuntimeError('La configuración privada debe ser un archivo local, no un enlace.')
    if archivo.exists():
        return archivo
    if recursos_existentes:
        raise RuntimeError('Hay recursos previos de TUVOTO pero falta .env.tuvoto. Recupera su configuración original para conservar el acceso a los datos.')
    lineas = []
    for linea in (raiz / '.env.example').read_text().splitlines():
        if '=CAMBIAR_' in linea:
            linea = linea.split('=', 1)[0] + '=' + secrets.token_hex(32)
        lineas.append(linea)
    descriptor = os.open(archivo, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w') as salida:
        salida.write('\n'.join(lineas) + '\n')
    print('Configuración privada creada en .env.tuvoto, excluida de Git y Docker.')
    return archivo


def comprobar_api(origen):
    consulta = {'query': '{ eventos { id procesos { id } } portal { proceso { id } } }'}
    peticion = Request(origen + '/graphql', data=json.dumps(consulta).encode(), headers={'Content-Type': 'application/json'})
    try:
        with urlopen(peticion, timeout=20) as respuesta:
            datos = json.load(respuesta)
    except (HTTPError, URLError, TimeoutError, ValueError) as error:
        raise RuntimeError('La entrada HTTP o GraphQL no responde correctamente. Revisa el estado de los servicios de TUVOTO.') from error
    contenido = datos.get('data') if isinstance(datos, dict) else None
    eventos = contenido.get('eventos') if isinstance(contenido, dict) else None
    if not isinstance(datos, dict) or datos.get('errors') or not isinstance(eventos, list) or 'portal' not in contenido:
        raise RuntimeError('El contrato de eventos no está disponible. Reconstruye conjuntamente gateway, Elecciones, Actas y Resultados.')
    print(f'API verificada: {len(eventos)} evento(s) publicado(s).')
    if not eventos:
        print('El portal mostrará su estado vacío hasta que un administrador configure y publique un evento.')


def leer_origen(archivo):
    if archivo.is_symlink():
        raise RuntimeError('La configuración privada debe ser un archivo local, no un enlace.')
    # Solo se usan los valores públicos; las claves nunca se imprimen ni se pasan por argumentos.
    valores = dict(linea.split('=', 1) for linea in archivo.read_text().splitlines() if linea.startswith(('TUVOTO_ORIGEN=', 'TUVOTO_PUERTO=')))
    origen = valores.get('TUVOTO_ORIGEN', '').strip()
    try:
        url = urlparse(origen)
        valido = url.scheme == 'http' and url.hostname == '127.0.0.1' and url.port and not url.path and url.port not in (8080, 8888) and not url.username and not url.query and not url.fragment and str(url.port) == valores.get('TUVOTO_PUERTO', '').strip()
    except ValueError:
        valido = False
    if not valido:
        raise RuntimeError('Usa TUVOTO_ORIGEN=http://127.0.0.1:PUERTO y el mismo TUVOTO_PUERTO, distinto de 8080 y 8888.')
    return origen


def iniciar():
    argumentos = argparse.ArgumentParser(description=__doc__)
    argumentos.add_argument('--comprobar', action='store_true', help='Verificar la API existente, sin construir ni crear recursos.')
    opciones = argumentos.parse_args()
    archivo = RAIZ / '.env.tuvoto'
    if not opciones.comprobar:
        disponible = subprocess.run(['docker', 'info', '--format', '{{.ServerVersion}}'], capture_output=True, text=True)
        if disponible.returncode:
            raise RuntimeError('Docker no está iniciado. Inícialo y vuelve a ejecutar este comando.')
        volumenes = subprocess.run(['docker', 'volume', 'ls', '--filter', 'label=com.docker.compose.project=tuvoto', '--format', '{{.Name}}'], capture_output=True, text=True, check=True).stdout.strip()
        contenedores = subprocess.run(['docker', 'ps', '-a', '--filter', 'label=com.docker.compose.project=tuvoto', '--format', '{{.Names}}'], capture_output=True, text=True, check=True).stdout.strip()
        archivo = preparar_entorno(RAIZ, bool(volumenes or contenedores))
    if not archivo.exists():
        raise RuntimeError('Falta .env.tuvoto. Ejecuta primero el arranque sin --comprobar.')
    origen = leer_origen(archivo)
    if not opciones.comprobar:
        subprocess.run(COMPOSE + ['config', '--quiet'], cwd=RAIZ, check=True)
        subprocess.run(COMPOSE + ['up', '-d', '--build', '--wait', '--wait-timeout', '240'], cwd=RAIZ, check=True)
    comprobar_api(origen)
    print(f'TUVOTO disponible en {origen}')


if __name__ == '__main__':
    try:
        iniciar()
    except (RuntimeError, OSError, subprocess.CalledProcessError) as error:
        print(f'No se pudo completar el inicio: {error}', file=sys.stderr)
        sys.exit(1)
