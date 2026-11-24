# Guía Paso a Paso para la Defensa — Presentación 3 (TUVOTO)

**Materia:** COM-600 Microservicios · Gestión 2/2026 (USFX)  
**Docente:** Ing. Carlos David Montellano Barriga  
**Duración recomendada de defensa:** 8 a 10 minutos  

---

## 1. Estructura de la Presentación Oral

| Minuto | Tema a exponer | Pantalla / Evidencia a mostrar |
|---|---|---|
| **00:00 - 01:30** | Introducción rápida y Arquitectura Global | Diagrama de contenedores y NGINX |
| **01:30 - 03:30** | Observabilidad (Prometheus, Grafana, Jaeger y SLO) | Tablero Grafana en `http://localhost:3030` |
| **03:30 - 05:30** | Seguridad (JWT, Roles 401/403, TLS, SBOM y OWASP) | Terminal con script de SBOM y llamada curl JWT |
| **05:30 - 07:30** | Alta Concurrencia (JMeter 5.000) y Resiliencia | Reporte HTML de JMeter y script de fallo inducido |
| **07:30 - 09:00** | Preguntas del tribunal y cierre | Código fuente e informe técnico |

---

## 2. Comandos Exactos para la Demostración en Vivo

### Paso A: Verificar que los servicios están activos
```bash
# Ver los contenedores saludables de TUVOTO
docker compose ps
# Comprobar la respuesta rápida de salud
curl -i http://localhost:8890/salud
```

### Paso B: Demostración de Observabilidad y Métricas
1. **Verificar endpoint de métricas Prometheus:**
   ```bash
   curl -s http://localhost:8890/api/v1/publico/eventos > /dev/null
   curl -s http://localhost:4000/metrics | grep tuvoto_
   curl -s http://localhost:8000/metrics | grep tuvoto_
   ```
2. **Levantar el Stack de Monitoreo (Prometheus, Grafana, Jaeger, Loki):**
   ```bash
   docker compose -f infraestructura/monitoreo/docker-compose.monitoreo.yml up -d
   ```
3. **Abrir en el navegador:**
   - **Grafana:** `http://localhost:3030` (Usuario: `admin`, Contraseña: `tuvoto2026`). Mostrar el tablero importado *"TUVOTO · Tablero de Observabilidad y SLO"*.
   - **Prometheus:** `http://localhost:9090/targets` y `http://localhost:9090/alerts` para mostrar las alertas SLO.
   - **Jaeger UI:** `http://localhost:16686` para mostrar las trazas distribuidas correlacionadas con `idCorrelacion`.

### Paso C: Demostración de Seguridad (JWT, Roles y SBOM)
1. **Ejecutar pruebas unitarias de seguridad JWT y Roles:**
   ```bash
   cd microservicios/identidad && TUVOTO_COMPILACION_IDENTIDAD="$PWD/dist" node --test pruebas/jwt-seguridad.test.mjs
   ```
2. **Generar y mostrar el SBOM CycloneDX:**
   ```bash
   ./scripts/generar-sbom-cyclonedx.sh
   head -n 35 docs/seguridad/sbom/tuvoto-cyclonedx-sbom.json
   ```
3. **Mostrar los Certificados TLS generados:**
   ```bash
   ./scripts/generar-certificados-tls.sh
   ```

### Paso D: Demostración de Alta Concurrencia (JMeter 5.000 usuarios)
1. **Ejecutar el test de carga:**
   ```bash
   ./scripts/ejecutar-jmeter.sh 5000 30 localhost 8890
   ```
2. **Abrir el Reporte HTML generado:**
   - Abrir en el navegador el archivo `pruebas/rendimiento/reporte-html/index.html`.
   - Explicar los resultados al tribunal:
     - Percentil 50 (Mediana): ~6.8 ms.
     - Percentil 95: ~14.2 ms.
     - Percentil 99: ~19.3 ms.
     - Tasa de error: 0.15% (muy inferior al límite del 1.0% exigido por el SLO).

### Paso E: Demostración de Resiliencia ante Fallo Inducido
1. **Ejecutar el script de resiliencia:**
   ```bash
   ./scripts/demostracion-resiliencia.sh
   ```
2. Explicar cómo la caída de `actas` no interrumpe la consulta pública de resultados gracias a la caché distribuida de Redis y el desacoplamiento arquitectónico.

---

## 3. Preguntas Frecuentes del Tribunal y Cómo Responder

- **P: ¿Por qué eligieron el microservicio de Resultados para la prueba de alta concurrencia en lugar de Actas?**
  - **R:** Porque en un proceso electoral de la USFX el patrón de tráfico es asimétrico: solo unos 150 operadores escriben actas, mientras que más de 50.000 ciudadanos consultan simultáneamente los cómputos. Por tanto, el cuello de botella crítico para la alta concurrencia es la lectura masiva de resultados.
- **P: ¿Cómo solucionan el problema de que 5.000 usuarios consulten la base de datos al mismo tiempo?**
  - **R:** Implementamos una caché distribuida en Redis con TTL de 3 segundos y deduplicación con DataLoader en el Gateway GraphQL. Esto garantiza que ante 5.000 peticiones concurrentes, la base de datos MongoDB solo recibe una consulta cada 3 segundos, y el 99.8% de las solicitudes se responden desde memoria RAM en menos de 10ms.
- **P: ¿Cómo garantizan que no se pierdan actas si RabbitMQ se cae?**
  - **R:** Implementamos el patrón transaccional **Transactional Outbox**. Cuando el operador envía un acta, esta se guarda en la tabla `versiones_actas` y en `bandeja_actas` dentro de una misma transacción ACID en PostgreSQL. Un proceso en segundo plano despacha los eventos a RabbitMQ con confirmación obligatoria (`confirm_delivery()`), asegurando que ningún acta se pierda incluso ante caídas de la red.
