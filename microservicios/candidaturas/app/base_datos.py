"""Conexión a MongoDB. Se comparte entre el servidor y la carga de ejemplos."""
import os

from pymongo import MongoClient

cliente = MongoClient(
    host=os.environ.get("MONGODB_HOST", "base-mongodb"),
    port=int(os.environ.get("MONGODB_PORT", "27017")),
    username=os.environ.get("MONGODB_USERNAME"),
    password=os.environ.get("MONGODB_PASSWORD"),
    authSource=os.environ.get("MONGODB_AUTH_SOURCE", "admin"),
    maxPoolSize=5,  # Pocas conexiones para la demostración.
    serverSelectionTimeoutMS=2000,
    connectTimeoutMS=2000,
    socketTimeoutMS=3000,
    waitQueueTimeoutMS=2000,
    maxIdleTimeMS=10000,
    tz_aware=True,
)

base = cliente[os.environ.get("MONGODB_DATABASE", "candidaturas_db")]
coleccion = base["candidaturas"]
