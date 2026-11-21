"""Reservas: liberación ante éxito y fallos, sin bases ni conexiones reales."""
import sys
from pathlib import Path
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[1]))
from app import cliente_mesas as c
from fastapi import HTTPException
class Recepcion(unittest.TestCase):
 def test_libera_despues_de_commit_o_fallo(self):
  for fallo in [False,True]:
   with patch.object(c,'consultar_mesa',return_value={'estado':'recepcion'}) as remoto:
    try:
     with c.registro_mesa(None,'mesa-sintetica'):
      if fallo:raise ValueError('Fallo sintético antes de commit')
    except ValueError:pass
    self.assertEqual(remoto.call_count,2)
    self.assertTrue(remoto.call_args.args[-1])
    self.assertEqual(remoto.call_args_list[0].args[3],remoto.call_args.args[3])
 def test_cierre_denegado_no_entra_a_persistencia_y_libera_si_hubo_timeout(self):
  with patch.object(c,'consultar_mesa',side_effect=[HTTPException(409,'Cerrada'),{}]) as remoto:
   with self.assertRaises(HTTPException):
    with c.registro_mesa(None,'mesa-sintetica'):self.fail('No debe entrar')
   self.assertEqual(remoto.call_count,2)
