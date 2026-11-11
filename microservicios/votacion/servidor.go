package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/redis/go-redis/v9"
)

type Datos struct {
	IdEleccion string `json:"idEleccion"`
}
type Evento struct {
	IdEvento  string `json:"idEvento"`
	Tipo      string `json:"tipo"`
	Version   int    `json:"version"`
	Timestamp string `json:"timestamp"`
	Datos     Datos  `json:"datos"`
}
type Servicio struct {
	base       *sql.DB
	cache      *redis.Client
	mensajeria atomic.Bool
}

func variable(nombre, defecto string) string {
	if valor := os.Getenv(nombre); valor != "" {
		return valor
	}
	return defecto
}
func direccionRabbit() string {
	direccion := &url.URL{Scheme: "amqp", Host: net.JoinHostPort(variable("RABBITMQ_HOST", "mensajeria-rabbitmq"), "5672"), Path: "/", User: url.UserPassword(os.Getenv("RABBITMQ_USUARIO"), os.Getenv("RABBITMQ_CLAVE"))}
	return direccion.String()
}
func declarar(canal *amqp.Channel) error {
	if err := canal.ExchangeDeclare("sigape.eventos", "topic", true, false, false, false, nil); err != nil {
		return err
	}
	if err := canal.ExchangeDeclare("sigape.dlq", "direct", true, false, false, false, nil); err != nil {
		return err
	}
	for _, nombre := range []string{"resultados.conteo.v1", "resultados.auditoria.v1"} {
		if _, err := canal.QueueDeclare(nombre+".dlq", true, false, false, false, amqp.Table{"x-queue-type": "quorum"}); err != nil {
			return err
		}
		if err := canal.QueueBind(nombre+".dlq", nombre, "sigape.dlq", false, nil); err != nil {
			return err
		}
		argumentos := amqp.Table{"x-queue-type": "quorum", "x-dead-letter-exchange": "sigape.dlq", "x-dead-letter-routing-key": nombre, "x-dead-letter-strategy": "at-least-once", "x-overflow": "reject-publish", "x-delivery-limit": int32(5)}
		if _, err := canal.QueueDeclare(nombre, true, false, false, false, argumentos); err != nil {
			return err
		}
		if err := canal.QueueBind(nombre, "voto.registrado.v1", "sigape.eventos", false, nil); err != nil {
			return err
		}
	}
	return nil
}

// La misma fila guarda registro y publicación pendiente: no existe una escritura dual.
const esquema = `CREATE TABLE IF NOT EXISTS registros_votacion (
 id_evento UUID PRIMARY KEY, id_solicitud UUID NOT NULL UNIQUE,
 id_eleccion UUID NOT NULL, evento JSONB NOT NULL,
 creado_en TIMESTAMPTZ NOT NULL DEFAULT now(), publicado_en TIMESTAMPTZ
); ALTER TABLE registros_votacion ADD COLUMN IF NOT EXISTS id_organizacion UUID; CREATE INDEX IF NOT EXISTS registros_organizacion ON registros_votacion(id_organizacion); CREATE INDEX IF NOT EXISTS registros_pendientes ON registros_votacion(creado_en) WHERE publicado_en IS NULL;`

func (s *Servicio) publicar(ctx context.Context) {
	for ctx.Err() == nil {
		s.mensajeria.Store(false)
		if err := s.sesionPublicador(ctx); err != nil && ctx.Err() == nil {
			log.Print("Publicación pendiente; se reintentará la conexión")
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(2 * time.Second):
		}
	}
}
func (s *Servicio) sesionPublicador(ctx context.Context) error {
	conexion, err := amqp.DialConfig(direccionRabbit(), amqp.Config{Heartbeat: 10 * time.Second, Dial: amqp.DefaultDial(5 * time.Second)})
	if err != nil {
		return err
	}
	defer conexion.Close()
	canal, err := conexion.Channel()
	if err != nil {
		return err
	}
	defer canal.Close()
	if err = declarar(canal); err != nil {
		return err
	}
	if err = canal.Confirm(false); err != nil {
		return err
	}
	confirmaciones := canal.NotifyPublish(make(chan amqp.Confirmation, 1))
	devoluciones := canal.NotifyReturn(make(chan amqp.Return, 1))
	cierre := canal.NotifyClose(make(chan *amqp.Error, 1))
	s.mensajeria.Store(true)
	defer s.mensajeria.Store(false)
	for ctx.Err() == nil {
		err = s.publicarPendiente(ctx, canal, confirmaciones, devoluciones)
		if err != nil {
			return err
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-cierre:
			return errors.New("canal cerrado")
		case <-time.After(200 * time.Millisecond):
		}
	}
	return ctx.Err()
}
func (s *Servicio) publicarPendiente(ctx context.Context, canal *amqp.Channel, confirmaciones <-chan amqp.Confirmation, devoluciones <-chan amqp.Return) error {
	limite, cancelar := context.WithTimeout(ctx, 10*time.Second)
	defer cancelar()
	transaccion, err := s.base.BeginTx(limite, nil)
	if err != nil {
		return err
	}
	defer transaccion.Rollback()
	var id string
	var cuerpo []byte
	err = transaccion.QueryRowContext(limite, `SELECT id_evento,evento FROM registros_votacion WHERE publicado_en IS NULL ORDER BY creado_en FOR UPDATE SKIP LOCKED LIMIT 1`).Scan(&id, &cuerpo)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if err = canal.PublishWithContext(limite, "sigape.eventos", "voto.registrado.v1", true, false, amqp.Publishing{ContentType: "application/json", DeliveryMode: amqp.Persistent, MessageId: id, Type: "voto.registrado.v1", Body: cuerpo}); err != nil {
		return err
	}
	select {
	case <-limite.Done():
		return limite.Err()
	case <-devoluciones:
		return errors.New("evento sin ruta")
	case confirmacion, abierto := <-confirmaciones:
		if !abierto || !confirmacion.Ack {
			return errors.New("publicación no confirmada")
		}
		select {
		case <-devoluciones:
			return errors.New("evento devuelto")
		default:
		}
	}
	_, err = transaccion.ExecContext(limite, `UPDATE registros_votacion SET publicado_en=now() WHERE id_evento=$1`, id)
	if err != nil {
		return err
	}
	return transaccion.Commit()
}
func responder(w http.ResponseWriter, codigo int, cuerpo any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(codigo)
	_ = json.NewEncoder(w).Encode(cuerpo)
}
func problema(w http.ResponseWriter, r *http.Request, codigo int, detalle string) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(codigo)
	_ = json.NewEncoder(w).Encode(map[string]any{"type": "about:blank", "title": http.StatusText(codigo), "status": codigo, "detail": detalle, "instance": r.URL.Path, "idCorrelacion": w.Header().Get("X-Correlation-ID")})
}
func validarUUID(valor string) bool {
	id, err := uuid.Parse(valor)
	return err == nil && id.String() == valor
}
func (s *Servicio) registrar(w http.ResponseWriter, r *http.Request) {
	idSolicitud := r.Header.Get("Idempotency-Key")
	if !validarUUID(idSolicitud) {
		problema(w, r, 400, "Idempotency-Key debe ser un UUID canónico")
		return
	}
	var datos Datos
	decodificador := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decodificador.DisallowUnknownFields()
	if err := decodificador.Decode(&datos); err != nil {
		problema(w, r, 400, "Cuerpo JSON inválido")
		return
	}
	if err := decodificador.Decode(new(any)); err != io.EOF || !validarUUID(datos.IdEleccion) {
		problema(w, r, 400, "Se requiere únicamente idEleccion UUID")
		return
	}
	if codigo:=verificarEleccion(r,datos.IdEleccion);codigo!=200{problema(w,r,codigo,"Elección no habilitada o fuera de organización");return}
	autorizacion,ok:=r.Context().Value(claveContexto{}).(contextoAutorizacion);if !ok{problema(w,r,401,"Sesión requerida");return}
	evento := Evento{uuid.NewString(), "voto.registrado.v1", 1, time.Now().UTC().Format(time.RFC3339Nano), datos}
	cuerpo, _ := json.Marshal(evento)
	ctx, cancelar := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancelar()
	resultado, err := s.base.ExecContext(ctx, `INSERT INTO registros_votacion(id_organizacion,id_evento,id_solicitud,id_eleccion,evento) VALUES($5,$1,$2,$3,$4) ON CONFLICT(id_solicitud) DO NOTHING`, evento.IdEvento, idSolicitud, datos.IdEleccion, string(cuerpo),autorizacion.IdOrganizacion)
	if err != nil {
		problema(w, r, 503, "Persistencia no disponible")
		return
	}
	filas, _ := resultado.RowsAffected()
	codigo := 201
	if filas == 0 {
		if err = s.base.QueryRowContext(ctx, `SELECT evento FROM registros_votacion WHERE id_solicitud=$1`, idSolicitud).Scan(&cuerpo); err != nil {
			problema(w, r, 503, "Persistencia no disponible")
			return
		}
		if err = json.Unmarshal(cuerpo, &evento); err != nil {
			problema(w, r, 500, "Registro inválido")
			return
		}
		if evento.Datos.IdEleccion != datos.IdEleccion {
			problema(w, r, 409, "La clave ya corresponde a otra elección")
			return
		}
		codigo = 200
	}
	w.Header().Set("Location", "/api/v1/votos/"+evento.IdEvento)
	responder(w, codigo, evento)
}
func (s *Servicio) consultar(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !validarUUID(id) {
		problema(w, r, 400, "Identificador inválido")
		return
	}
	ctx, cancelar := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancelar()
	cacheCtx, cancelarCache := context.WithTimeout(ctx, 300*time.Millisecond)
	cuerpo, err := s.cache.Get(cacheCtx, "votacion:evento:"+id).Bytes()
	cancelarCache()
	if err != nil {
		err = s.base.QueryRowContext(ctx, `SELECT evento FROM registros_votacion WHERE id_evento=$1`, id).Scan(&cuerpo)
		if errors.Is(err, sql.ErrNoRows) {
			problema(w, r, 404, "Registro inexistente")
			return
		}
		if err != nil {
			problema(w, r, 503, "Persistencia no disponible")
			return
		}
		cacheCtx, cancelarCache = context.WithTimeout(ctx, 300*time.Millisecond)
		_ = s.cache.Set(cacheCtx, "votacion:evento:"+id, cuerpo, time.Minute).Err()
		cancelarCache()
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(cuerpo)
}
func (s *Servicio) salud(w http.ResponseWriter, r *http.Request) {
	ctx, cancelar := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancelar()
	postgres := s.base.PingContext(ctx) == nil
	redisDisponible := s.cache.Ping(ctx).Err() == nil
	rabbit := s.mensajeria.Load()
	codigo := 200
	if !postgres || !redisDisponible || !rabbit {
		codigo = 503
	}
	responder(w, codigo, map[string]any{"servicio": "votacion", "postgresql": postgres, "redis": redisDisponible, "rabbitmq": rabbit})
}
func (s *Servicio) rutas() http.Handler {
	rutas := http.NewServeMux()
	rutas.HandleFunc("POST /api/v1/votos", s.conSesion(s.registrar,"votos:crear"))
	rutas.HandleFunc("GET /api/v1/votos/{id}", s.conSesion(s.consultar,"votos:leer"))
	rutas.HandleFunc("GET /api/v1/salud", s.salud)
	rutas.HandleFunc("GET /openapi.yaml", func(w http.ResponseWriter, r *http.Request) { http.ServeFile(w, r, "/app/contrato.yaml") })
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		correlacion := r.Header.Get("X-Correlation-ID")
		if correlacion == "" {
			correlacion = uuid.NewString()
		}
		w.Header().Set("X-Correlation-ID", correlacion)
		rutas.ServeHTTP(w, r)
	})
}
func main() {
	if len(os.Args) > 1 && os.Args[1] == "salud" {
		cliente := http.Client{Timeout: 3 * time.Second}
		respuesta, err := cliente.Get("http://127.0.0.1:8080/api/v1/salud")
		if err != nil {
			os.Exit(1)
		}
		defer respuesta.Body.Close()
		if respuesta.StatusCode != 200 {
			os.Exit(1)
		}
		return
	}
	ctx, detener := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer detener()
	direccion := &url.URL{Scheme: "postgres", Host: net.JoinHostPort(variable("DB_HOST", "base-postgres"), variable("DB_PORT", "5432")), Path: variable("DB_NAME", "votacion_db"), User: url.UserPassword(os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"))}
	consulta := direccion.Query()
	consulta.Set("sslmode", variable("DB_SSLMODE", "disable"))
	consulta.Set("connect_timeout", "5")
	direccion.RawQuery = consulta.Encode()
	base, err := sql.Open("postgres", direccion.String())
	if err != nil {
		log.Fatal("Configuración PostgreSQL inválida")
	}
	defer base.Close()
	base.SetMaxOpenConns(10)
	inicio, cancelar := context.WithTimeout(ctx, 30*time.Second)
	for {
		_, err = base.ExecContext(inicio, esquema)
		if err == nil || inicio.Err() != nil {
			break
		}
		select {
		case <-inicio.Done():
		case <-time.After(time.Second):
		}
	}
	cancelar()
	if err != nil {
		log.Fatal("No se pudo preparar persistencia de votacion")
	}
	cache := redis.NewClient(&redis.Options{Addr: net.JoinHostPort(variable("REDIS_HOST", "cache-redis"), "6379"), Password: os.Getenv("REDIS_CLAVE"), DialTimeout: time.Second, ReadTimeout: time.Second, WriteTimeout: time.Second, MaxRetries: 0})
	defer cache.Close()
	servicio := &Servicio{base: base, cache: cache}
	go servicio.publicar(ctx)
	servidor := http.Server{Addr: ":8080", Handler: servicio.rutas(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 30 * time.Second}
	go func() {
		<-ctx.Done()
		limite, cancelar := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancelar()
		_ = servidor.Shutdown(limite)
	}()
	log.Print("Servicio votacion escuchando en 8080")
	if err = servidor.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(fmt.Sprintf("Error HTTP: %s", strings.Split(err.Error(), "\n")[0]))
	}
}
