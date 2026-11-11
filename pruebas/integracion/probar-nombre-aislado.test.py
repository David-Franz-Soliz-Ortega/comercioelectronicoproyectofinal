"""Regresión estática M.5.1: fixtures ficticias, nunca evidencia de Docker real.

Solo se ejercita el validador con archivos temporales privados. No se habilita
la suite (_aislamiento sigue en None), no se conectan servicios ni se toca Docker.
"""
from datetime import datetime, timedelta, timezone
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ARCHIVO = Path(__file__).with_name('probar-autenticacion.py')
ESPECIFICACION = importlib.util.spec_from_file_location('suite_autenticacion_estatica', ARCHIVO)
VALIDADOR = importlib.util.module_from_spec(ESPECIFICACION)
ESPECIFICACION.loader.exec_module(VALIDADOR)


class NombreAislado(unittest.TestCase):
    def setUp(self):
        temporal = tempfile.TemporaryDirectory(prefix='sigape-prueba-estatica-m51-')
        self.addCleanup(temporal.cleanup)
        self.carpeta = Path(temporal.name)
        self.copia = self.carpeta / 'candidato'
        self.principal = self.carpeta / 'principal'
        self.copia.mkdir()
        self.principal.mkdir()
        self.archivo_bind = self.copia / 'configuracion-ficticia.txt'
        self.archivo_bind.write_text('Solo fixture de comprobación estática.\n')
        self.archivo = self.carpeta / 'evidencia-ficticia.json'

    def evidencia(self, entorno='sigape-auth-test'):
        volumenes = {nombre: {'name': entorno + '_' + nombre, 'external': False}
                     for nombre in ('datos_postgres', 'datos_mongodb', 'datos_redis', 'datos_rabbitmq')}
        redes = {nombre: {'name': entorno + '_' + nombre, 'external': False}
                 for nombre in ('red_entrada', 'red_interna')}
        propietarios = {'base-postgres': 'datos_postgres', 'base-mongodb': 'datos_mongodb',
                        'cache-redis': 'datos_redis', 'mensajeria-rabbitmq': 'datos_rabbitmq'}
        nombres = ['entrada-nginx', 'identidad', 'elecciones', 'candidaturas', 'padron-electoral',
                   'votacion', 'resultados', 'gateway-graphql', 'frontend', 'resultados-conteo',
                   'resultados-auditoria', 'configurar-mensajeria', *propietarios]
        servicios = {nombre: {} for nombre in nombres}
        servicios['identidad']['environment'] = {'COOKIE_SEGURA': 'false'}
        servicios['entrada-nginx'] = {
            'ports': [{'host_ip': '127.0.0.1', 'published': '8888', 'target': 80, 'protocol': 'tcp'}],
            'volumes': [{'type': 'bind', 'source': str(self.archivo_bind), 'target': '/fixture'}],
        }
        for nombre, volumen in propietarios.items():
            servicios[nombre]['volumes'] = [{'type': 'volume', 'source': volumen, 'target': '/datos-ficticios'}]
        principal, candidato = [], []
        for indice, nombre in enumerate(nombres, 1):
            for proyecto, puerto, coleccion, desplazamiento in (
                ('sigape', '8080', principal, 0), (entorno, '8888', candidato, 100),
            ):
                montajes = []
                if nombre in propietarios:
                    montajes.append({'Type': 'volume', 'Name': proyecto + '_' + propietarios[nombre],
                                     'Destination': '/datos-ficticios'})
                if nombre == 'entrada-nginx':
                    montajes.append({'Type': 'bind',
                                     'Source': str(self.archivo_bind if proyecto == entorno else self.principal / 'configuracion.txt'),
                                     'Destination': '/fixture'})
                coleccion.append({
                    'Id': f'{indice + desplazamiento:064x}',
                    'Config': {'Labels': {'com.docker.compose.project': proyecto,
                                          'com.docker.compose.service': nombre}},
                    'State': {'Status': 'exited' if nombre == 'configurar-mensajeria' else 'running', 'ExitCode': 0},
                    'Mounts': montajes,
                    'NetworkSettings': {
                        'Networks': {proyecto + '_red_interna': {}},
                        'Ports': {'80/tcp': [{'HostIp': '127.0.0.1', 'HostPort': puerto}]} if nombre == 'entrada-nginx' else {},
                    },
                })
        return {'version': 1, 'idEntorno': entorno, 'urlBase': 'http://127.0.0.1:8888',
                'capturadoEn': datetime.now(timezone.utc).isoformat(),
                'directorioAislado': str(self.copia),
                'composicion': {'name': entorno, 'services': servicios, 'volumes': volumenes, 'networks': redes},
                'principal': principal, 'candidato': candidato}

    def validar(self, datos, *, entorno=None, destino=None, confirmacion=None):
        self.archivo.write_text(json.dumps(datos))
        self.archivo.chmod(0o600)
        entorno = datos['idEntorno'] if entorno is None else entorno
        return VALIDADOR.AislamientoAutorizado(
            str(self.archivo), entorno, destino or datos['urlBase'],
            'AUTORIZO-ESCRITURAS-EN:' + entorno if confirmacion is None else confirmacion,
        )

    def test_acepta_m5_solo_con_condiciones_completas(self):
        autorizado = self.validar(self.evidencia())
        self.assertEqual(autorizado.entorno, 'sigape-auth-test')
        autorizado.comprobar('http://127.0.0.1:8888', True)
        self.assertIsNone(VALIDADOR._aislamiento, 'La fixture no debe habilitar la suite HTTP.')

    def test_rechaza_principal_y_variantes_no_autorizadas(self):
        for entorno in ('sigape', 'sigape-auth-test-extra', 'SIGAPE-AUTH-TEST'):
            with self.subTest(entorno=entorno), self.assertRaisesRegex(
                    VALIDADOR.ConfiguracionInsegura, 'Identificador aislado inválido'):
                self.validar(self.evidencia(), entorno=entorno)

    def test_conserva_nombres_aleatorios_previamente_admitidos(self):
        entorno = 'sigape-auth-pruebas-a1b2c3d4'
        self.assertEqual(self.validar(self.evidencia(entorno)).entorno, entorno)

    def test_nombre_no_sustituye_evidencia_reciente_ni_confirmacion(self):
        casos = []
        sin_principal = self.evidencia()
        sin_principal['principal'] = []
        casos.append((sin_principal, {}, 'Faltan inspecciones'))
        caducada = self.evidencia()
        caducada['capturadoEn'] = (datetime.now(timezone.utc) - timedelta(minutes=11)).isoformat()
        casos.append((caducada, {}, 'caducó'))
        casos.append((self.evidencia(), {'confirmacion': ''}, 'confirmación explícita'))
        for datos, opciones, mensaje in casos:
            with self.subTest(motivo=mensaje), self.assertRaisesRegex(VALIDADOR.ConfiguracionInsegura, mensaje):
                self.validar(datos, **opciones)

    def test_rechaza_recursos_compartidos_y_externos(self):
        casos = []
        volumen = self.evidencia()
        principal_pg = next(c for c in volumen['principal']
                            if c['Config']['Labels']['com.docker.compose.service'] == 'base-postgres')
        principal_pg['Mounts'][0]['Name'] = 'sigape-auth-test_datos_postgres'
        casos.append((volumen, 'Volumen candidato compartido'))
        red = self.evidencia()
        red['principal'][0]['NetworkSettings']['Networks'] = {'sigape-auth-test_red_interna': {}}
        casos.append((red, 'Red compartida'))
        bind = self.evidencia()
        bind['principal'][0]['Mounts'][0]['Source'] = str(self.archivo_bind)
        casos.append((bind, 'compartido con el principal'))
        externo = self.evidencia()
        externo['composicion']['volumes']['datos_postgres']['external'] = True
        casos.append((externo, 'recursos externos'))
        for datos, mensaje in casos:
            with self.subTest(motivo=mensaje), self.assertRaisesRegex(VALIDADOR.ConfiguracionInsegura, mensaje):
                self.validar(datos)

    def test_rechaza_puertos_peligrosos_y_otro_destino(self):
        for destino in ('http://127.0.0.1:8080', 'http://localhost:8080', 'http://127.0.0.1:8889'):
            with self.subTest(destino=destino), self.assertRaises(VALIDADOR.ConfiguracionInsegura):
                self.validar(self.evidencia(), destino=destino)

    def test_rechaza_configuracion_ambigua(self):
        datos = self.evidencia()
        datos['candidato'][0]['NetworkSettings']['Ports']['80/tcp'].append(
            {'HostIp': '127.0.0.1', 'HostPort': '8888'})
        with self.assertRaisesRegex(VALIDADOR.ConfiguracionInsegura, 'publicación ambigua'):
            self.validar(datos)
        datos = self.evidencia()
        datos['composicion']['name'] = 'otro-proyecto'
        with self.assertRaisesRegex(VALIDADOR.ConfiguracionInsegura, 'composición resuelta'):
            self.validar(datos)


if __name__ == '__main__':
    unittest.main()
