#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<'SQL'
\getenv identidad_usuario IDENTIDAD_DB_USUARIO
\getenv identidad_clave IDENTIDAD_DB_CLAVE
\getenv elecciones_usuario ELECCIONES_DB_USUARIO
\getenv elecciones_clave ELECCIONES_DB_CLAVE
\getenv actas_usuario ACTAS_DB_USUARIO
\getenv actas_clave ACTAS_DB_CLAVE
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'identidad_usuario', :'identidad_clave') \gexec
SELECT format('CREATE DATABASE identidad_db OWNER %I', :'identidad_usuario') \gexec
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'elecciones_usuario', :'elecciones_clave') \gexec
SELECT format('CREATE DATABASE elecciones_db OWNER %I', :'elecciones_usuario') \gexec
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'actas_usuario', :'actas_clave') \gexec
SELECT format('CREATE DATABASE actas_db OWNER %I', :'actas_usuario') \gexec
REVOKE CONNECT ON DATABASE identidad_db, elecciones_db, actas_db FROM PUBLIC;
SQL
