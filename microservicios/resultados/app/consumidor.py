"""Cada proceso consume su propia cola y confirma solo tras persistir el evento."""
import json
import logging
import os
from pathlib import Path
import signal
import threading
import time
from datetime import datetime, timezone
from uuid import UUID

from jsonschema import Draft202012Validator, FormatChecker
from pymongo.errors import DuplicateKeyError, PyMongoError
import pika

from app.configuracion import conectar_mongo, declarar_topologia, parametros_rabbit

REGISTRO = logging.getLogger("resultados")
CONTRATO = Path(os.getenv("CONTRATO_EVENTO", "/app/evento.schema.json"))
SALUD = Path("/tmp/consumidor-salud.json")


def cargar_validador():
    esquema = json.loads(CONTRATO.read_text())
    Draft202012Validator.check_schema(esquema)
    return Draft202012Validator(esquema, format_checker=FormatChecker())


def interpretar(cuerpo, validador):
    if len(cuerpo) > 8192:
        raise ValueError("Evento demasiado grande")
    evento = json.loads(cuerpo)
    validador.validate(evento)
    # Canonicalizar evita que variantes de mayúsculas dupliquen el mismo UUID.
    evento["idEvento"] = str(UUID(evento["idEvento"]))
    evento["datos"]["idEleccion"] = str(UUID(evento["datos"]["idEleccion"]))
    return evento


def guardar_evento(coleccion, evento):
    documento = {"_id": evento["idEvento"], "idEleccion": evento["datos"]["idEleccion"], "evento": evento}
    try:
        coleccion.insert_one(documento)
    except DuplicateKeyError:
        anterior = coleccion.find_one({"_id": documento["_id"]})
        if anterior is None or anterior["evento"] != evento:
            raise ValueError("Identificador reutilizado con otro contenido")
    # La unicidad de _id hace atómico persistir y deduplicar, sin transacciones
    # multidocumento ni conjuntos crecientes dentro de un solo documento.


def ejecutar():
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    nombre = os.environ.get("CONSUMIDOR", "conteo")
    if nombre not in ("conteo", "auditoria"):
        raise ValueError("Consumidor desconocido")
    detener = threading.Event()
    for senal in (signal.SIGTERM, signal.SIGINT):
        signal.signal(senal, lambda *_: detener.set())
    validador = cargar_validador()
    cliente, base = conectar_mongo()
    coleccion = base["registros_" + nombre]
    cola = "resultados." + nombre + ".v1"
    while not detener.is_set():
        conexion = None
        try:
            coleccion.create_index("idEleccion")
            conexion = pika.BlockingConnection(parametros_rabbit())
            canal = conexion.channel()
            declarar_topologia(canal)
            canal.basic_qos(prefetch_count=1)

            def recibir(canal, entrega, propiedades, cuerpo):
                try:
                    evento = interpretar(cuerpo, validador)
                except Exception:
                    REGISTRO.warning("Evento inválido enviado a DLQ: %s", nombre)
                    canal.basic_nack(delivery_tag=entrega.delivery_tag, requeue=False)
                    return
                try:
                    guardar_evento(coleccion, evento)
                except ValueError:
                    REGISTRO.warning("Conflicto de idempotencia enviado a DLQ: %s", nombre)
                    canal.basic_nack(delivery_tag=entrega.delivery_tag, requeue=False)
                except PyMongoError:
                    # basic.reject incrementa delivery-count también en RabbitMQ 4.3+;
                    # basic.nack con requeue ya no cuenta como fallo en esas versiones.
                    REGISTRO.warning("Escritura fallida; se reintentará: %s", nombre)
                    detener.wait(1)
                    canal.basic_reject(delivery_tag=entrega.delivery_tag, requeue=True)
                else:
                    canal.basic_ack(delivery_tag=entrega.delivery_tag)

            canal.basic_consume(queue=cola, on_message_callback=recibir, auto_ack=False)
            while not detener.is_set() and conexion.is_open:
                conexion.process_data_events(time_limit=1)
                ahora = datetime.now(timezone.utc)
                base.salud_consumidores.update_one({"_id": nombre}, {"$set": {"instante": ahora}}, upsert=True)
                temporal = SALUD.with_suffix(".tmp")
                temporal.write_text(json.dumps({"instante": time.time()}))
                temporal.replace(SALUD)
        except (pika.exceptions.AMQPError, PyMongoError, OSError):
            REGISTRO.warning("Dependencia no disponible; reconectando consumidor %s", nombre)
        finally:
            SALUD.unlink(missing_ok=True)
            if conexion and conexion.is_open:
                try:
                    conexion.close()
                except pika.exceptions.AMQPError:
                    pass
        detener.wait(2)
    cliente.close()


if __name__ == "__main__":
    ejecutar()
