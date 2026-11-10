#!/bin/sh
set -eu

: "${IDENTIDAD_DB_USUARIO:?Falta IDENTIDAD_DB_USUARIO}"
: "${IDENTIDAD_DB_CLAVE:?Falta IDENTIDAD_DB_CLAVE}"
: "${ELECCIONES_DB_USUARIO:?Falta ELECCIONES_DB_USUARIO}"
: "${ELECCIONES_DB_CLAVE:?Falta ELECCIONES_DB_CLAVE}"
: "${PADRON_ELECTORAL_DB_USUARIO:?Falta PADRON_ELECTORAL_DB_USUARIO}"
: "${PADRON_ELECTORAL_DB_CLAVE:?Falta PADRON_ELECTORAL_DB_CLAVE}"
: "${VOTACION_DB_USUARIO:?Falta VOTACION_DB_USUARIO}"
: "${VOTACION_DB_CLAVE:?Falta VOTACION_DB_CLAVE}"

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 \
  --set=identidad_db="$IDENTIDAD_DB" \
  --set=identidad_usuario="$IDENTIDAD_DB_USUARIO" \
  --set=identidad_clave="$IDENTIDAD_DB_CLAVE" \
  --set=elecciones_db="$ELECCIONES_DB" \
  --set=elecciones_usuario="$ELECCIONES_DB_USUARIO" \
  --set=elecciones_clave="$ELECCIONES_DB_CLAVE" \
  --set=padron_db="$PADRON_ELECTORAL_DB" \
  --set=padron_usuario="$PADRON_ELECTORAL_DB_USUARIO" \
  --set=padron_clave="$PADRON_ELECTORAL_DB_CLAVE" \
  --set=votacion_db="$VOTACION_DB" \
  --set=votacion_usuario="$VOTACION_DB_USUARIO" \
  --set=votacion_clave="$VOTACION_DB_CLAVE" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'identidad_usuario', :'identidad_clave') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'identidad_db', :'identidad_usuario') \gexec
SELECT format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', :'identidad_db') \gexec
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'elecciones_usuario', :'elecciones_clave') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'elecciones_db', :'elecciones_usuario') \gexec
SELECT format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', :'elecciones_db') \gexec
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'padron_usuario', :'padron_clave') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'padron_db', :'padron_usuario') \gexec
SELECT format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', :'padron_db') \gexec
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'votacion_usuario', :'votacion_clave') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'votacion_db', :'votacion_usuario') \gexec
SELECT format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', :'votacion_db') \gexec
SQL