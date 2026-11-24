"""Formato de tabla sintético, OCR real; no utiliza el documento electoral de referencia."""
import io
import sys
import unittest
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).parents[1]))
from app.lectura import interpretar, combinar_lecturas, leer_foto
from test_lectura import MESA, tsv

FOTO = Path(__file__).parents[3] / 'frontend/public/ejemplos/acta-escrutinio-prueba.png'

class TablaImpresa(unittest.TestCase):
    def test_png_y_jpeg_del_formato_imprimible(self):
        original = FOTO.read_bytes()
        imagen = Image.open(io.BytesIO(original))
        jpeg = io.BytesIO(); imagen.save(jpeg, format='JPEG', quality=90)
        for foto in (original, jpeg.getvalue()):
            r = leer_foto(foto, MESA)
            self.assertEqual([v['cantidad'] for v in r['votos']], [120, 80])
            self.assertEqual((r['blancos'], r['nulos'], r['total']), (3, 2, 205))
            self.assertTrue(r['completa']); self.assertTrue(r['sumaCoincide'])
            self.assertTrue(r['requiereRevision'])
            self.assertEqual(r['advertencias'], [])
        self.assertEqual(FOTO.read_bytes(), original)

    def test_formato_de_tabla_no_acepta_otra_mesa(self):
        with self.assertRaisesRegex(ValueError, 'mesa'):
            leer_foto(FOTO.read_bytes(), {**MESA, 'codigo': 'OTRA-MESA'})

    def test_aliases_no_duplican_totales_ni_ocultan_ambiguedad(self):
        ambiguos = set()
        a = interpretar(tsv([('Blancos: 3',99),('Votos blancos: 3',99),('Votos nulos: 2',99),('Total votos: 205',99)]), MESA['candidatos'], MESA['codigo'], ambiguos)
        self.assertIsNone(a['blancos']); self.assertEqual(a['nulos'],2);self.assertEqual(a['total'],205)
        b = interpretar(tsv([('Votos blancos: 3',99)]), MESA['candidatos'], MESA['codigo'])
        self.assertIsNone(combinar_lecturas(a,b,MESA['candidatos'],ambiguos)['blancos'])

    def test_cifras_en_conflicto_quedan_vacias(self):
        a = interpretar(tsv([('Candidatura Alfa: 120',99)]), MESA['candidatos'], MESA['codigo'])
        b = interpretar(tsv([('Candidatura Alfa: 128',99),('Votos blancos: 3',99)]), MESA['candidatos'], MESA['codigo'])
        r = combinar_lecturas(a,b,MESA['candidatos'])
        self.assertIsNone(r['votos'][0]['cantidad']);self.assertFalse(r['completa']);self.assertIsNone(r['sumaCoincide'])
        self.assertEqual(r['blancos'],3)
        self.assertTrue(any('contraste' in a for a in r['advertencias']))

if __name__ == '__main__': unittest.main()
