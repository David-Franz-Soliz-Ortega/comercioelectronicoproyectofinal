"""OCR real de imágenes sintéticas y fronteras HTTP sin red ni persistencia."""
import base64
import io
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).parents[1]))
from fastapi import HTTPException
from PIL import Image
from app.lectura import interpretar, leer_foto, TURNOS
from acta_sintetica import crear_acta

MESA = {'codigo': 'PRUEBA-01', 'estado': 'recepcion', 'candidatos': [
    {'id': '20000000-0000-4000-8000-000000000001', 'nombre': 'Candidatura Alfa'},
    {'id': '20000000-0000-4000-8000-000000000002', 'nombre': 'Candidatura Beta'}]}


def tsv(filas):
    encabezado = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n'
    return encabezado + '\n'.join(f'5\t1\t1\t1\t{i}\t1\t0\t0\t100\t10\t{conf}\t{fila}' for i, (fila, conf) in enumerate(filas, 1))


class LecturaReal(unittest.TestCase):
    def test_dos_imagenes_con_valores_distintos(self):
        for primera, segunda in [(120, 80), (91, 143)]:
            r = leer_foto(crear_acta(primera, segunda), MESA)
            self.assertEqual([v['cantidad'] for v in r['votos']], [primera, segunda])
            self.assertEqual([r['blancos'], r['nulos'], r['total']], [3, 2, primera + segunda + 5])
            self.assertTrue(r['completa'])
            self.assertTrue(r['sumaCoincide'])
            self.assertTrue(r['requiereRevision'])

    def test_jpeg_y_orientacion(self):
        imagen = Image.open(io.BytesIO(crear_acta()))
        # La foto está guardada girada; EXIF indica cómo verla correctamente.
        exif = Image.Exif(); exif[274] = 6
        imagen.transpose(Image.Transpose.ROTATE_90).save(foto := io.BytesIO(), format='JPEG', quality=90, exif=exif)
        self.assertEqual(leer_foto(foto.getvalue(), MESA)['total'], 205)

    def test_foto_blanca_no_inventa_ceros(self):
        salida = io.BytesIO(); Image.new('RGB', (800, 800), 'white').save(salida, format='PNG')
        r = leer_foto(salida.getvalue(), MESA)
        self.assertFalse(r['completa']); self.assertIsNone(r['total'])
        self.assertTrue(all(v['cantidad'] is None for v in r['votos']))

    def test_mesa_distinta_se_rechaza(self):
        with self.assertRaisesRegex(ValueError, 'mesa'):
            leer_foto(crear_acta(codigo='PRUEBA-02'), MESA)

    def test_archivo_corrupto(self):
        with self.assertRaises(ValueError): leer_foto(b'\x89PNG\r\n\x1a\ncorrupto', MESA)

    def test_repetidas_baja_confianza_y_nombre_incompleto(self):
        r = interpretar(tsv([('Candidatura Alfa: 120', 92), ('Candidatura Alfa: 120', 92), ('Candidatura Beta: 80', 50), ('Blancos: 3', 99), ('Nulos: 2', 95), ('Total: 205', 98)]), MESA['candidatos'], MESA['codigo'])
        self.assertEqual([v['cantidad'] for v in r['votos']], [None, None])
        self.assertFalse(r['completa']); self.assertIsNone(r['sumaCoincide'])
        self.assertIsNone(interpretar(tsv([('Alfa: 120', 95)]), MESA['candidatos'], MESA['codigo'])['votos'][0]['cantidad'])

    def test_suma_inconsistente_no_se_corrige(self):
        r = interpretar(tsv([(f'{k}: {n}', 99) for k, n in [('Candidatura Alfa',120),('Candidatura Beta',80),('Blancos',3),('Nulos',2),('Total',999)]]), MESA['candidatos'], MESA['codigo'])
        self.assertEqual(r['total'], 999); self.assertFalse(r['sumaCoincide'])

    def test_limite_paralelo_y_liberacion(self):
        TURNOS.acquire(); TURNOS.acquire()
        try:
            with self.assertRaises(HTTPException) as e: leer_foto(b'', MESA)
            self.assertEqual(e.exception.status_code, 429)
        finally: TURNOS.release(); TURNOS.release()
        with patch('app.lectura.subprocess.run', side_effect=FileNotFoundError):
            with self.assertRaises(HTTPException) as e: leer_foto(crear_acta(), MESA)
            self.assertEqual(e.exception.status_code, 503)
        self.assertTrue(TURNOS.acquire(blocking=False)); TURNOS.release()


class LecturaHTTP(unittest.TestCase):
    def test_permisos_asignacion_y_ausencia_de_escrituras(self):
        from fastapi.testclient import TestClient
        from app import servidor
        cliente = TestClient(servidor.app)  # Sin lifespan: ninguna base ni hilo externo.
        datos = {'idMesa': '10000000-0000-4000-8000-000000000001', 'foto': 'data:image/png;base64,' + base64.b64encode(crear_acta()).decode()}
        with patch.object(servidor, 'conectar', side_effect=AssertionError('No debe usar persistencia')), patch.object(servidor, 'autorizar') as permiso, patch.object(servidor, 'consultar_mesa', return_value=MESA) as mesa:
            for estado in (401, 403):
                permiso.side_effect = HTTPException(estado, 'No autorizado')
                with patch.object(servidor, 'leer_foto') as motor:
                    self.assertEqual(cliente.post('/api/v1/actas/lectura', json=datos).status_code, estado)
                    motor.assert_not_called(); mesa.assert_not_called()
            permiso.side_effect = None
            mesa.side_effect = HTTPException(403, 'Mesa no asignada')
            self.assertEqual(cliente.post('/api/v1/actas/lectura', json=datos).status_code, 403)
            mesa.side_effect = None
            mesa.return_value = {**MESA, 'estado': 'cerrada'}
            self.assertEqual(cliente.post('/api/v1/actas/lectura', json=datos).status_code, 409)
            mesa.return_value = MESA
            r = cliente.post('/api/v1/actas/lectura', json=datos)
            self.assertEqual(r.status_code, 200); self.assertEqual(r.headers['cache-control'], 'no-store')
            self.assertEqual(r.json()['total'], 205)
            self.assertTrue(permiso.call_args.args[1])
            self.assertNotIn('foto', r.json())
            self.assertEqual(cliente.post('/api/v1/actas/lectura', json={**datos, 'idUsuario': 'suplantado'}).status_code, 422)


if __name__ == '__main__': unittest.main()
