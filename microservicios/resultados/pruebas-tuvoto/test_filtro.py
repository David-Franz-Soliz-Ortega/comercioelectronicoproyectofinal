import io
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from types import SimpleNamespace
from uuid import UUID
import importlib.util
@unittest.skipUnless(importlib.util.find_spec('fastapi'),'Requiere dependencias de Resultados')
class Filtro(unittest.TestCase):
 def test_unidad_filtra_votos_y_denominador_sin_cache_privada(self):
  sys.path.insert(0,str(Path(__file__).parents[1]))
  from app import servidor as s
  ident='11111111-1111-4111-8111-111111111111'
  proceso={'id':ident,'candidatos':[{'id':'c','nombre':'C'}],'mesas':[{'id':'a','unidad':'A'},{'id':'b','unidad':'B'}]}
  filas=[{'idMesa':'a','conteo':{'votos':[{'idCandidato':'c','cantidad':2}],'blancos':0,'nulos':0,'total':2},'actualizadoEn':None},{'idMesa':'b','conteo':{'votos':[{'idCandidato':'c','cantidad':9}],'blancos':0,'nulos':0,'total':9},'actualizadoEn':None}]
  s.app.state.base=SimpleNamespace(mesas_actas=SimpleNamespace(find=lambda filtro:[f for f in filas if 'idMesa' not in filtro or f['idMesa'] in filtro['idMesa']['$in']]))
  class Cache:
   def __init__(self,**_):pass
   def get(self,_):return None
   def setex(self,*_):pass
  with patch.object(s,'urlopen',lambda *_args,**_kw:io.BytesIO(json.dumps(proceso).encode())),patch.object(s.redis,'Redis',Cache),patch.dict(os.environ,{'ELECCIONES_URL':'http://doble-sin-red'}):
   r=s.resultados(UUID(ident),unidad='A')
   self.assertEqual(r['esperadas'],1);self.assertEqual(r['total'],2);self.assertEqual(r['candidatos'][0]['votos'],2)
  sys.path.pop(0)
