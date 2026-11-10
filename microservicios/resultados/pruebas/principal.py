"""Prueba aditiva del Compose principal; no detiene servicios ni elimina datos.

Ejecutar desde la raíz:
docker compose exec -T resultados python - < microservicios/resultados/pruebas/principal.py
"""
import base64
import json
import os
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

import pika

from app.configuracion import conectar_mongo, parametros_rabbit
from app.consumidor import cargar_validador

BASE = os.environ.get("URL_BASE_PRUEBA", "http://entrada-nginx")


def pedir(ruta, datos=None, clave=None):
    cabeceras = {"Content-Type": "application/json", "X-Correlation-ID": "prueba-sintetica-principal"}
    if clave:
        cabeceras["Idempotency-Key"] = clave
    peticion = Request(BASE + ruta, headers=cabeceras,
                       data=None if datos is None else json.dumps(datos).encode())
    try:
        respuesta = urlopen(peticion, timeout=8)
    except HTTPError as error:
        respuesta = error
    with respuesta:
        return respuesta.status, json.loads(respuesta.read())


def esperar(condicion, descripcion):
    limite = time.monotonic() + 90
    while time.monotonic() < limite:
        if condicion():
            print("OK:", descripcion, flush=True)
            return
        time.sleep(1)
    raise AssertionError("Plazo agotado: " + descripcion)


def inspeccionar_broker(ruta):
    secreto = os.environ["RABBITMQ_USUARIO"] + ":" + os.environ["RABBITMQ_CLAVE"]
    cabecera = "Basic " + base64.b64encode(secreto.encode()).decode()
    host = os.environ.get("RABBITMQ_HOST", "mensajeria-rabbitmq")
    peticion = Request("http://" + host + ":15672/api/" + ruta,
                       headers={"Authorization": cabecera})
    with urlopen(peticion, timeout=8) as respuesta:
        return json.loads(respuesta.read())


def principal():
    for servicio in ("identidad", "elecciones", "candidaturas", "padron-electoral", "votacion", "resultados"):
        codigo, salud = pedir("/api/v1/salud/" + servicio)
        assert codigo == 200, (servicio, codigo, salud)
        print("OK: salud por NGINX:", servicio, flush=True)
    for recurso in ("votos", "resultados"):
        with urlopen(BASE + "/api/v1/" + recurso + "/openapi.yaml", timeout=8) as respuesta:
            assert respuesta.status == 200 and b"openapi:" in respuesta.read()
    consumidores = inspeccionar_broker("consumers/%2F")
    nombres = ("resultados.conteo.v1", "resultados.auditoria.v1")
    propios = [c for c in consumidores if c["queue"]["name"] in nombres]
    assert len(propios) == 2
    assert all(c["ack_required"] and c["prefetch_count"] == 1 for c in propios)
    assert len({c["channel_details"]["connection_name"] for c in propios}) == 2
    colas_antes = {c["name"]: c for c in inspeccionar_broker("queues/%2F")}
    for nombre in nombres:
        assert colas_antes[nombre]["durable"]
        assert colas_antes[nombre]["arguments"]["x-dead-letter-routing-key"] == nombre
        assert colas_antes[nombre + ".dlq"]["durable"]
    print("OK: contratos REST, dos conexiones con ACK manual y DLQ durables", flush=True)

    eleccion, clave = str(uuid4()), str(uuid4())
    codigo, evento = pedir("/api/v1/votos", {"idEleccion": eleccion}, clave)
    assert codigo == 201, (codigo, evento)
    cargar_validador().validate(evento)
    repeticion, repetido = pedir("/api/v1/votos", {"idEleccion": eleccion}, clave)
    assert repeticion == 200 and repetido == evento
    assert pedir("/api/v1/votos", {"idEleccion": str(uuid4())}, clave)[0] == 409
    assert pedir("/api/v1/votos/" + evento["idEvento"]) == (200, evento)

    def comprobar_totales():
        codigo, conteo = pedir("/api/v1/resultados/" + eleccion)
        codigo_auditoria, auditoria = pedir("/api/v1/resultados/" + eleccion + "/auditoria")
        return (codigo == codigo_auditoria == 200 and conteo["totalRegistros"] == 1
                and auditoria["totalEventosAuditados"] == 1)

    esperar(comprobar_totales, "NGINX → votacion → PostgreSQL/bandeja → RabbitMQ → dos consumidores → resultados")
    # Reentrega real sin retirar ni modificar mensajes existentes.
    conexion = pika.BlockingConnection(parametros_rabbit())
    canal = conexion.channel()
    canal.confirm_delivery()
    for _ in range(5):
        canal.basic_publish(exchange="sigape.eventos", routing_key="voto.registrado.v1", mandatory=True,
                            body=json.dumps(evento).encode(),
                            properties=pika.BasicProperties(content_type="application/json", delivery_mode=2))
    conexion.close()

    def confirmar_drenado():
        colas = {c["name"]: c for c in inspeccionar_broker("queues/%2F")}
        return all(colas[n].get("messages_ready", 0) == 0 and colas[n].get("messages_unacknowledged", 0) == 0
                   for n in nombres)

    esperar(confirmar_drenado, "colas sin mensajes pendientes ni ACK pendientes")
    # Dejar que las métricas del broker reflejen las publicaciones recientes.
    time.sleep(6)
    assert comprobar_totales()
    cliente, base = conectar_mongo()
    try:
        for coleccion in (base.registros_conteo, base.registros_auditoria):
            assert coleccion.count_documents({"_id": evento["idEvento"], "idEleccion": eleccion}) == 1
    finally:
        cliente.close()
    print("OK: persistencia MongoDB e idempotencia tras cinco reentregas", flush=True)
    print(json.dumps({"idEleccionSintetica": eleccion, "idEvento": evento["idEvento"],
                      "totalRegistros": 1, "totalEventosAuditados": 1, "datosConservados": True}), flush=True)


if __name__ == "__main__":
    principal()
