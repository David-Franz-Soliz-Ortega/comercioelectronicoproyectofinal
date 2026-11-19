"""Reglas puras del conteo de actas; no identifica electores individuales."""
import base64
import hashlib
import json


def decodificar_foto(valor):
    if not isinstance(valor, str) or len(valor) > 14000000:
        raise ValueError('Fotografía demasiado grande')
    cabecera, separador, datos = valor.partition(',')
    tipos = {'data:image/jpeg;base64': ('image/jpeg', b'\xff\xd8\xff'), 'data:image/png;base64': ('image/png', b'\x89PNG\r\n\x1a\n')}
    if not separador or cabecera not in tipos:
        raise ValueError('Use una fotografía JPEG o PNG')
    contenido = base64.b64decode(datos, validate=True)
    mime, firma = tipos[cabecera]
    if not contenido.startswith(firma) or not 10 <= len(contenido) <= 10000000:
        raise ValueError('Fotografía inválida')
    return contenido, mime, hashlib.sha256(contenido).hexdigest()


def validar_conteo(votos, candidatos, blancos, nulos, total):
    esperados = {str(c['id']) for c in candidatos}
    recibidos = [str(v['idCandidato']) for v in votos]
    if len(recibidos) != len(set(recibidos)) or set(recibidos) != esperados or not esperados:
        raise ValueError('Debe informar cada candidato de la mesa exactamente una vez')
    cantidades = [v['cantidad'] for v in votos] + [blancos, nulos, total]
    if any(type(v) is not int or not 0 <= v <= 1000000 for v in cantidades):
        raise ValueError('Las cantidades deben ser enteros no negativos')
    return 'publicada' if sum(v['cantidad'] for v in votos) + blancos + nulos == total else 'observada'


def huella_solicitud(datos, foto_hash):
    canonico = {k: datos[k] for k in ('idMesa', 'votos', 'blancos', 'nulos', 'total', 'versionAnterior', 'confirmado')}
    canonico['votos'] = sorted(canonico['votos'], key=lambda v: str(v['idCandidato']))
    canonico['fotoHash'] = foto_hash
    return hashlib.sha256(json.dumps(canonico, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def construir_evento(id_evento, mesa, version, conteo, observada, organizacion):
    # Nunca transportar fotografía, cuenta del operador, sesión ni credenciales.
    return {'idEvento': id_evento, 'tipo': 'acta.actualizada.v1', 'version': 1,
            'datos': {'idProceso': str(mesa['idProceso']), 'idMesa': str(mesa['id']),
                      'idOrganizacion': organizacion, 'versionActa': version,
                      'unidad': mesa['unidad'], 'conteo': conteo, 'observada': observada}}
