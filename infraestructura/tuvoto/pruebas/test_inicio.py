"""Pruebas sin Docker ni escrituras en la configuración del proyecto."""
import contextlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

especificacion = importlib.util.spec_from_file_location('inicio', Path(__file__).resolve().parents[1] / 'iniciar-local.py')
inicio = importlib.util.module_from_spec(especificacion)
especificacion.loader.exec_module(inicio)


class InicioLocal(unittest.TestCase):
    def test_crea_claves_distintas_privadas_y_conserva_configuracion(self):
        with tempfile.TemporaryDirectory() as carpeta, contextlib.redirect_stdout(io.StringIO()):
            raiz = Path(carpeta)
            (raiz / '.env.example').write_text('TUVOTO_ORIGEN=http://127.0.0.1:8890\nTUVOTO_PUERTO=8890\nA=CAMBIAR_UNO\nB=CAMBIAR_DOS\n')
            archivo = inicio.preparar_entorno(raiz, False)
            original = archivo.read_bytes()
            valores = dict(linea.split('=', 1) for linea in original.decode().splitlines())
            self.assertEqual(archivo.stat().st_mode & 0o777, 0o600)
            self.assertEqual(len(valores['A']), 64)
            self.assertNotEqual(valores['A'], valores['B'])
            inicio.preparar_entorno(raiz, True)
            self.assertEqual(archivo.read_bytes(), original)
            self.assertEqual(inicio.leer_origen(archivo), 'http://127.0.0.1:8890')

    def test_no_regenera_claves_si_existen_datos(self):
        with tempfile.TemporaryDirectory() as carpeta:
            raiz = Path(carpeta)
            with self.assertRaisesRegex(RuntimeError, 'configuración original'):
                inicio.preparar_entorno(raiz, True)
            self.assertFalse((raiz / '.env.tuvoto').exists())

    def test_rechaza_enlaces_y_puertos_incoherentes(self):
        with tempfile.TemporaryDirectory() as carpeta:
            raiz = Path(carpeta)
            archivo = raiz / '.env.tuvoto'
            archivo.symlink_to(raiz / 'ausente')
            with self.assertRaisesRegex(RuntimeError, 'enlace'):
                inicio.preparar_entorno(raiz, False)
            archivo.unlink()
            for origen in ['http://127.0.0.1:8888', 'http://127.0.0.1:8891', 'http://127.0.0.1:invalido', 'http://ejemplo.test:8890', 'http://127.0.0.1:8890/ruta']:
                archivo.write_text(f'TUVOTO_ORIGEN={origen}\nTUVOTO_PUERTO=8890\n')
                with self.assertRaises(RuntimeError):
                    inicio.leer_origen(archivo)

    def test_api_no_confunde_error_o_contrato_ausente_con_catalogo_vacio(self):
        for respuesta in ['null', '[]', '{"data":null}', '{"data":{"eventos":[]}}', '{"data":{"eventos":[],"portal":null},"errors":[{"message":"fallo"}]}']:
            with patch.object(inicio, 'urlopen', return_value=io.StringIO(respuesta)):
                with self.assertRaisesRegex(RuntimeError, 'contrato de eventos'):
                    inicio.comprobar_api('http://127.0.0.1:8890')
        with patch.object(inicio, 'urlopen', return_value=io.StringIO('{"data":{"eventos":[],"portal":null}}')), contextlib.redirect_stdout(io.StringIO()) as salida:
            inicio.comprobar_api('http://127.0.0.1:8890')
            self.assertIn('0 evento(s)', salida.getvalue())


if __name__ == '__main__':
    unittest.main()
