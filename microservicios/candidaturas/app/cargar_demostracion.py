"""Carga pequeña y repetible; solo escribe en la colección propia de candidaturas."""
from datetime import datetime, timezone

from pymongo.errors import PyMongoError

from app.servidor import cliente, coleccion


def cargar():
    ahora = datetime.now(timezone.utc)
    nuevas = 0
    for identificador, nombre, tipo in (
        ("20000000-0000-4000-8000-000000000021", "Candidatura sintética de ejemplo", "individual"),
        ("20000000-0000-4000-8000-000000000022", "Lista sintética de ejemplo", "lista"),
    ):
        resultado = coleccion.update_one(
            {"_id": identificador},
            {"$setOnInsert": {
                "idEleccion": "20000000-0000-4000-8000-000000000001",
                "nombre": nombre, "tipo": tipo, "estado": "borrador",
                "creadoEn": ahora, "actualizadoEn": ahora,
            }},
            upsert=True,
        )
        nuevas += int(resultado.upserted_id is not None)
    print(f"Demostración sintética de candidaturas preparada. Nuevas: {nuevas}.")


if __name__ == "__main__":
    try:
        cargar()
    except PyMongoError:
        raise SystemExit("No se pudo cargar la demostración. Revisa la conexión a MongoDB.")
    finally:
        cliente.close()
