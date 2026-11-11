"""Pruebas pequeñas de la API con unittest, incluido en Python."""
import json
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

from app.base_datos import cliente, coleccion

URL = "http://127.0.0.1:8000"


# Envía una solicitud HTTP, como los ejemplos curl de la práctica de REST.
def solicitar(metodo, ruta, datos=None):
    cuerpo = None if datos is None else json.dumps(datos).encode()
    peticion = Request(URL + ruta, data=cuerpo, method=metodo,
                       headers={"Content-Type": "application/json"})
    try:
        respuesta = urlopen(peticion, timeout=5)
    except HTTPError as error:
        respuesta = error
    with respuesta:
        texto = respuesta.read()
        return respuesta.status, json.loads(texto) if texto else None


class PruebasCandidaturas(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        cliente.close()

    def test_salud(self):
        estado, datos = solicitar("GET", "/salud")
        self.assertEqual(estado, 200)
        self.assertEqual(datos["estado"], "saludable")
        self.assertEqual(solicitar("GET", "/api/v1/salud")[0], 200)

    def test_crud(self):
        datos = {"idEleccion": str(uuid4()), "nombre": "Lista de prueba",
                 "tipo": "lista", "estado": "borrador"}
        estado, creada = solicitar("POST", "/api/v1/candidaturas", datos)
        self.assertEqual(estado, 201)
        ruta = "/api/v1/candidaturas/" + creada["idCandidatura"]

        try:
            guardada = coleccion.find_one({"_id": creada["idCandidatura"]})
            self.assertEqual(guardada["nombre"], "Lista de prueba")
            self.assertEqual(solicitar("GET", ruta), (200, creada))
            _, lista = solicitar("GET", "/candidaturas?idEleccion=" + datos["idEleccion"])
            self.assertEqual(lista["total"], 1)

            datos["estado"] = "aprobada"
            self.assertEqual(solicitar("PUT", ruta, datos)[0], 200)
            self.assertEqual(solicitar("DELETE", ruta)[0], 409)
        finally:
            # Solo borra la candidatura creada por esta prueba.
            datos["estado"] = "borrador"
            solicitar("PUT", ruta, datos)
            self.assertEqual(solicitar("DELETE", ruta)[0], 204)
        self.assertEqual(solicitar("GET", ruta)[0], 404)

    def test_datos_invalidos(self):
        self.assertEqual(solicitar("POST", "/candidaturas", {})[0], 422)
        self.assertEqual(solicitar("GET", "/candidaturas/no-es-uuid")[0], 400)
        self.assertEqual(solicitar("GET", "/candidaturas?limite=101")[0], 422)


if __name__ == "__main__":
    unittest.main()
