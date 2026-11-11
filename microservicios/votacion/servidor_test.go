package main

import (
	"encoding/json"
	"github.com/google/uuid"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAccesoAnonimoSiempreRechazado(t *testing.T) {
	servicio := &Servicio{}
	for _, caso := range []struct{ clave, cuerpo string }{
		{"", `{"idEleccion":"` + uuid.NewString() + `"}`},
		{uuid.NewString(), `{"idEleccion":"inválido"}`},
		{uuid.NewString(), `{"idEleccion":"` + uuid.NewString() + `","identidad":"prohibida"}`},
		{uuid.NewString(), `{"idEleccion":"` + uuid.NewString() + `"} {}`},
	} {
		solicitud := httptest.NewRequest("POST", "/api/v1/votos", strings.NewReader(caso.cuerpo))
		solicitud.Header.Set("Idempotency-Key", caso.clave)
		respuesta := httptest.NewRecorder()
		servicio.rutas().ServeHTTP(respuesta, solicitud)
		if respuesta.Code != 401 {
			t.Fatalf("Estado inesperado: %d", respuesta.Code)
		}
		var problema map[string]any
		if err := json.Unmarshal(respuesta.Body.Bytes(), &problema); err != nil || problema["idCorrelacion"] == "" {
			t.Fatal("Falta problema correlacionado")
		}
	}
}
