import os
from urllib.parse import quote_plus
import pika
from pymongo import MongoClient


def conectar_mongo():
    usuario = quote_plus(os.environ['MONGODB_USERNAME']); clave = quote_plus(os.environ['MONGODB_PASSWORD'])
    base = os.environ['MONGODB_DATABASE']; host = os.environ['MONGODB_HOST']
    cliente = MongoClient(f'mongodb://{usuario}:{clave}@{host}:{int(os.getenv('MONGODB_PUERTO','27017'))}/{base}?authSource={base}', serverSelectionTimeoutMS=3000, connectTimeoutMS=3000, socketTimeoutMS=5000, w='majority', journal=True, tz_aware=True)
    return cliente, cliente[base]


def parametros_rabbit():
    return pika.ConnectionParameters(host=os.environ['RABBITMQ_HOST'], port=int(os.getenv('RABBITMQ_PUERTO','5672')), credentials=pika.PlainCredentials(os.environ['RABBITMQ_USUARIO'], os.environ['RABBITMQ_CLAVE']), heartbeat=20, socket_timeout=5, blocked_connection_timeout=5)


def declarar_topologia(canal):
    canal.exchange_declare(exchange='tuvoto.actas', exchange_type='topic', durable=True)
    canal.exchange_declare(exchange='tuvoto.dlq', exchange_type='direct', durable=True)
    for cola in ['resultados.conteo.v1', 'resultados.auditoria.v1']:
        canal.queue_declare(queue=cola+'.dlq', durable=True, arguments={'x-queue-type': 'quorum'})
        canal.queue_bind(queue=cola+'.dlq', exchange='tuvoto.dlq', routing_key=cola)
        canal.queue_declare(queue=cola, durable=True, arguments={'x-queue-type': 'quorum', 'x-dead-letter-exchange': 'tuvoto.dlq', 'x-dead-letter-routing-key': cola, 'x-delivery-limit': 5})
        canal.queue_bind(queue=cola, exchange='tuvoto.actas', routing_key='acta.actualizada.v1')
