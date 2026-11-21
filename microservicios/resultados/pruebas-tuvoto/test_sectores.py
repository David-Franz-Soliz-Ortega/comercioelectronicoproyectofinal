"""Reglas académicas explícitas; sin consulta de datos o reglamentos reales."""
import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('proyeccion_sector',Path(__file__).parents[1]/'app/proyeccion.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Sectores(unittest.TestCase):
 def proceso(self,ponderacion=False,pesos=(5000,5000),regla=None):
  return {'candidatos':[{'id':'a','nombre':'A'},{'id':'b','nombre':'B'}], 'mesas':[{'id':'d','unidad':'U','sector':'docentes'},{'id':'e','unidad':'U','sector':'estudiantes'}], 'sectores':[{'codigo':'docentes','nombre':'Docentes','pesoBps':pesos[0]},{'codigo':'estudiantes','nombre':'Estudiantes','pesoBps':pesos[1]}], 'ponderacion':ponderacion,'reglaSegundaVuelta':regla}
 def actas(self,a=70,b=300):
  return [{'idMesa':'d','conteo':{'votos':[{'idCandidato':'a','cantidad':a},{'idCandidato':'b','cantidad':100-a}],'blancos':0,'nulos':0,'total':100}}, {'idMesa':'e','conteo':{'votos':[{'idCandidato':'a','cantidad':b},{'idCandidato':'b','cantidad':1000-b}],'blancos':0,'nulos':0,'total':1000}}]
 def test_sin_ponderar_todos_los_votos_valen_igual(self):
  r=m.resumir(self.proceso(),self.actas());self.assertEqual(r['candidatos'][0]['votos'],370);self.assertEqual(r['candidatos'][0]['porcentaje'],33.64);self.assertIsNone(r['candidatos'][0]['porcentajePonderado']);self.assertEqual(r['sectores'][0]['validos'],100)
 def test_pesos_configurables_y_no_se_confunden_con_votos(self):
  r=m.resumir(self.proceso(True),self.actas());self.assertEqual(r['candidatos'][0]['porcentajePonderado'],50)
  r=m.resumir(self.proceso(True,(3000,7000)),self.actas());self.assertEqual(r['candidatos'][0]['porcentajePonderado'],42);self.assertEqual(r['total'],1100)
 def test_sector_sin_validos_no_redistribuye_pesos(self):
  actas=self.actas();actas[1]['conteo']={'votos':[{'idCandidato':'a','cantidad':0},{'idCandidato':'b','cantidad':0}],'blancos':0,'nulos':0,'total':0}
  r=m.resumir(self.proceso(True),actas);self.assertTrue(all(c['porcentajePonderado'] is None for c in r['candidatos']))
 def test_mayoria_separada_es_diferente_del_promedio(self):
  p=self.proceso(True,regla={'modo':'por_sector','umbral':50,'estricto':True});r=m.resumir(p,self.actas());self.assertEqual(r['regla']['estado'],'posible_segunda_vuelta')
  r=m.resumir(p,self.actas(70,700));self.assertEqual(r['regla']['candidatos'],['a']);self.assertEqual(r['regla']['estado'],'posible_ganador')
 def test_mesas_pendientes_o_revision_no_proclaman(self):
  p=self.proceso(regla={'modo':'porcentaje','umbral':50,'estricto':True});r=m.resumir(p,self.actas()[:1]);self.assertEqual(r['regla']['estado'],'provisional')
  actas=self.actas();actas[0]['observada']=True;r=m.resumir(p,actas);self.assertEqual(r['requierenRevision'],1);self.assertEqual(r['regla']['estado'],'provisional')
 def test_filtro_y_empates_no_inventan_clasificados(self):
  p=self.proceso(regla={'modo':'porcentaje','umbral':50,'estricto':True});p['filtroUnidad']=True;self.assertEqual(m.resumir(p,self.actas())['regla']['estado'],'parcial')
  p.pop('filtroUnidad');p['candidatos'].append({'id':'c','nombre':'C'});actas=self.actas();actas[0]['conteo']['votos']=[{'idCandidato':'a','cantidad':40},{'idCandidato':'b','cantidad':30},{'idCandidato':'c','cantidad':30}];actas[1]['conteo']['votos']=[{'idCandidato':'a','cantidad':400},{'idCandidato':'b','cantidad':300},{'idCandidato':'c','cantidad':300}]
  self.assertEqual(m.resumir(p,actas)['regla']['estado'],'requiere_revision')
 def test_segunda_vuelta_no_crea_tercera(self):
  p=self.proceso(True,regla={'modo':'porcentaje','umbral':50,'estricto':True});p['vuelta']=2;self.assertEqual(m.resumir(p,self.actas())['regla']['estado'],'requiere_revision')
