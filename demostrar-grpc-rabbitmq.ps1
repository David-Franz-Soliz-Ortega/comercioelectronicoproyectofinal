# ==============================================================================
# DEMOSTRACIÓN DE LA PRESENTACIÓN 1:
# Requisito 2.4: gRPC Interno con Deadline
# Requisito 2.5: RabbitMQ con 2 Consumidores, DLQ e Idempotencia
# ==============================================================================

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "1. DEMOSTRACIÓN gRPC INTERNO CON DEADLINE (Requisito 2.4)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# Definir la ruta de compilación
$env:TUVOTO_COMPILACION_ELECCIONES="microservicios/elecciones/dist"

Write-Host "Ejecutando suite de prueba del contrato gRPC (mesa-v1.proto)..." -ForegroundColor Yellow
node microservicios/elecciones/pruebas/mesas-grpc.test.mjs

Write-Host "`nExplicación para el docente:" -ForegroundColor Green
Write-Host "  - Contrato: compartido/contratos/grpc/mesa-v1.proto (ServicioMesas)." -ForegroundColor Gray
Write-Host "  - El servicio de Actas consulta a Elecciones vía gRPC binario." -ForegroundColor Gray
Write-Host "  - Valida autenticación por metadatos, permisos y corte por DEADLINE en 25ms." -ForegroundColor Gray

Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host "2. DEMOSTRACIÓN EVENTOS RABBITMQ CON 2 CONSUMIDORES Y DLQ (Requisito 2.5)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

Write-Host "`nA) Exchanges creados en RabbitMQ (Intercambiador Topic tuvoto.actas):" -ForegroundColor Yellow
docker compose exec -T mensajeria-rabbitmq rabbitmqctl list_exchanges name type | Select-String "tuvoto"

Write-Host "`nB) Colas activas, mensajes y consumidores conectados:" -ForegroundColor Yellow
docker compose exec -T mensajeria-rabbitmq rabbitmqctl list_queues name messages consumers | Select-String "resultados"

Write-Host "`nExplicación para el docente:" -ForegroundColor Green
Write-Host "  - Exchange Topic: 'tuvoto.actas' enruta eventos de actas publicadas." -ForegroundColor Gray
Write-Host "  - Consumidor 1: 'resultados.conteo.v1' (1 worker) -> Agrega votos en MongoDB y limpia Redis." -ForegroundColor Gray
Write-Host "  - Consumidor 2: 'resultados.auditoria.v1' (1 worker) -> Bitacora e integridad de hashes." -ForegroundColor Gray
Write-Host "  - DLQ (Dead Letter Queue): 'resultados.conteo.v1.dlq' y 'resultados.auditoria.v1.dlq'." -ForegroundColor Gray
Write-Host "  - Idempotencia: MongoDB realiza upsert por hash/version de acta para evitar contar dos veces." -ForegroundColor Gray
Write-Host "======================================================================" -ForegroundColor Cyan
