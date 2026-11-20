"""La recepción pública consulta la publicación del cargo solicitado."""
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
from uuid import UUID

class AvancePublico(unittest.TestCase):
 def test_cargo_publicado_y_retirado(self):
  sys.path.insert(0,str(Path(__file__).parents[1]))
  from app import servidor as s
  from fastapi import HTTPException
  identificador=UUID('11111111-1111-4111-8111-111111111111')
  conexion=MagicMock()
  conexion.__enter__.return_value.execute.return_value.fetchone.return_value={'mesasConActa':2,'versiones':3}
  with patch.dict(os.environ,{'ELECCIONES_URL':'http://elecciones-sinteticas'}),patch.object(s,'remoto',return_value={'id':str(identificador)}) as consulta,patch.object(s,'conectar',return_value=conexion) as conectar:
   self.assertEqual(s.avance_publico(identificador)['mesasConActa'],2)
   self.assertEqual(consulta.call_args.args[0],f'http://elecciones-sinteticas/api/v1/publico/procesos/{identificador}')
   consulta.side_effect=HTTPException(404,'Proceso no publicado');conectar.reset_mock()
   with self.assertRaises(HTTPException):s.avance_publico(identificador)
   conectar.assert_not_called()
  sys.path.pop(0)
