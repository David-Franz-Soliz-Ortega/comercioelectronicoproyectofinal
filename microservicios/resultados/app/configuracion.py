import os
from urllib.parse import quote_plus

import pika
from pymongo import MongoClient


def conectar_mongo():
    usuario = quote_plus(os.environ["MONGODB_USERNAME"])
    clave = quote_plus(os.environ["MONGODB_PASSWORD"])
    base = os.getenv("MONGODB_DATABASE", "resultados_db")
    origen = quote_plus(os.getenv("MONGODB_AUTH_SOURCE", base))
    host = os.getenv("MONGODB_HOST", "base-mongodb")
    cliente = MongoClient(
        f"mongodb://{usuario}:{clave}@{host}:27017/{base}?authSource={origen}",
        serverSelectionTimeoutMS=3000, connectTimeoutMS=3000,
        socketTimeoutMS=5000, w="majority", journal=True,
    )
    return cliente, cliente[base]


def parametros_rabbit():
    return pika.ConnectionParameters(
        host=os.getenv("RABBITMQ_HOST", "mensajeria-rabbitmq"),
        credentials=pika.PlainCredentials(os.environ["RABBITMQ_USUARIO"], os.environ["RABBITMQ_CLAVE"]),
        heartbeat=15, blocked_connection_timeout=10, socket_timeout=5,
        connection_attempts=1,
    )


def declarar_topologia(canal):
    canal.exchange_declare(exchange="sigape.eventos", exchange_type="topic", durable=True)
    canal.exchange_declare(exchange="sigape.dlq", exchange_type="direct", durable=True)
    for nombre in ("resultados.conteo.v1", "resultados.auditoria.v1"):
        canal.queue_declare(queue=nombre + ".dlq", durable=True, arguments={"x-queue-type": "quorum"})
        canal.queue_bind(queue=nombre + ".dlq", exchange="sigape.dlq", routing_key=nombre)
        canal.queue_declare(queue=nombre, durable=True, arguments={
            "x-queue-type": "quorum", "x-dead-letter-exchange": "sigape.dlq",
            "x-dead-letter-routing-key": nombre, "x-dead-letter-strategy": "at-least-once",
            "x-overflow": "reject-publish", "x-delivery-limit": 5,
        })
        canal.queue_bind(queue=nombre, exchange="sigape.eventos", routing_key="voto.registrado.v1")
