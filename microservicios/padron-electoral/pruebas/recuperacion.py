"""Interrumpe solo las bases aisladas del integrante 2 y verifica su recuperación."""
import json
from pathlib import Path
import subprocess
import time
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

microservicios = Path(__file__).resolve().parents[2]
eleccion = "20000000-0000-4000-8000-000000000001"


def leer(url):
    try:
        respuesta = urlopen(url, timeout=5)
    except HTTPError as error:
        respuesta = error
    with respuesta:
        return respuesta.status, json.load(respuesta)


def esperar(url, estado):
    limite = time.monotonic() + 45
    while time.monotonic() < limite:
        try:
            codigo, cuerpo = leer(url)
            if codigo == estado:
                return cuerpo
        except (URLError, TimeoutError, ConnectionError):
            pass
        time.sleep(0.5)
    raise AssertionError(f"No se recibió HTTP {estado} en {url}")


def comprobar(servicio, base, variable_puerto, puerto_predeterminado, recurso):
    carpeta = microservicios / servicio
    entorno = dict(linea.split("=", 1) for linea in (carpeta / ".env").read_text().splitlines() if "=" in linea and not linea.startswith("#"))
    puerto = entorno.get(variable_puerto, str(puerto_predeterminado))
    url = f"http://127.0.0.1:{puerto}"
    compose = ["docker", "compose", "--env-file", str(carpeta / ".env"), "-f", str(carpeta / "compose.etapa1.yml")]

    def ejecutar(*argumentos):
        subprocess.run([*compose, *argumentos], check=True)

    esperar(url + "/salud", 200)
    ruta = url + f"/api/v1/{recurso}?idEleccion={eleccion}"
    codigo, antes = leer(ruta)
    assert codigo == 200 and antes["total"] >= 2, "Primero ejecuta etapa1.sh cargar"
    try:
        ejecutar("stop", base)
        fallo = esperar(url + "/salud", 503)
        assert fallo["status"] == 503
    finally:
        ejecutar("up", "-d", "--no-build", "--wait", "--wait-timeout", "120", base)
    esperar(url + "/salud", 200)
    assert leer(ruta) == (200, antes), "Cambió la persistencia al reiniciar la base"
    ejecutar("restart", servicio)
    esperar(url + "/salud", 200)
    assert leer(ruta) == (200, antes), "Cambió la persistencia al reiniciar la API"
    print(f"OK {servicio}: 503 sin base, recuperación 200 y datos conservados tras ambos reinicios.", flush=True)


if __name__ == "__main__":
    comprobar("padron-electoral", "base-postgres", "PUERTO_HTTP_PADRON", 3004, "inscripciones")
    comprobar("candidaturas", "base-mongodb", "PUERTO_HTTP_CANDIDATURAS", 8003, "candidaturas")
