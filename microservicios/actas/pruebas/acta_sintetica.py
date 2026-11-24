"""Documento impreso para probar OCR, sin personas ni resultados electorales reales."""
import io
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def crear_acta(primera=120, segunda=80, codigo='PRUEBA-01'):
    imagen = Image.new('RGB', (1600, 1800), 'white')
    dibujo = ImageDraw.Draw(imagen)
    fuente = next(str(p) for p in (Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'), Path('/usr/share/fonts/TTF/DejaVuSans.ttf')) if p.exists())
    titulo = ImageFont.truetype(fuente, 48)
    texto = ImageFont.truetype(fuente, 36)
    dibujo.text((100, 100), 'ACTA DE PRUEBA - SIN VALIDEZ', font=titulo, fill='black')
    filas = ['Documento sintetico para verificar lectura automatica',
             f'Mesa: {codigo}', 'Cargo: Rectorado de demostracion',
             f'Candidatura Alfa: {primera}', f'Candidatura Beta: {segunda}',
             'Blancos: 3', 'Nulos: 2', f'Total: {primera + segunda + 5}',
             'No corresponde a una eleccion real.',
             'No publicar este ejemplo como resultado electoral.']
    for i, fila in enumerate(filas):
        dibujo.text((100, 250 + i * 115), fila, font=texto, fill='black')
    salida = io.BytesIO()
    imagen.save(salida, format='PNG')
    return salida.getvalue()


if __name__ == '__main__':
    import sys
    sys.stdout.buffer.write(crear_acta())
