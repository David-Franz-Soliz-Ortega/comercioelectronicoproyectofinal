"""Carga privada temporal de una foto en partes reintentables."""
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, StrictInt

TAMANO_PARTE = 131072
MAXIMO_FOTO = 14000000

ESQUEMA_CARGAS = """
CREATE TABLE IF NOT EXISTS partes_foto (
    organizacion uuid NOT NULL, operador uuid NOT NULL, carga uuid NOT NULL,
    indice integer NOT NULL, longitud integer NOT NULL, contenido text NOT NULL,
    creada timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (organizacion, operador, carga, indice)
);
CREATE INDEX IF NOT EXISTS partes_foto_creada ON partes_foto(creada);
"""

class ParteFoto(BaseModel):
    model_config = ConfigDict(extra='forbid')
    indice: StrictInt = Field(ge=0)
    longitud: StrictInt = Field(gt=0, le=MAXIMO_FOTO)
    contenido: str = Field(min_length=1, max_length=TAMANO_PARTE)


def guardar_parte(db, actor, carga, parte):
    esperado = min(TAMANO_PARTE, parte.longitud - parte.indice * TAMANO_PARTE)
    if len(parte.contenido) != esperado or not parte.contenido.isascii() or '\x00' in parte.contenido:
        raise HTTPException(422, 'Tamaño o contenido de la parte inválido.')
    clave = (actor['idOrganizacion'], actor['idUsuario'], carga)
    db.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,3))', (actor['idUsuario'],))
    previa = db.execute('SELECT longitud,contenido FROM partes_foto WHERE organizacion=%s AND operador=%s AND carga=%s AND indice=%s',
                        (*clave, parte.indice)).fetchone()
    if previa:
        if previa['longitud'] != parte.longitud or previa['contenido'] != parte.contenido:
            raise HTTPException(409, 'Esta parte ya contiene otros datos.')
        return
    cantidad = db.execute('SELECT count(*) AS n FROM partes_foto WHERE organizacion=%s AND operador=%s', clave[:2]).fetchone()['n']
    if cantidad >= 1024:
        raise HTTPException(429, 'Hay demasiadas fotos temporales. Espera a que caduquen.')
    db.execute('INSERT INTO partes_foto (organizacion,operador,carga,indice,longitud,contenido) VALUES (%s,%s,%s,%s,%s,%s)',
               (*clave, parte.indice, parte.longitud, parte.contenido))


def recuperar_foto(db, actor, carga):
    filas = db.execute("""SELECT indice,longitud,contenido FROM partes_foto
        WHERE organizacion=%s AND operador=%s AND carga=%s AND creada > now() - interval '1 hour'
        ORDER BY indice""", (actor['idOrganizacion'], actor['idUsuario'], carga)).fetchall()
    if not filas:
        raise HTTPException(409, 'La carga caducó o está incompleta. Vuelve a subir la foto.')
    longitud = filas[0]['longitud']
    if (len(filas) != (longitud + TAMANO_PARTE - 1) // TAMANO_PARTE or
            any(f['indice'] != i or f['longitud'] != longitud for i, f in enumerate(filas))):
        raise HTTPException(409, 'Faltan partes de la fotografía.')
    return ''.join(f['contenido'] for f in filas)
