#!/bin/bash
set -euo pipefail
# Las claves se leen dentro de mongosh, nunca aparecen en argumentos ni scripts expandidos.
mongosh --quiet --eval '
const usuario = encodeURIComponent(process.env.MONGO_INITDB_ROOT_USERNAME);
const clave = encodeURIComponent(process.env.MONGO_INITDB_ROOT_PASSWORD);
const conexion = new Mongo("mongodb://"+usuario+":"+clave+"@127.0.0.1:27017/admin");
conexion.getDB("resultados_db").createUser({user:"resultados_app",pwd:process.env.RESULTADOS_DB_CLAVE,roles:[{role:"readWrite",db:"resultados_db"}]});
'
