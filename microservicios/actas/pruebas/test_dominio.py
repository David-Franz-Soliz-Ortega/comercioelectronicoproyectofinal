import base64
import importlib.util
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('dominio', Path(__file__).parents[1]/'app/dominio.py')
d = importlib.util.module_from_spec(spec); spec.loader.exec_module(d)

class Dominio(unittest.TestCase):
    def test_sumas_y_candidatos(self):
        votos = [{'idCandidato':'a','cantidad':12},{'idCandidato':'b','cantidad':8}]
        self.assertEqual(d.validar_conteo(votos,[{'id':'a'},{'id':'b'}],1,2,23),'publicada')
        self.assertEqual(d.validar_conteo(votos,[{'id':'a'},{'id':'b'}],1,2,24),'observada')
        for invalidos in [votos[:1], votos+[votos[0]], [{'idCandidato':'a','cantidad':-1}]]:
            with self.assertRaises(ValueError): d.validar_conteo(invalidos,[{'id':'a'},{'id':'b'}],0,0,0)
    def test_original_y_tipo(self):
        foto=b'\xff\xd8\xff' + b'original-sintetico'
        original,mime,huella=d.decodificar_foto('data:image/jpeg;base64,'+base64.b64encode(foto).decode())
        self.assertEqual(original,foto);self.assertEqual(mime,'image/jpeg');self.assertEqual(len(huella),64)
        with self.assertRaises(ValueError):d.decodificar_foto('data:text/html;base64,PHNjcmlwdD4=')
    def test_huella_independiente_del_orden(self):
        a={'idMesa':'m','votos':[{'idCandidato':'b','cantidad':1},{'idCandidato':'a','cantidad':2}],'blancos':0,'nulos':0,'total':3,'versionAnterior':0,'confirmado':True}
        b={**a,'votos':list(reversed(a['votos']))}
        self.assertEqual(d.huella_solicitud(a,'foto'),d.huella_solicitud(b,'foto'))
        self.assertNotEqual(d.huella_solicitud(a,'foto'),d.huella_solicitud({**b,'total':4},'foto'))
    def test_evento_sin_operador_o_foto(self):
        e=d.construir_evento('evento',{'idProceso':'p','id':'m','unidad':'Unidad'},1,None,True,'org')
        self.assertNotIn('idUsuario',str(e));self.assertNotIn('foto',str(e));self.assertTrue(e['datos']['observada'])
if __name__=='__main__':unittest.main()
