"""Pruebas sobre servicios y almacenes reales; solo genera datos sintéticos nuevos."""
import base64
import concurrent.futures
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import sys
import time
from uuid import uuid4
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import pika
from app.configuracion import conectar_mongo, declarar_topologia, parametros_rabbit
from app.consumidor import cargar_validador

ESTADO = Path('/evidencia/estado.json')


def pedir(ruta, datos=None, clave=None):
    cabeceras = {'Content-Type': 'application/json'}
    if clave:
        cabeceras['Idempotency-Key'] = clave
    peticion = Request(ruta, data=json.dumps(datos).encode() if datos is not None else None, headers=cabeceras)
    try:
        respuesta = urlopen(peticion, timeout=8)
    except HTTPError as error:
        respuesta = error
    with respuesta:
        return respuesta.status, json.loads(respuesta.read())


def esperar(condicion, descripcion, segundos=90):
    limite = time.monotonic() + segundos
    ultimo = None
    while time.monotonic() < limite:
        try:
            ultimo = condicion()
            if ultimo:
                print('OK:', descripcion, flush=True)
                return
        except Exception as error:
            ultimo = type(error).__name__
        time.sleep(1)
    raise AssertionError(f'{descripcion}: agotado plazo ({ultimo})')


def conteos(eleccion, cantidad):
    codigo, conteo = pedir('http://resultados:8000/api/v1/resultados/' + eleccion)
    codigo_auditoria, auditoria = pedir('http://resultados:8000/api/v1/resultados/' + eleccion + '/auditoria')
    return codigo == codigo_auditoria == 200 and conteo['totalRegistros'] == auditoria['totalEventosAuditados'] == cantidad


def publicar(cuerpos):
    conexion = pika.BlockingConnection(parametros_rabbit())
    canal = conexion.channel()
    declarar_topologia(canal)
    canal.confirm_delivery()
    for cuerpo in cuerpos:
        canal.basic_publish(exchange='sigape.eventos', routing_key='voto.registrado.v1', body=cuerpo,
                            mandatory=True, properties=pika.BasicProperties(delivery_mode=2, content_type='application/json'))
    conexion.close()


def profundidad(cola):
    conexion = pika.BlockingConnection(parametros_rabbit())
    resultado = conexion.channel().queue_declare(queue=cola, passive=True).method.message_count
    conexion.close()
    return resultado


def inicial():
    esperar(lambda: pedir('http://votacion:8080/api/v1/salud')[0] == 200, 'salud votacion')
    esperar(lambda: pedir('http://resultados:8000/api/v1/salud')[0] == 200, 'salud resultados y ambos consumidores')
    eleccion, clave = str(uuid4()), str(uuid4())
    datos = {'idEleccion': eleccion}
    codigo, evento = pedir('http://votacion:8080/api/v1/votos', datos, clave)
    assert codigo == 201
    cargar_validador().validate(evento)
    esperar(lambda: conteos(eleccion, 1), 'publicación y dos consumidores independientes')
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as grupo:
        respuestas = list(grupo.map(lambda _: pedir('http://votacion:8080/api/v1/votos', datos, clave), range(16)))
    assert all(codigo == 200 and cuerpo == evento for codigo, cuerpo in respuestas)
    assert pedir('http://votacion:8080/api/v1/votos', {'idEleccion': str(uuid4())}, clave)[0] == 409
    assert pedir('http://votacion:8080/api/v1/votos', datos)[0] == 400
    assert pedir('http://votacion:8080/api/v1/votos', {**datos, 'identidad': 'rechazar'}, str(uuid4()))[0] == 400
    assert pedir('http://resultados:8000/api/v1/resultados/invalido')[0] == 422
    assert pedir('http://votacion:8080/api/v1/votos/' + str(uuid4()))[0] == 404
    publicar([json.dumps(evento).encode()] * 8)
    esperar(lambda: profundidad('resultados.conteo.v1') == profundidad('resultados.auditoria.v1') == 0, 'reentregas procesadas')
    time.sleep(2)
    assert conteos(eleccion, 1)
    # Evento inválido y reutilización maliciosa del mismo idEvento van a cada DLQ.
    conflicto = {**evento, 'datos': {'idEleccion': str(uuid4())}}
    publicar([b'{invalido', json.dumps({**evento, 'extra': True}).encode(), json.dumps(conflicto).encode()])
    esperar(lambda: profundidad('resultados.conteo.v1.dlq') == profundidad('resultados.auditoria.v1.dlq') == 3, 'DLQ para JSON inválido, esquema inválido y conflicto')
    cliente, base = conectar_mongo()
    assert base.registros_conteo.count_documents({'idEleccion': eleccion}) == 1
    assert base.registros_auditoria.count_documents({'idEleccion': eleccion}) == 1
    cliente.close()
    # Muchos registros distintos concurrentes de una misma elección no pierden incrementos.
    def nuevo(_):
        return pedir('http://votacion:8080/api/v1/votos', datos, str(uuid4()))
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as grupo:
        nuevos = list(grupo.map(nuevo, range(20)))
    assert all(codigo == 201 for codigo, _ in nuevos)
    esperar(lambda: conteos(eleccion, 21), '21 registros concurrentes sin pérdidas ni duplicados')
    ESTADO.write_text(json.dumps({'eleccion': eleccion, 'clave': clave, 'evento': evento, 'cantidad': 21, 'dlqConteo': 3, 'dlqAuditoria': 3}))
    print('OK: validación REST, contrato, idempotencia HTTP concurrente y persistencia MongoDB', flush=True)


def verificar():
    estado = json.loads(ESTADO.read_text())
    esperar(lambda: conteos(estado['eleccion'], estado['cantidad']), 'recuperación de conteo y auditoría')
    codigo, evento = pedir('http://votacion:8080/api/v1/votos/' + estado['evento']['idEvento'])
    assert codigo == 200 and evento == estado['evento']
    codigo, repetido = pedir('http://votacion:8080/api/v1/votos', {'idEleccion': estado['eleccion']}, estado['clave'])
    assert codigo == 200 and repetido == estado['evento']
    assert profundidad('resultados.conteo.v1.dlq') == estado.get('dlqConteo', 3)
    assert profundidad('resultados.auditoria.v1.dlq') == estado.get('dlqAuditoria', 3)
    print('OK: persistencia e idempotencia tras reinicio, DLQ conservadas', flush=True)


def sin_auditoria():
    estado = json.loads(ESTADO.read_text())
    estado['cantidad'] += 1
    codigo, evento = pedir('http://votacion:8080/api/v1/votos', {'idEleccion': estado['eleccion']}, str(uuid4()))
    assert codigo == 201
    esperar(lambda: pedir('http://resultados:8000/api/v1/resultados/' + estado['eleccion'])[1]['totalRegistros'] == estado['cantidad'], 'conteo sigue con auditoría detenida')
    assert pedir('http://resultados:8000/api/v1/resultados/' + estado['eleccion'] + '/auditoria')[1]['totalEventosAuditados'] == estado['cantidad'] - 1
    esperar(lambda: profundidad('resultados.auditoria.v1') == 1, 'cola independiente conserva auditoría pendiente')
    ESTADO.write_text(json.dumps(estado))


def sin_rabbit():
    estado = json.loads(ESTADO.read_text())
    codigo, evento = pedir('http://votacion:8080/api/v1/votos', {'idEleccion': estado['eleccion']}, str(uuid4()))
    assert codigo == 201
    estado['cantidad'] += 1
    ESTADO.write_text(json.dumps(estado))
    print('OK: registro aceptado y conservado en bandeja PostgreSQL con RabbitMQ detenido', flush=True)



def detalles_rabbit(ruta):
    credencial = base64.b64encode((os.environ['RABBITMQ_USUARIO'] + ':' + os.environ['RABBITMQ_CLAVE']).encode()).decode()
    peticion = Request('http://mensajeria-rabbitmq:15672/api/' + ruta, headers={'Authorization': 'Basic ' + credencial})
    with urlopen(peticion, timeout=5) as respuesta:
        return json.loads(respuesta.read())


def ack_y_reintentos():
    consumidores = detalles_rabbit('consumers/%2F')
    propios = [c for c in consumidores if c['queue']['name'] in ('resultados.conteo.v1', 'resultados.auditoria.v1')]
    assert len(propios) == 2 and all(c['ack_required'] and c['prefetch_count'] == 1 for c in propios)
    assert len({c['channel_details']['connection_name'] for c in propios}) == 2
    print('OK: broker confirma dos conexiones independientes con ACK manual y prefetch 1', flush=True)
    cliente, base = conectar_mongo()
    evento = {'idEvento': str(uuid4()), 'tipo': 'voto.registrado.v1', 'version': 1,
              'timestamp': datetime.now(timezone.utc).isoformat(), 'datos': {'idEleccion': str(uuid4())}}
    estado = json.loads(ESTADO.read_text())
    anterior = profundidad('resultados.conteo.v1.dlq')
    # Fallo real de escritura, limitado al evento sintético de esta prueba.
    base.command({'collMod': 'registros_conteo', 'validator': {'_id': {'$ne': evento['idEvento']}}})
    try:
        publicar([json.dumps(evento).encode()])
        esperar(lambda: profundidad('resultados.conteo.v1.dlq') == anterior + 1,
                'NACK y reintentos acotados terminan en DLQ ante fallo persistente MongoDB', segundos=60)
        assert base.registros_conteo.count_documents({'_id': evento['idEvento']}) == 0
        assert base.registros_auditoria.count_documents({'_id': evento['idEvento']}) == 1
        print('OK: ningún ACK de éxito ni conteo parcial cuando falla la escritura', flush=True)
    finally:
        base.command({'collMod': 'registros_conteo', 'validator': {}})
        cliente.close()
    # Reprocesar desde el cuerpo original conserva también el mensaje de DLQ como evidencia.
    publicar([json.dumps(evento).encode()])
    esperar(lambda: conteos(evento['datos']['idEleccion'], 1), 'reproceso tras recuperación sin duplicar auditoría')
    estado['dlqConteo'] = anterior + 1
    ESTADO.write_text(json.dumps(estado))


def sin_redis():
    estado = json.loads(ESTADO.read_text())
    codigo, evento = pedir('http://votacion:8080/api/v1/votos/' + estado['evento']['idEvento'])
    assert codigo == 200 and evento == estado['evento']
    assert pedir('http://votacion:8080/api/v1/salud')[0] == 503
    print('OK: consulta recuperada desde PostgreSQL sin Redis y salud degradada', flush=True)


def nginx():
    esperar(lambda: pedir('http://entrada-nginx/api/v1/salud/votacion')[0] == 200, 'NGINX enruta salud votacion')
    esperar(lambda: pedir('http://entrada-nginx/api/v1/salud/resultados')[0] == 200, 'NGINX enruta salud resultados')
    estado = json.loads(ESTADO.read_text())
    assert pedir('http://entrada-nginx/api/v1/votos/' + estado['evento']['idEvento'])[0] == 200
    assert pedir('http://entrada-nginx/api/v1/resultados/' + estado['eleccion'])[1]['totalRegistros'] == estado['cantidad']
    for ruta in ('votos', 'resultados'):
        with urlopen('http://entrada-nginx/api/v1/' + ruta + '/openapi.yaml', timeout=5) as respuesta:
            assert respuesta.status == 200 and b'openapi:' in respuesta.read()
    print('OK: rutas REST y contratos servidos por NGINX', flush=True)


if __name__ == '__main__':
    {'inicial': inicial, 'verificar': verificar, 'sin-auditoria': sin_auditoria, 'sin-rabbit': sin_rabbit, 'ack-y-reintentos': ack_y_reintentos, 'sin-redis': sin_redis, 'nginx': nginx}[sys.argv[1]]()
