# ==============================================================================
# Script de Demostración: Siembra de 10.000 Registros Sintéticos en PostgreSQL
# Requisito 2.2 de la Presentación 1 (Paginación y Filtros en la colección mayor)
# ==============================================================================

Write-Host "Iniciando sembrado de 10.000 actas sintéticas en PostgreSQL..." -ForegroundColor Cyan

# 1. Obtener los identificadores del proceso electoral y organización actuales
$ids = docker compose exec -T base-postgres psql -U tuvoto_admin -d elecciones_db -t -A -F "," -c "SELECT id, id_organizacion FROM tuvoto_procesos LIMIT 1;"

if (-not $ids) {
    Write-Host "Error: No se encontró un proceso electoral creado en la base de datos." -ForegroundColor Red
    Write-Host "Crea una elección desde el panel web (http://127.0.0.1:8890) antes de ejecutar el sembrado." -ForegroundColor Yellow
    exit 1
}

$partes = $ids.Trim().Split(",")
$idProceso = $partes[0]
$idOrg = $partes[1]

# 2. Obtener el ID del usuario administrador
$idUsuario = docker compose exec -T base-postgres psql -U tuvoto_admin -d identidad_db -t -A -c "SELECT id FROM usuarios WHERE usuario = 'admin' LIMIT 1;"
$idUsuario = $idUsuario.Trim()

Write-Host "Proceso Electoral ID : $idProceso" -ForegroundColor Gray
Write-Host "Organización ID      : $idOrg" -ForegroundColor Gray
Write-Host "Usuario ID           : $idUsuario" -ForegroundColor Gray

# 3. Limpiar registros sintéticos previos (opcional para idempotencia)
Write-Host "Limpiando versiones anteriores..." -ForegroundColor Yellow
docker compose exec -T base-postgres psql -U tuvoto_admin -d actas_db -c "TRUNCATE TABLE versiones_actas;" | Out-Null

# 4. Inserción masiva de 10.000 registros mediante generate_series
Write-Host "Insertando 10.000 registros clasificados (5.000 publicadas y 5.000 observadas)..." -ForegroundColor Cyan

$sql = @"
INSERT INTO versiones_actas(
    id, id_proceso, id_mesa, id_organizacion, id_operador, 
    version, id_solicitud, huella, foto, mime, foto_hash, estado, conteo
)
SELECT 
    gen_random_uuid(),
    '$idProceso'::uuid,
    gen_random_uuid(),
    '$idOrg'::uuid,
    '$idUsuario'::uuid,
    1,
    gen_random_uuid(),
    repeat('a', 64),
    convert_to('sintetico', 'UTF8'),
    'image/png',
    repeat('b', 64),
    CASE WHEN n % 2 = 0 THEN 'publicada' ELSE 'observada' END,
    '{}'::jsonb
FROM generate_series(1, 10000) n;
"@

docker compose exec -T base-postgres psql -U tuvoto_admin -d actas_db -c $sql

# 5. Comprobación y conteo
Write-Host "`n=== RESULTADO DEL SEMBRADO ===" -ForegroundColor Green
docker compose exec -T base-postgres psql -U tuvoto_admin -d actas_db -c "SELECT estado, count(*) FROM versiones_actas GROUP BY estado;"
docker compose exec -T base-postgres psql -U tuvoto_admin -d actas_db -c "SELECT count(*) AS total_general FROM versiones_actas;"
