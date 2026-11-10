#!/bin/sh
set -eu

base="${SIGAPE_URL:-http://127.0.0.1:8080/api/v1}"
temporal="$(mktemp)"
trap 'rm -f "$temporal"' EXIT HUP INT TERM

solicitar() {
  req_metodo="$1"
  req_ruta="$2"
  req_esperado="$3"
  req_cuerpo="${4-}"
  if [ -n "$req_cuerpo" ]; then
    codigo="$(curl --silent --show-error --output "$temporal" --write-out '%{http_code}' -X "$req_metodo" -H 'Content-Type: application/json' -H 'X-Correlation-ID: prueba-p1' --data "$req_cuerpo" "$base$req_ruta")"
  else
    codigo="$(curl --silent --show-error --output "$temporal" --write-out '%{http_code}' -X "$req_metodo" -H 'X-Correlation-ID: prueba-p1' "$base$req_ruta")"
  fi
  if [ "$codigo" != "$req_esperado" ]; then
    printf 'Fallo %s %s: esperado %s, recibido %s\n' "$req_metodo" "$req_ruta" "$req_esperado" "$codigo" >&2
    cat "$temporal" >&2
    exit 1
  fi
}

crear_y_probar() {
  prueba_nombre="$1"
  prueba_coleccion="$2"
  prueba_recurso="$3"
  prueba_cuerpo="$4"
  prueba_filtro="$5"

  solicitar POST "/$prueba_coleccion" 201 "$prueba_cuerpo"
  prueba_id="$(jq -er ".$prueba_recurso" "$temporal")"
  solicitar GET "/$prueba_coleccion/$prueba_id" 200
  jq -e ".$prueba_recurso == \"$prueba_id\"" "$temporal" >/dev/null
  solicitar GET "/$prueba_coleccion?pagina=1&limite=1$prueba_filtro" 200
  jq -e '.pagina == 1 and .limite == 1 and .total >= 1 and (.elementos | length) == 1' "$temporal" >/dev/null
  solicitar PUT "/$prueba_coleccion/$prueba_id" 200 "$prueba_cuerpo"
  solicitar DELETE "/$prueba_coleccion/$prueba_id" 204
  solicitar GET "/$prueba_coleccion/$prueba_id" 404
  solicitar POST "/$prueba_coleccion" 422 '{"datoNoPermitido":true}'
  printf 'OK: CRUD, filtro, paginación y errores para %s\n' "$prueba_nombre"
}

crear_y_probar identidad identidades idIdentidad '{"nombre":"Identidad sintética P1","estado":"activa"}' '&estado=activa'
crear_y_probar elecciones elecciones idEleccion '{"nombre":"Elección sintética de prueba","estado":"borrador"}' '&estado=borrador'
crear_y_probar candidaturas candidaturas idCandidatura '{"idEleccion":"00000000-0000-4000-8000-000000000001","nombre":"Lista sintética P1","tipo":"lista","estado":"borrador"}' '&estado=borrador'
crear_y_probar padrón inscripciones idInscripcion '{"idEleccion":"00000000-0000-4000-8000-000000000001","elegible":true}' '&elegible=true'

solicitar GET '/identidades/no-es-uuid' 400
solicitar GET '/elecciones?pagina=0' 400

solicitar GET '/elecciones?pagina=1&limite=100&estado=en_curso&nombre=Elecci%C3%B3n%20de%20prueba%20de%20transici%C3%B3n' 200
id_transicion="$(jq -r '.elementos[0].idEleccion // empty' "$temporal")"
if [ -z "$id_transicion" ]; then
  solicitar POST '/elecciones' 201 '{"nombre":"Elección de prueba de transición","estado":"borrador"}'
  id_transicion="$(jq -er '.idEleccion' "$temporal")"
  solicitar PUT "/elecciones/$id_transicion" 200 '{"nombre":"Elección de prueba de transición","estado":"en_curso"}'
fi
solicitar PUT "/elecciones/$id_transicion" 409 '{"nombre":"Elección modificada fuera de borrador","estado":"en_curso"}'
solicitar DELETE "/elecciones/$id_transicion" 409
printf 'OK: validación 400 y bloqueo 409 de elecciones fuera de borrador\n'

printf 'Todas las pruebas de integración P1 pasaron.\n'