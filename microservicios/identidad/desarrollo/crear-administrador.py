"""Crea la primera cuenta global mediante la CLI de Identidad y entrada privada."""
import getpass
import json
from pathlib import Path
import re
import subprocess
import sys

RAIZ = Path(__file__).resolve().parents[3]


def crear():
    if not sys.stdin.isatty():
        raise RuntimeError('Ejecuta este asistente en tu terminal. La contraseña se solicita sin mostrarla.')
    if not (RAIZ / '.env.tuvoto').is_file():
        raise RuntimeError('Inicia primero TUVOTO con python3 infraestructura/tuvoto/iniciar-local.py.')
    print('Primera cuenta de administración de TUVOTO. No reemplaza administradores existentes.')
    usuario = input('Usuario (3–80 letras minúsculas, números, punto, guion o guion bajo): ').strip().lower()
    if not re.fullmatch(r'[a-z0-9._-]{3,80}', usuario):
        raise RuntimeError('El nombre de usuario no tiene el formato indicado.')
    contrasena = getpass.getpass('Contraseña (mínimo 12 caracteres, máximo 72 bytes): ')
    if len(contrasena) < 12 or len(contrasena.encode()) > 72:
        raise RuntimeError('La contraseña debe tener al menos 12 caracteres y como máximo 72 bytes UTF-8.')
    if getpass.getpass('Repite la contraseña: ') != contrasena:
        raise RuntimeError('Las contraseñas no coinciden; no se creó ninguna cuenta.')
    # La clave viaja por stdin al proceso; nunca por argumentos, archivos ni registros.
    resultado = subprocess.run(
        ['docker', 'compose', '--env-file', '.env.tuvoto', '-p', 'tuvoto', 'exec', '-T', 'identidad', 'node', 'dist/administrar.js'],
        cwd=RAIZ, input=json.dumps({'usuario': usuario, 'contrasena': contrasena}), text=True, capture_output=True,
    )
    if resultado.returncode:
        raise RuntimeError('No se pudo crear la cuenta. Comprueba que Identidad esté iniciado y que todavía no exista un administrador global.')
    print('Cuenta creada. Abre TUVOTO y selecciona «Acceso al personal» para configurar tu organización y elección.')


if __name__ == '__main__':
    try:
        crear()
    except (RuntimeError, OSError, EOFError, KeyboardInterrupt) as error:
        print(f'No se completó la creación: {error}', file=sys.stderr)
        sys.exit(1)
