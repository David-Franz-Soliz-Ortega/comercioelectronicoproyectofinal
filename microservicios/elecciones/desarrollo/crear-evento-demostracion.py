#!/usr/bin/env python3
"""Publica un catálogo universitario de prueba mediante las API, sin crear actas ni votos."""

import argparse
import getpass
import http.cookiejar
import json
import stat
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPCookieProcessor, HTTPRedirectHandler, Request, build_opener


ORGANIZACION = 'Universidad de demostración · TUVOTO'
EVENTO = 'Elecciones universitarias · Demostración'
CANDIDATURAS = ['Frente Azul · Prueba', 'Frente Blanco · Prueba']
FACULTADES = ['Tecnología · Prueba', 'Salud · Prueba', 'Humanidades · Prueba', 'Economía · Prueba']
CARGOS = [
    ('Rectorado', 'Facultad', FACULTADES),
    ('Vicerrectorado', 'Facultad', FACULTADES),
    ('Decanato · Tecnología', 'Carrera', ['Ingeniería de Sistemas · Prueba', 'Ingeniería Civil · Prueba']),
    ('Dirección de carrera · Sistemas', 'Curso', ['Primer año · Prueba', 'Segundo año · Prueba', 'Tercer año · Prueba']),
]


class SinRedirecciones(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Cliente:
    def __init__(self, base):
        self.base = base
        self.csrf = ''
        self.organizacion = ''
        self.http = build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()), SinRedirecciones())

    def consultar(self, ruta, metodo='GET', datos=None):
        cabeceras = {'Accept': 'application/json', 'Origin': self.base}
        if self.csrf:
            cabeceras['X-CSRF-Token'] = self.csrf
        if self.organizacion:
            cabeceras['X-Organizacion'] = self.organizacion
        cuerpo = None
        if datos is not None:
            cabeceras['Content-Type'] = 'application/json'
            cuerpo = json.dumps(datos).encode()
        peticion = Request(self.base + '/api/v1' + ruta, data=cuerpo, headers=cabeceras, method=metodo)
        with self.http.open(peticion, timeout=20) as respuesta:
            contenido = respuesta.read()
            return json.loads(contenido) if contenido else None


def preparar(cliente):
    organizaciones = cliente.consultar('/organizaciones')['elementos']
    existentes = [o for o in organizaciones if o['nombre'] == ORGANIZACION]
    if len(existentes) > 1 or existentes and not existentes[0]['activa']:
        raise ValueError('Revisar la organización de demostración desde el panel antes de continuar.')
    organizacion = existentes[0] if existentes else cliente.consultar('/organizaciones', 'POST', {'nombre': ORGANIZACION})
    cliente.organizacion = organizacion['idOrganizacion']
    procesos = cliente.consultar('/configuracion/procesos')['elementos']
    creados = []
    for indice, (cargo, etiqueta, unidades) in enumerate(CARGOS, start=1):
        coincidencias = [p for p in procesos if p['nombre'] == EVENTO and p['cargo'] == cargo]
        if len(coincidencias) > 1:
            raise ValueError('Hay cargos de demostración duplicados; revisarlos desde el panel.')
        proceso = coincidencias[0] if coincidencias else cliente.consultar('/configuracion/procesos', 'POST', {
            'nombre': EVENTO, 'cargo': cargo, 'tipo': 'universidad', 'unidad': etiqueta,
        })
        ruta = '/configuracion/procesos/' + proceso['id']
        for nombre in CANDIDATURAS:
            if not any(c['nombre'] == nombre for c in proceso['candidatos']):
                proceso = cliente.consultar(ruta + '/candidatos', 'POST', {'nombre': nombre})
        for numero, unidad in enumerate(unidades, start=1):
            codigo = f'DEMO-{indice:02}-{numero:02}'
            if not any(m['codigo'] == codigo for m in proceso['mesas']):
                proceso = cliente.consultar(ruta + '/mesas', 'POST', {'codigo': codigo, 'unidad': unidad})
        if not proceso['publicado']:
            proceso = cliente.consultar(ruta + '/publicacion', 'PUT', {'publicado': True})
        creados.append(proceso)

    # Solo se destaca Rectorado si no hay otro proceso en recepción; se conserva el existente.
    actual = cliente.consultar('/publico/actual')
    if actual is None:
        cliente.consultar('/configuracion/procesos/' + creados[0]['id'] + '/actual', 'POST', {})
    print(json.dumps({'evento': EVENTO, 'cargos': [
        {'id': p['id'], 'cargo': p['cargo'], 'candidaturas': len(p['candidatos']), 'mesas': len(p['mesas'])}
        for p in creados
    ], 'nota': 'Catálogo de prueba publicado. No se crearon actas, votos ni asignaciones.'}, ensure_ascii=False, indent=2))


def main():
    argumentos = argparse.ArgumentParser(description=__doc__)
    argumentos.add_argument('--url', default='http://127.0.0.1:8890', help='Entrada HTTP del entorno local')
    argumentos.add_argument('--credenciales-locales', type=Path, help='JSON privado con usuario y contrasena; alternativa al ingreso interactivo')
    opciones = argumentos.parse_args()
    url = urlsplit(opciones.url)
    if url.scheme != 'http' or url.hostname not in ('127.0.0.1', 'localhost', '::1') or url.username or url.password or url.path not in ('', '/') or url.query or url.fragment:
        argumentos.error('Este catálogo de prueba se crea exclusivamente en un entorno HTTP local.')
    if opciones.credenciales_locales:
        if stat.S_IMODE(opciones.credenciales_locales.stat().st_mode) & 0o077:
            argumentos.error('El archivo de credenciales debe ser privado (permisos 600).')
        credenciales = json.loads(opciones.credenciales_locales.read_text())
        if not isinstance(credenciales, dict) or set(credenciales) != {'usuario', 'contrasena'}:
            argumentos.error('El JSON debe contener solamente usuario y contrasena.')
    else:
        credenciales = {'usuario': input('Administrador: ').strip(), 'contrasena': getpass.getpass('Contraseña: ')}
    cliente = Cliente(opciones.url.rstrip('/'))
    cliente.csrf = cliente.consultar('/autenticacion/csrf')['csrf']
    cliente.csrf = cliente.consultar('/autenticacion/login', 'POST', credenciales)['csrf']
    try:
        preparar(cliente)
    finally:
        cliente.consultar('/autenticacion/logout', 'POST', {})


if __name__ == '__main__':
    try:
        main()
    except HTTPError as error:
        raise SystemExit(f'La API respondió HTTP {error.code}. Revisar permisos y configuración; se pueden reanudar los cargos ya creados.') from None
    except (URLError, OSError, ValueError, KeyError) as error:
        raise SystemExit(f'No se pudo completar el catálogo local ({type(error).__name__}). Revisar la entrada y los servicios.') from None
