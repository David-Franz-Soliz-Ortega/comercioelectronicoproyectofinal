"""Pruebas contra la API y MongoDB propios. Usa únicamente biblioteca estándar."""
import json
import os
import re
import subprocess
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

from pymongo.errors import ServerSelectionTimeoutError
from app import servidor

BASE = os.environ.get("CANDIDATURAS_URL", "http://127.0.0.1:8000")


class Etapa1(unittest.TestCase):
    def solicitar(self, metodo, ruta, estado, cuerpo=None):
        solicitud = Request(
            BASE + ruta, method=metodo,
            data=None if cuerpo is None else json.dumps(cuerpo).encode(),
            headers={"Content-Type": "application/json", "X-Correlation-ID": "prueba-integrante2"},
        )
        try:
            respuesta = urlopen(solicitud, timeout=6)
        except HTTPError as error:
            respuesta = error
        with respuesta:
            self.assertEqual(respuesta.status, estado, f"{metodo} {ruta}")
            self.assertEqual(respuesta.headers["X-Correlation-ID"], "prueba-integrante2")
            if estado >= 400:
                self.assertIn("application/problem+json", respuesta.headers["Content-Type"])
            contenido = respuesta.read()
            return json.loads(contenido) if contenido else None

    def test_salud_documentacion_y_carga_repetible(self):
        for ruta in ("/salud", "/api/v1/salud"):
            self.assertEqual(self.solicitar("GET", ruta, 200), {"estado": "saludable", "servicio": "candidaturas"})
        with urlopen(BASE + "/openapi.yaml", timeout=5) as respuesta:
            self.assertIn(b"listarCandidaturas", respuesta.read())
        with urlopen(BASE + "/docs", timeout=5) as respuesta:
            self.assertEqual(respuesta.status, 200)
            ruta_contrato = re.search(r"url: ['\"]([^'\"]+)", respuesta.read().decode()).group(1)
        with urlopen(BASE + ruta_contrato, timeout=5) as respuesta:
            self.assertIn(b"listarCandidaturas", respuesta.read())
        subprocess.run([sys.executable, "-m", "app.cargar_demostracion"], check=True)
        filtro = {"_id": {"$in": ["20000000-0000-4000-8000-000000000021", "20000000-0000-4000-8000-000000000022"]}}
        antes = list(servidor.coleccion.find(filtro).sort("_id", 1))
        subprocess.run([sys.executable, "-m", "app.cargar_demostracion"], check=True)
        self.assertEqual(len(antes), 2)
        self.assertEqual(list(servidor.coleccion.find(filtro).sort("_id", 1)), antes)

    def test_crud_persistencia_filtros_y_validacion(self):
        entrada = {"idEleccion": str(uuid4()), "nombre": "Lista sintética de prueba", "tipo": "lista", "estado": "borrador"}
        creado = self.solicitar("POST", "/api/v1/candidaturas", 201, entrada)
        ruta = "/api/v1/candidaturas/" + creado["idCandidatura"]
        # Limpia solo el registro que crea esta prueba; nunca datos previos.
        self.addCleanup(self.solicitar, "DELETE", ruta, 204)
        self.addCleanup(self.solicitar, "PUT", ruta, 200, entrada)
        self.assertEqual(set(creado), {"idCandidatura", "idEleccion", "nombre", "tipo", "estado", "creadoEn", "actualizadoEn"})
        self.assertEqual(servidor.coleccion.find_one({"_id": creado["idCandidatura"]})["nombre"], entrada["nombre"])
        self.assertEqual(self.solicitar("GET", ruta, 200), creado)
        self.assertEqual(self.solicitar("GET", "/candidaturas?idEleccion=" + entrada["idEleccion"] + "&limite=1&estado=borrador", 200)["total"], 1)
        self.solicitar("PUT", ruta, 200, {**entrada, "estado": "aprobada"})
        self.solicitar("DELETE", ruta, 409)
        self.solicitar("GET", "/candidaturas/no-uuid", 400)
        self.solicitar("GET", "/candidaturas?estado=inexistente", 400)
        self.solicitar("GET", "/candidaturas?limite=101", 422)
        for cuerpo in ({**entrada, "nombre": "   "}, {**entrada, "tipo": "otro"}, {**entrada, "electorId": "no permitido"}):
            self.solicitar("POST", "/candidaturas", 422, cuerpo)
        self.solicitar("GET", "/candidaturas/" + str(uuid4()), 404)
        eliminable = self.solicitar("POST", "/candidaturas", 201, entrada)
        self.solicitar("DELETE", "/candidaturas/" + eliminable["idCandidatura"], 204)
        self.solicitar("GET", "/candidaturas/" + eliminable["idCandidatura"], 404)

    def test_salud_indica_503_si_mongodb_no_responde(self):
        solicitud = SimpleNamespace(url=SimpleNamespace(path="/salud"), state=SimpleNamespace(id_correlacion="fallo-controlado"))
        with patch.object(servidor, "cliente") as cliente:
            cliente.admin.command.side_effect = ServerSelectionTimeoutError("detalle interno que no debe filtrarse")
            respuesta = servidor.salud(solicitud)
        self.assertEqual(respuesta.status_code, 503)
        cuerpo = json.loads(respuesta.body)
        self.assertEqual(cuerpo["idCorrelacion"], "fallo-controlado")
        self.assertNotIn("detalle interno", cuerpo["detail"])


if __name__ == "__main__":
    unittest.main()
