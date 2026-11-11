"""Práctica 3: un script separado para cargar datos de ejemplo."""
from datetime import datetime, timezone
from pymongo.errors import PyMongoError
from app.base_datos import cliente, coleccion

candidaturas = [
    {"_id": "20000000-0000-4000-8000-000000000021",
     "nombre": "Candidatura sintética de ejemplo", "tipo": "individual"},
    {"_id": "20000000-0000-4000-8000-000000000022",
     "nombre": "Lista sintética de ejemplo", "tipo": "lista"},
]


def cargar_datos():
    for candidatura in candidaturas:
        candidatura["idEleccion"] = "20000000-0000-4000-8000-000000000001"
        candidatura["estado"] = "borrador"
        candidatura["creadoEn"] = datetime.now(timezone.utc)
        candidatura["actualizadoEn"] = candidatura["creadoEn"]
        # Solo inserta si el ID no existe; repetir el script conserva los datos.
        coleccion.update_one(
            {"_id": candidatura["_id"]},
            {"$setOnInsert": candidatura},
            upsert=True,
        )
    print("Listo: las dos candidaturas de ejemplo están guardadas.")


if __name__ == "__main__":
    try:
        cargar_datos()
    except PyMongoError:
        raise SystemExit("No se pudieron cargar los datos. Revisa MongoDB.")
    finally:
        cliente.close()
