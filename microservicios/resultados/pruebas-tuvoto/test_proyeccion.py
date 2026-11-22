import importlib.util
from pathlib import Path
import unittest
s=importlib.util.spec_from_file_location('proyeccion',Path(__file__).parents[1]/'app/proyeccion.py');d=importlib.util.module_from_spec(s);s.loader.exec_module(d)
class Conteo(unittest.TestCase):
 def test_contabilizadas_observadas_y_porcentajes(self):
  p={'candidatos':[{'id':'a','nombre':'A'},{'id':'b','nombre':'B'}],'mesas':[{'id':'m1','unidad':'U'},{'id':'m2','unidad':'U'},{'id':'m3','unidad':'V'}]}
  c={'votos':[{'idCandidato':'a','cantidad':3},{'idCandidato':'b','cantidad':1}],'blancos':1,'nulos':1,'total':6}
  r=d.resumir(p,[{'idMesa':'m1','conteo':c,'observada':True},{'idMesa':'m2','conteo':None,'observada':True}])
  self.assertEqual((r['esperadas'],r['contabilizadas'],r['pendientes'],r['observadas']),(3,1,2,1))
  self.assertEqual(r['candidatos'][0]['porcentaje'],75);self.assertEqual(r['total'],6)
 def test_suma_mesas_por_candidato_sin_mezclar_cargos(self):
  rector={'candidatos':[{'id':'r','nombre':'Postulante rector sintético'}],'mesas':[{'id':'r1','unidad':'U'},{'id':'r2','unidad':'V'}]}
  vice={'candidatos':[{'id':'v','nombre':'Postulante vice sintético'}],'mesas':[{'id':'v1','unidad':'U'},{'id':'v2','unidad':'V'}]}
  filas=[{'idMesa':mesa,'conteo':{'votos':[{'idCandidato':candidato,'cantidad':cantidad}],'blancos':0,'nulos':0,'total':cantidad}} for mesa,candidato,cantidad in [('r1','r',10),('r2','r',7),('v1','v',6),('v2','v',5)]]
  r=d.resumir(rector,filas);v=d.resumir(vice,filas)
  self.assertEqual(r['candidatos'][0]['votos'],17);self.assertEqual(v['candidatos'][0]['votos'],11)
  self.assertEqual((r['contabilizadas'],v['contabilizadas']),(2,2))
 def test_sin_datos_no_inventa_votos(self):
  r=d.resumir({'candidatos':[],'mesas':[]},[]);self.assertEqual(r['avance'],0);self.assertEqual(r['total'],0)
if __name__=='__main__':unittest.main()
