"""Lectura local de actas impresas. Las sugerencias nunca publican resultados."""
import csv
import io
import os
import re
import subprocess
import tempfile
import threading
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


def interpretar(tsv, candidatos, codigo):
    lineas = {}
    for palabra in csv.DictReader(io.StringIO(tsv), delimiter='\t', quoting=csv.QUOTE_NONE):
        if palabra.get('level') != '5' or not palabra.get('text', '').strip():
            continue
        clave = tuple(palabra[k] for k in ('page_num', 'block_num', 'par_num', 'line_num'))
        lineas.setdefault(clave, []).append((palabra['text'], float(palabra['conf'])))
    filas = [(' '.join(p[0] for p in palabras), min(p[1] for p in palabras)) for palabras in lineas.values()]
    etiquetas = [(c['id'], normalizar(c['nombre'])) for c in candidatos]
    etiquetas += [('blancos', 'blancos'), ('nulos', 'nulos'), ('total', 'total')]
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
        coincidencia = re.fullmatch(r'(.+?)\s*[:|]?\s+(\d{1,7})\s*', texto.strip())
        if not coincidencia:
            continue
        nombre, numero = normalizar(coincidencia[1]), int(coincidencia[2])
        destinos = [clave for clave, etiqueta in etiquetas if nombre == etiqueta]
        if len(destinos) == 1:
            valores[destinos[0]].append(numero if confianza >= 70 and numero <= 1000000 else None)
    # Filas repetidas son ambiguas, incluso si coinciden sus cifras.
    unicos = {k: vs[0] if len(vs) == 1 else None for k, vs in valores.items()}
    completa = all(v is not None for v in unicos.values()) and bool(candidatos)
    if not mesa_leida:
        avisos.append('No se leyó el código de mesa. Comprueba que la fotografía corresponda a la mesa seleccionada.')
    if not completa:
        avisos.append('Completa los campos vacíos: no se leyeron con suficiente claridad o había filas repetidas.')
    coincide = (sum(unicos[c['id']] for c in candidatos) + unicos['blancos'] + unicos['nulos'] == unicos['total']) if completa else None
    if coincide is False:
        avisos.append('La suma leída no coincide con el total. Compara todos los números con la foto.')
    return {'votos': [{'idCandidato': c['id'], 'cantidad': unicos[c['id']]} for c in candidatos],
            'blancos': unicos['blancos'], 'nulos': unicos['nulos'], 'total': unicos['total'],
            'completa': completa, 'sumaCoincide': coincide, 'advertencias': avisos,
            'requiereRevision': True, 'motor': 'tesseract'}


def leer_foto(contenido, mesa):
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
                        ImageOps.autocontrast(imagen).save(ruta)
            except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
                raise ValueError('La imagen no se puede leer o supera 24 megapíxeles. Sube una foto JPEG o PNG más pequeña.') from None
            try:
                resultado = subprocess.run(['tesseract', str(ruta), 'stdout', '-l', 'spa', '--psm', '6', 'tsv'],
                    capture_output=True, text=True, timeout=15, check=True,
                    env={**os.environ, 'OMP_THREAD_LIMIT': '1'})
            except FileNotFoundError:
                raise HTTPException(503, 'El lector de fotografías no está instalado.') from None
            except subprocess.TimeoutExpired:
                raise HTTPException(504, 'La lectura tardó demasiado. Prueba con una fotografía más nítida.') from None
            except subprocess.CalledProcessError:
                raise HTTPException(422, 'No se pudo leer la fotografía. Revisa la iluminación y el enfoque.') from None
            return interpretar(resultado.stdout, mesa['candidatos'], mesa['codigo'])
    finally:
        TURNOS.release()
