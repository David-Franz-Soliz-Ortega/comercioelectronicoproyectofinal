"""Lectura local de actas impresas. Las sugerencias nunca publican resultados."""
import csv
import io
import os
import re
import subprocess
import tempfile
import threading
import time
import unicodedata
import warnings
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError
from fastapi import HTTPException

# Acotar memoria, procesos y duración aun con varias solicitudes simultáneas.
Image.MAX_IMAGE_PIXELS = 24000000
TURNOS = threading.BoundedSemaphore(2)


def normalizar(texto):
    return ' '.join(re.sub(r'[^a-z0-9 ]', ' ', ''.join(c for c in unicodedata.normalize('NFD', texto.lower()) if not unicodedata.combining(c))).split())


FILA = re.compile(r'(.+?)\s*[:|]?\s+(\d{1,7})\s*')


def lineas_ocr(tsv):
    lineas = {}
    for palabra in csv.DictReader(io.StringIO(tsv), delimiter='\t', quoting=csv.QUOTE_NONE):
        if palabra.get('level') != '5' or not palabra.get('text', '').strip():
            continue
        clave = tuple(palabra[k] for k in ('page_num', 'block_num', 'par_num', 'line_num'))
        lineas.setdefault(clave, []).append((palabra['text'], float(palabra['conf'])))
    return [(' '.join(p[0] for p in palabras), min(p[1] for p in palabras)) for palabras in lineas.values()]


def interpretar(tsv, candidatos, codigo, ambiguos=None):
    filas = lineas_ocr(tsv)
    etiquetas = [(c['id'], normalizar(c['nombre'])) for c in candidatos]
    etiquetas += [('blancos', 'blancos'), ('blancos', 'votos blancos'), ('nulos', 'nulos'), ('nulos', 'votos nulos'), ('total', 'total'), ('total', 'total votos')]
    valores = {clave: [] for clave, _ in etiquetas}
    avisos = []
    mesa_leida = False
    # El nombre debe coincidir completo. No aproximar nombres ni convertir letras en cifras.
    for texto, confianza in filas:
        limpio = normalizar(texto)
        if limpio.startswith('mesa '):
            if confianza < 70 or limpio[5:] != normalizar(codigo):
                raise ValueError('La mesa de la fotografía no coincide o no se pudo leer. Revisa la foto y la mesa seleccionada.')
            mesa_leida = True
        coincidencia = FILA.fullmatch(texto.strip())
        if not coincidencia:
            continue
        nombre, numero = normalizar(coincidencia[1]), int(coincidencia[2])
        destinos = [clave for clave, etiqueta in etiquetas if nombre == etiqueta]
        if len(destinos) == 1:
            valores[destinos[0]].append(numero if confianza >= 70 and numero <= 1000000 else None)
    # Filas repetidas son ambiguas, incluso si coinciden sus cifras.
    if ambiguos is not None:
        ambiguos.update(k for k, vs in valores.items() if len(vs) > 1)
    unicos = {k: vs[0] if len(vs) == 1 else None for k, vs in valores.items()}
    if not mesa_leida:
        avisos.append('No se leyó el código de mesa. Comprueba que la fotografía corresponda a la mesa seleccionada.')
    return proponer(unicos, candidatos, avisos)


def _codigo_coincide(leido, codigo):
    codigo = normalizar(codigo)
    return bool(codigo) and (leido == codigo or leido.startswith(codigo + ' '))


def _palabras_coinciden(leido, referencia):
    # Una palabra leída coincide si comparte raíz (docente/docentes); no se aproximan letras.
    a, b = leido.split(), referencia.split()
    return bool(a and b) and all(any(x.startswith(y) or y.startswith(x) for y in b if min(len(x), len(y)) >= 4 or x == y) for x in a)


def elegir_destino(filas, mesas):
    """Elige, entre las mesas del operador, la que corresponde a la foto.

    Exige el código de mesa o al menos una candidatura leída con su nombre completo.
    Nunca adivina: si dos destinos empatan, devuelve las opciones para que el operador elija.
    """
    limpias = [(normalizar(texto), confianza) for texto, confianza in filas]
    codigos = [t[5:] for t, c in limpias if t.startswith('mesa ') and c >= 70]
    cargos = [t[6:] for t, _ in limpias if t.startswith('cargo ')]
    sectores = [t[7:] for t, _ in limpias if t.startswith('sector ')]
    nombres = {normalizar(m[1]) for texto, c in filas if c >= 70 and (m := FILA.fullmatch(texto.strip()))}
    puntajes = []
    for mesa in mesas:
        codigo = any(_codigo_coincide(leido, mesa['codigo']) for leido in codigos)
        if codigos and not codigo:
            continue  # Se leyó el código de otra mesa.
        candidaturas = sum(normalizar(c['nombre']) in nombres for c in mesa['candidatos'])
        if not codigo and not candidaturas:
            continue
        cargo = any(_palabras_coinciden(leido, normalizar(mesa.get('nombreProceso', ''))) for leido in cargos)
        sector = any(_palabras_coinciden(leido, normalizar(mesa.get('sector') or 'general')) for leido in sectores)
        puntajes.append((100 * codigo + 10 * candidaturas + 5 * cargo + 5 * sector, mesa))
    if not puntajes:
        return {'mesa': None, 'opciones': []}
    mejor = max(p for p, _ in puntajes)
    empatadas = [m for p, m in puntajes if p == mejor]
    return {'mesa': empatadas[0], 'opciones': []} if len(empatadas) == 1 else {'mesa': None, 'opciones': [m['id'] for m in empatadas]}


def proponer(valores, candidatos, avisos):
    completa = all(v is not None for v in valores.values()) and bool(candidatos)
    if not completa:
        avisos.append('Completa los campos vacíos: no se leyeron con suficiente claridad o había filas repetidas.')
    coincide = (sum(valores[c['id']] for c in candidatos) + valores['blancos'] + valores['nulos'] == valores['total']) if completa else None
    if coincide is False:
        avisos.append('La suma leída no coincide con el total. Compara todos los números con la foto.')
    return {'votos': [{'idCandidato': c['id'], 'cantidad': valores[c['id']]} for c in candidatos],
            'blancos': valores['blancos'], 'nulos': valores['nulos'], 'total': valores['total'],
            'completa': completa, 'sumaCoincide': coincide, 'advertencias': avisos,
            'requiereRevision': True, 'motor': 'tesseract'}


def combinar_lecturas(primera, segunda, candidatos, ambiguos=()):
    def cifras(propuesta):
        return {**{v['idCandidato']: v['cantidad'] for v in propuesta['votos']}, **{k: propuesta[k] for k in ('blancos', 'nulos', 'total')}}
    a, b = cifras(primera), cifras(segunda)
    conflictos = {k for k in a if a[k] is not None and b[k] is not None and a[k] != b[k]}
    valores = {k: None if k in conflictos or k in ambiguos else a[k] if a[k] is not None else b[k] for k in a}
    avisos = [aviso for aviso in primera['advertencias'] if aviso.startswith('No se leyó el código') and aviso in segunda['advertencias']]
    if conflictos:
        avisos.append('La lectura de algunas cifras cambió al mejorar el contraste. Comprueba los campos que quedaron vacíos.')
    return proponer(valores, candidatos, avisos)


def leer_foto(contenido, mesa=None, mesas=None):
    """Propone las cifras de `mesa`. Con `mesas`, primero identifica a cuál de ellas corresponde la foto."""
    if not TURNOS.acquire(blocking=False):
        raise HTTPException(429, 'Hay otras fotografías en lectura. Reintenta en unos momentos.')
    try:
        with tempfile.TemporaryDirectory(prefix='tuvoto-lectura-') as carpeta:
            ruta = Path(carpeta) / 'imagen.png'
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter('error', Image.DecompressionBombWarning)
                    with Image.open(io.BytesIO(contenido)) as original:
                        if original.format not in ('PNG', 'JPEG'):
                            raise ValueError('Usa una fotografía JPEG o PNG.')
                        # Solo se prepara una copia temporal. El original se conserva al registrar.
                        imagen = ImageOps.exif_transpose(original).convert('L')
                        imagen.thumbnail((3500, 3500))
                        imagen = ImageOps.autocontrast(imagen)
                        imagen.save(ruta)
            except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
                raise ValueError('La imagen no se puede leer o supera 24 megapíxeles. Sube una foto JPEG o PNG más pequeña.') from None
            try:
                limite = time.monotonic() + 15
                ambiguos = set()
                lecturas = []
                def ocr():
                    resultado = subprocess.run(['tesseract', str(ruta), 'stdout', '-l', 'spa', '--psm', '6', 'tsv'],
                        capture_output=True, text=True, timeout=max(0.01, limite - time.monotonic()), check=True,
                        env={**os.environ, 'OMP_THREAD_LIMIT': '1'})
                    lecturas.append(resultado.stdout)
                    return resultado.stdout
                def contrastar():
                    # Una segunda copia atenúa la cuadrícula clara del formato impreso.
                    # No modifica el original ni aproxima nombres/cifras; los desacuerdos quedan vacíos.
                    imagen.point(lambda valor: 255 if valor > 85 else 0).save(ruta)
                    return ocr()
                ocr()
                detectada = mesas is not None
                if detectada:
                    destino = elegir_destino(lineas_ocr(lecturas[0]), mesas)
                    if not destino['mesa']:
                        contrastar()
                        destino = elegir_destino(lineas_ocr(lecturas[0]) + lineas_ocr(lecturas[1]), mesas)
                    if not destino['mesa']:
                        aviso = 'Hay más de un destino posible: elige la mesa y el cargo.' if destino['opciones'] else 'No se identificó la mesa ni el cargo: elígelos para continuar.'
                        return {'votos': [], 'blancos': None, 'nulos': None, 'total': None, 'completa': False, 'sumaCoincide': None,
                                'advertencias': [aviso], 'requiereRevision': True, 'motor': 'tesseract',
                                'idMesa': None, 'detectada': False, 'opciones': destino['opciones']}
                    mesa = destino['mesa']
                def interpretar_lectura(tsv, ambiguos_lectura=None):
                    try:
                        return interpretar(tsv, mesa['candidatos'], mesa['codigo'], ambiguos_lectura)
                    except ValueError:
                        # Con detección, el destino ya concuerda con alguna lectura del código; otra pasada difusa no decide.
                        if not detectada:
                            raise
                        return proponer({**{c['id']: None for c in mesa['candidatos']}, 'blancos': None, 'nulos': None, 'total': None}, mesa['candidatos'], [])
                destino_resumen = {'idMesa': mesa.get('id'), 'detectada': detectada, 'opciones': []}
                primera = interpretar_lectura(lecturas[0], ambiguos)
                if primera['completa']:
                    return {**primera, **destino_resumen}
                segunda = lecturas[1] if len(lecturas) > 1 else contrastar()
                return {**combinar_lecturas(primera, interpretar_lectura(segunda), mesa['candidatos'], ambiguos), **destino_resumen}
            except FileNotFoundError:
                raise HTTPException(503, 'El lector de fotografías no está instalado.') from None
            except subprocess.TimeoutExpired:
                raise HTTPException(504, 'La lectura tardó demasiado. Prueba con una fotografía más nítida.') from None
            except subprocess.CalledProcessError:
                raise HTTPException(422, 'No se pudo leer la fotografía. Revisa la iluminación y el enfoque.') from None
    finally:
        TURNOS.release()
