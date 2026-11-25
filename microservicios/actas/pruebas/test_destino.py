"""Detección del destino (mesa y cargo) de una foto entre las mesas del operador; datos sintéticos."""
import base64
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).parents[1]))
from fastapi import HTTPException
from app.lectura import elegir_destino, leer_foto, lineas_ocr
from acta_sintetica import crear_acta
from test_lectura import tsv

ALFA = {'id': '20000000-0000-4000-8000-000000000001', 'nombre': 'Candidatura Alfa'}
BETA = {'id': '20000000-0000-4000-8000-000000000002', 'nombre': 'Candidatura Beta'}
GAMA = {'id': '20000000-0000-4000-8000-000000000003', 'nombre': 'Candidatura Gama'}
DELTA = {'id': '20000000-0000-4000-8000-000000000004', 'nombre': 'Candidatura Delta'}


def mesa(n, codigo, proceso, candidatos, sector='general', estado='recepcion'):
    return {'id': f'30000000-0000-4000-8000-00000000000{n}', 'codigo': codigo, 'nombreProceso': proceso, 'sector': sector,
            'estado': estado, 'unidad': 'Unidad de demostración', 'candidatos': candidatos}


RECTOR = mesa(1, 'PRUEBA-01', 'Rectorado de demostracion', [ALFA, BETA])
DECANO = mesa(2, 'PRUEBA-01', 'Decanatura de demostracion', [GAMA, DELTA])
OTRA = mesa(3, 'PRUEBA-02', 'Rectorado de demostracion', [ALFA, BETA])
DOCENTES = mesa(4, 'PRUEBA-05', 'Rectorado de demostracion', [ALFA, BETA], 'docentes')
ESTUDIANTES = mesa(5, 'PRUEBA-05', 'Rectorado de demostracion', [ALFA, BETA], 'estudiantes')


def filas(*lineas, conf=95):
    return lineas_ocr(tsv([(l, conf) for l in lineas]))


class ElegirDestino(unittest.TestCase):
    def test_mesa_fisica_compartida_se_distingue_por_candidaturas(self):
        r = elegir_destino(filas('Mesa: PRUEBA-01', 'Candidatura Gama: 40', 'Candidatura Delta: 30', 'Total votos: 75'), [RECTOR, DECANO, OTRA])
        self.assertEqual(r['mesa']['id'], DECANO['id'])

    def test_codigo_de_otra_mesa_excluye_aunque_coincidan_candidaturas(self):
        r = elegir_destino(filas('Mesa: PRUEBA-09', 'Candidatura Alfa: 10', 'Candidatura Beta: 5'), [RECTOR, OTRA])
        self.assertEqual(r, {'mesa': None, 'opciones': []})

    def test_sin_codigo_basta_con_candidaturas_unicas(self):
        r = elegir_destino(filas('Candidatura Gama: 40', 'Candidatura Delta: 30'), [RECTOR, DECANO])
        self.assertEqual(r['mesa']['id'], DECANO['id'])

    def test_empate_de_sectores_devuelve_opciones_y_el_sector_lo_resuelve(self):
        lineas = ['Mesa: PRUEBA-05', 'Candidatura Alfa: 10', 'Candidatura Beta: 5']
        empate = elegir_destino(filas(*lineas), [DOCENTES, ESTUDIANTES])
        self.assertIsNone(empate['mesa'])
        self.assertEqual(sorted(empate['opciones']), sorted([DOCENTES['id'], ESTUDIANTES['id']]))
        self.assertEqual(elegir_destino(filas(*lineas, 'Sector: Docentes'), [DOCENTES, ESTUDIANTES])['mesa']['id'], DOCENTES['id'])

    def test_el_cargo_impreso_desempata_mesas_del_mismo_codigo(self):
        sin_candidatos = [mesa(6, 'M-7', 'Rectorado de demostracion', [ALFA]), mesa(7, 'M-7', 'Decanatura de demostracion', [GAMA])]
        self.assertIsNone(elegir_destino(filas('Mesa: M-7'), sin_candidatos)['mesa'])
        self.assertEqual(elegir_destino(filas('Mesa: M-7', 'Cargo: Decanatura de demostración'), sin_candidatos)['mesa']['id'], sin_candidatos[1]['id'])

    def test_lecturas_de_baja_confianza_no_deciden(self):
        self.assertEqual(elegir_destino(filas('Mesa: PRUEBA-01', 'Candidatura Gama: 40', conf=40), [RECTOR, DECANO]), {'mesa': None, 'opciones': []})

    def test_codigo_con_texto_posterior_y_sin_prefijo_parcial(self):
        self.assertEqual(elegir_destino(filas('Mesa: PRUEBA-01 SECTOR DEL ACTA'), [RECTOR])['mesa']['id'], RECTOR['id'])
        self.assertIsNone(elegir_destino(filas('Mesa: 90'), [mesa(8, '9', 'Rectorado de demostracion', [ALFA])])['mesa'])


class LecturaConDeteccion(unittest.TestCase):
    def test_ocr_real_identifica_destino_y_propone_cifras(self):
        r = leer_foto(crear_acta(91, 143), mesas=[DECANO, RECTOR, OTRA])
        self.assertEqual((r['idMesa'], r['detectada']), (RECTOR['id'], True))
        self.assertEqual([v['cantidad'] for v in r['votos']], [91, 143])
        self.assertEqual(r['total'], 239)
        self.assertTrue(r['requiereRevision'])

    def test_ocr_real_sin_destino_no_propone_cifras(self):
        r = leer_foto(crear_acta(codigo='PRUEBA-09'), mesas=[RECTOR, DECANO])
        self.assertEqual((r['idMesa'], r['detectada'], r['votos'], r['total']), (None, False, [], None))
        self.assertTrue(r['advertencias'])

    def test_lectura_con_mesa_elegida_conserva_el_comportamiento(self):
        r = leer_foto(crear_acta(), RECTOR)
        self.assertEqual((r['idMesa'], r['detectada'], r['total']), (RECTOR['id'], False, 205))


class DeteccionHTTP(unittest.TestCase):
    def test_solo_participan_mesas_asignadas_y_abiertas(self):
        from fastapi.testclient import TestClient
        from app import servidor
        cliente = TestClient(servidor.app)  # Sin lifespan: ninguna base ni hilo externo.
        foto = 'data:image/png;base64,' + base64.b64encode(crear_acta()).decode()
        ajena = '30000000-0000-4000-8000-000000000099'
        cerrada = {**OTRA, 'estado': 'cerrada'}
        registro = {RECTOR['id']: RECTOR, OTRA['id']: cerrada}

        def consultar(_req, identificador, *args):
            if str(identificador) == ajena:
                raise HTTPException(403, 'Mesa no asignada')
            return registro[str(identificador)]
        with patch.object(servidor, 'conectar', side_effect=AssertionError('No debe usar persistencia')), patch.object(servidor, 'autorizar'), \
                patch.object(servidor, 'consultar_mesa', side_effect=consultar), patch.object(servidor, 'leer_foto', wraps=servidor.leer_foto) as motor:
            r = cliente.post('/api/v1/actas/lectura', json={'candidatas': [ajena, OTRA['id'], RECTOR['id'], RECTOR['id']], 'foto': foto})
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r.headers['cache-control'], 'no-store')
            self.assertEqual((r.json()['idMesa'], r.json()['detectada'], r.json()['total']), (RECTOR['id'], True, 205))
            self.assertEqual([m['id'] for m in motor.call_args.args[2]], [RECTOR['id']])
            self.assertEqual(cliente.post('/api/v1/actas/lectura', json={'candidatas': [ajena, OTRA['id']], 'foto': foto}).status_code, 409)
            self.assertEqual(cliente.post('/api/v1/actas/lectura', json={'candidatas': [RECTOR['id']], 'idMesa': RECTOR['id'], 'foto': foto}).status_code, 422)
            self.assertEqual(cliente.post('/api/v1/actas/lectura', json={'foto': foto}).status_code, 422)
            with patch.object(servidor, 'consultar_mesa', side_effect=HTTPException(503, 'Dependencia no disponible')):
                self.assertEqual(cliente.post('/api/v1/actas/lectura', json={'candidatas': [RECTOR['id']], 'foto': foto}).status_code, 503)


if __name__ == '__main__': unittest.main()
