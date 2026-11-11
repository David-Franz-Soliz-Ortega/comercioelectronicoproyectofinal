#!/bin/sh
set -eu
psql --username "$POSTGRES_USER" --dbname postgres --set ON_ERROR_STOP=1 \
  --set app_usuario="$DB_USER" --set app_clave="$DB_PASSWORD" --set app_base="$DB_NAME" <<'SQL'
CREATE USER :"app_usuario" WITH PASSWORD :'app_clave';
CREATE DATABASE :"app_base" OWNER :"app_usuario";
REVOKE ALL ON DATABASE :"app_base" FROM PUBLIC;
SQL
