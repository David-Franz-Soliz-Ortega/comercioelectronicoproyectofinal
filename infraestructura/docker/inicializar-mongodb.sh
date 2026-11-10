#!/bin/bash
set -euo pipefail

validar_identificador() {
  local nombre="$1"
  local valor="$2"
  if [[ ! "$valor" =~ ^[A-Za-z0-9_-]+$ ]]; then
    printf 'La variable %s solo puede contener letras, números, guion y guion bajo.\n' "$nombre" >&2
    exit 1
  fi
}

validar_identificador CANDIDATURAS_DB "${CANDIDATURAS_DB:?Falta CANDIDATURAS_DB}"
validar_identificador CANDIDATURAS_DB_USUARIO "${CANDIDATURAS_DB_USUARIO:?Falta CANDIDATURAS_DB_USUARIO}"
validar_identificador RESULTADOS_DB "${RESULTADOS_DB:?Falta RESULTADOS_DB}"
validar_identificador RESULTADOS_DB_USUARIO "${RESULTADOS_DB_USUARIO:?Falta RESULTADOS_DB_USUARIO}"

CANDIDATURAS_DB_CLAVE_CODIFICADA="$(printf '%s' "${CANDIDATURAS_DB_CLAVE:?Falta CANDIDATURAS_DB_CLAVE}" | base64 | tr -d '\n')"
RESULTADOS_DB_CLAVE_CODIFICADA="$(printf '%s' "${RESULTADOS_DB_CLAVE:?Falta RESULTADOS_DB_CLAVE}" | base64 | tr -d '\n')"

mongosh --quiet \
  --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin <<MONGOSH
db.getSiblingDB("$CANDIDATURAS_DB").createUser({
  user: "$CANDIDATURAS_DB_USUARIO",
  pwd: Buffer.from("$CANDIDATURAS_DB_CLAVE_CODIFICADA", "base64").toString("utf8"),
  roles: [{ role: "readWrite", db: "$CANDIDATURAS_DB" }]
});
db.getSiblingDB("$RESULTADOS_DB").createUser({
  user: "$RESULTADOS_DB_USUARIO",
  pwd: Buffer.from("$RESULTADOS_DB_CLAVE_CODIFICADA", "base64").toString("utf8"),
  roles: [{ role: "readWrite", db: "$RESULTADOS_DB" }]
});
MONGOSH