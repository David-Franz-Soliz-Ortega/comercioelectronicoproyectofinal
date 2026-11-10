FROM golang:1.23-alpine AS construccion
WORKDIR /codigo
COPY microservicios/votacion/go.mod microservicios/votacion/go.sum ./
RUN go mod download
COPY microservicios/votacion/*.go ./
RUN go test ./... && CGO_ENABLED=0 go build -trimpath -o /votacion .
FROM alpine:3.21
RUN addgroup -S sigape && adduser -S -G sigape sigape
WORKDIR /app
COPY --from=construccion /votacion /app/votacion
COPY compartido/contratos/openapi/votacion.yaml /app/contrato.yaml
USER sigape
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=4s --start-period=15s CMD ["/app/votacion", "salud"]
ENTRYPOINT ["/app/votacion"]
