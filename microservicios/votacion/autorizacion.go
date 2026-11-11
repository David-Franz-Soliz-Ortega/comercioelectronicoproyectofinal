package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type claveContexto struct{}
type contextoAutorizacion struct {
	IdOrganizacion string `json:"idOrganizacion"`
}

func cabecerasSesion(origen *http.Request, destino *http.Request) {
	for _, nombre := range []string{"Cookie", "Origin", "X-CSRF-Token", "X-Organizacion"} {
		destino.Header.Set(nombre, origen.Header.Get(nombre))
	}
}
func (s *Servicio) conSesion(siguiente http.HandlerFunc, accion string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Cookie"), "sigape-sesion=") {
			problema(w, r, 401, "Sesión requerida")
			return
		}
		cuerpo, _ := json.Marshal(map[string]any{"accion": accion, "idOrganizacion": r.Header.Get("X-Organizacion"), "escritura": r.Method != "GET"})
		req, err := http.NewRequestWithContext(r.Context(), "POST", variable("IDENTIDAD_URL", "http://identidad:3000")+"/api/v1/interno/autorizar", bytes.NewReader(cuerpo))
		if err != nil {
			problema(w, r, 503, "Identidad no disponible")
			return
		}
		cabecerasSesion(r, req)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Servicio", "votacion")
		req.Header.Set("X-Clave-Servicio", variable("CLAVE_SERVICIO", ""))
		cliente := http.Client{Timeout: 3 * time.Second}
		respuesta, err := cliente.Do(req)
		if err != nil {
			problema(w, r, 503, "Identidad no disponible")
			return
		}
		defer respuesta.Body.Close()
		if respuesta.StatusCode != 200 {
			codigo := respuesta.StatusCode
			if codigo != 401 && codigo != 403 {
				codigo = 503
			}
			problema(w, r, codigo, "Acceso no autorizado")
			return
		}
		var contexto contextoAutorizacion
		if json.NewDecoder(respuesta.Body).Decode(&contexto) != nil || !validarUUID(contexto.IdOrganizacion) {
			problema(w, r, 503, "Respuesta de identidad inválida")
			return
		}
		if r.Method == "GET" && validarUUID(r.PathValue("id")) {
			var organizacion *string
			err = s.base.QueryRowContext(r.Context(), "SELECT id_organizacion::text FROM registros_votacion WHERE id_evento=$1", r.PathValue("id")).Scan(&organizacion)
			if err == nil && (organizacion == nil || *organizacion != contexto.IdOrganizacion) {
				problema(w, r, 403, "Organización no permitida")
				return
			}
		}
		siguiente(w, r.WithContext(context.WithValue(r.Context(), claveContexto{}, contexto)))
	}
}
func verificarEleccion(r *http.Request, id string) int {
	req, err := http.NewRequestWithContext(r.Context(), "GET", variable("ELECCIONES_URL", "http://elecciones:3000")+"/api/v1/elecciones/"+id, nil)
	if err != nil {
		return 503
	}
	cabecerasSesion(r, req)
	cliente := http.Client{Timeout: 3 * time.Second}
	respuesta, err := cliente.Do(req)
	if err != nil {
		return 503
	}
	defer respuesta.Body.Close()
	if respuesta.StatusCode != 200 {
		if respuesta.StatusCode == 403 || respuesta.StatusCode == 404 {
			return respuesta.StatusCode
		}
		return 503
	}
	var eleccion struct {
		Estado string `json:"estado"`
	}
	if json.NewDecoder(respuesta.Body).Decode(&eleccion) != nil {
		return 503
	}
	if eleccion.Estado != "en_curso" {
		return 409
	}
	return 200
}
