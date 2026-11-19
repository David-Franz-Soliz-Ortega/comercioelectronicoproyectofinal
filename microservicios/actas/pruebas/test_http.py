"""Prueba HTTP en memoria, sin lifespan, bases ni solicitudes externas."""
import importlib.util
import unittest
from pathlib import Path
import sys
DEPENDENCIAS=bool(importlib.util.find_spec('fastapi')) and bool(importlib.util.find_spec('httpx'))
@unittest.skipUnless(DEPENDENCIAS,'Requiere dependencias de Actas y httpx')
class HTTP(unittest.TestCase):
 def test_openapi_y_bloqueo_antes_de_persistencia(self):
  from fastapi.testclient import TestClient
  from fastapi import HTTPException
  sys.path.insert(0,str(Path(__file__).parents[1]))
  from app import servidor
  original=servidor.autorizar
  def rechazar(*_):raise HTTPException(403,'Sin permiso')
  servidor.autorizar=rechazar
  try:
   cliente=TestClient(servidor.app)
   self.assertEqual(cliente.get('/openapi.json').status_code,200)
   uid='11111111-1111-4111-8111-111111111111'
   r=cliente.post('/api/v1/actas',json={'idMesa':uid,'idSolicitud':uid,'versionAnterior':0,'foto':'solo-doble','votos':[{'idCandidato':uid,'cantidad':1}],'blancos':0,'nulos':0,'total':1,'confirmado':True})
   self.assertEqual(r.status_code,403)
   r=cliente.post('/api/v1/actas',json={'idUsuario':'no-confiar-en-cliente'})
   self.assertEqual(r.status_code,422)
  finally:servidor.autorizar=original;sys.path.pop(0)
if __name__=='__main__':unittest.main()
