"""Genera secretos locales distintos sin sobrescribir configuraciones existentes."""
from pathlib import Path
from secrets import token_hex

microservicios = Path(__file__).resolve().parents[2]
for nombre in ("padron-electoral", "candidaturas"):
    carpeta = microservicios / nombre
    destino = carpeta / ".env"
    contenido = "\n".join(
        linea.replace("CAMBIAR_CLAVE", token_hex(24))
        for linea in (carpeta / ".env.example").read_text().splitlines()
    ) + "\n"
    try:
        # La creación exclusiva conserva cualquier .env que el usuario ya tenga.
        with destino.open("x", encoding="utf-8") as archivo:
            destino.chmod(0o600)
            archivo.write(contenido)
        print(f"{nombre}: .env creado con permisos 600.")
    except FileExistsError:
        print(f"{nombre}: se conserva el .env existente.")
