import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import pika
from jsonschema import Draft202012Validator, FormatChecker
from pymongo.errors import DuplicateKeyError
from .configuracion import conectar_mongo, parametros_rabbit, declarar_topologia

validador = Draft202012Validator(json.loads(Path(os.getenv('CONTRATO_EVENTO','/app/evento.schema.json')).read_text()), format_checker=FormatChecker())
modo = os.environ['MODO_CONSUMIDOR']
if modo not in ('conteo', 'auditoria'): raise RuntimeError('Consumidor inválido')


def procesar(base, evento):
    validador.validate(evento)
    d = evento['datos']; conteo = d['conteo']
    if conteo and (len({v['idCandidato'] for v in conteo['votos']}) != len(conteo['votos']) or sum(v['cantidad'] for v in conteo['votos']) + conteo['blancos'] + conteo['nulos'] != conteo['total']): raise ValueError('Conteo inválido')
    huella = hashlib.sha256(json.dumps(evento, sort_keys=True).encode()).hexdigest()
    if modo == 'auditoria':
        try: base.auditoria_actas.insert_one({'_id': evento['idEvento'], 'huella': huella, 'evento': evento})
        except DuplicateKeyError:
            if base.auditoria_actas.find_one({'_id': evento['idEvento']})['huella'] != huella: raise ValueError('Evento reutilizado')
    else:
        clave = d['idProceso'] + ':' + d['idMesa']
        nuevo = {**d, 'huella': huella, 'actualizadoEn': datetime.now(timezone.utc)}
        try: base.mesas_actas.update_one({'_id': clave, 'versionActa': {'$lt': d['versionActa']}}, {'$set': nuevo}, upsert=True)
        except DuplicateKeyError:
            anterior = base.mesas_actas.find_one({'_id': clave})
            if anterior['versionActa'] == d['versionActa'] and anterior['huella'] != huella: raise ValueError('Versión conflictiva')


while True:
    try:
        cliente, base = conectar_mongo(); cliente.admin.command('ping')
        base.mesas_actas.create_index('idProceso')
        conexion = pika.BlockingConnection(parametros_rabbit()); canal = conexion.channel(); declarar_topologia(canal); canal.basic_qos(prefetch_count=1)
        def recibir(ch, entrega, _propiedades, cuerpo):
            try:
                procesar(base, json.loads(cuerpo)); ch.basic_ack(entrega.delivery_tag)
            except (ValueError, json.JSONDecodeError): ch.basic_reject(entrega.delivery_tag, requeue=False)
            except Exception as e:
                from jsonschema.exceptions import ValidationError
                ch.basic_reject(entrega.delivery_tag, requeue=not isinstance(e, ValidationError))
        canal.basic_consume(queue='resultados.'+modo+'.v1', on_message_callback=recibir, auto_ack=False)
        while conexion.is_open:
            conexion.process_data_events(time_limit=1)
            base.salud_consumidores.update_one({'_id': modo}, {'$set': {'instante': datetime.now(timezone.utc)}}, upsert=True)
            Path('/tmp/salud-consumidor').touch()
    except Exception:
        try: conexion.close()
        except Exception: pass
        try: cliente.close()
        except Exception: pass
        time.sleep(2)
