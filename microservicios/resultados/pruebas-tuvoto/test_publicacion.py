"""Un cargo retirado no se sirve desde MongoDB ni desde Redis."""
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from uuid import UUID

class Publicacion(unittest.TestCase):
 def test_retira_resultados_antes_de_consultar_cache(self):
  sys.path.insert(0,str(Path(__file__).parents[1]))
  from app import servidor as s
  from fastapi import HTTPException
  identificador=UUID('11111111-1111-4111-8111-111111111111')
  with patch.dict(os.environ,{'ELECCIONES_URL':'http://elecciones-sinteticas'}),patch.object(s,'urlopen',side_effect=HTTPError('http://doble',404,'No publicado',{},None)) as consulta,patch.object(s.redis,'Redis') as cache:
   with self.assertRaises(HTTPException) as error:s.resultados(identificador)
   self.assertEqual(error.exception.status_code,404)
   self.assertEqual(consulta.call_args.args[0],f'http://elecciones-sinteticas/api/v1/publico/procesos/{identificador}')
   cache.assert_not_called()
  sys.path.pop(0)
