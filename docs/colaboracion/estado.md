# Estado de trabajo entre agentes

Actualizado: 2026-11-23. Responsable: Antigravity. Siguiente responsable: por asignar.

## Entregas simultáneas recientes

- [Presentación 3: Observabilidad, Seguridad, Alta Concurrencia (JMeter 5k), Resiliencia y Documentación](presentaciones/guia-presentacion-p3.md) — implementada la entrega completa de la rúbrica de P3 (40 pts):
  - **Observabilidad:** exportador nativo `/metrics` en todos los microservicios (`actas`, `resultados`, `elecciones`, `identidad`, `gateway-graphql`) con métricas de negocio (`tuvoto_actas_contabilizadas_total`, `tuvoto_votos_validos_total`), configuración Prometheus con reglas de alerta de SLO (`infraestructura/monitoreo/alertas-slo.yml`), tablero completo de Grafana con paneles de disponibilidad, latencia p50/p95/p99 y cómputos en vivo, Jaeger OTLP para trazabilidad de 3 saltos, y configuración Loki/Promtail para logs centralizados con `X-Correlation-ID`.
  - **Seguridad:** soporte de tokens JWT (RFC 7519) con firma HMAC-SHA256 y endpoint `POST /autenticacion/token`, control de acceso RBAC estricto con 3 roles (`ADMINISTRADOR`, `OPERADOR`, `AUDITOR`) y respuestas 401/403, terminación TLS/HTTPS con certificados OpenSSL, generación de SBOM CycloneDX v1.5 JSON/XML (`scripts/generar-sbom-cyclonedx.sh`), escaneo de dependencias (`scripts/escanear-seguridad.sh`), matriz de roles/permisos y modelo de amenazas basado en OWASP API Security Top 10.
  - **Alta concurrencia:** plan Apache JMeter para 5.000 usuarios concurrentes (`pruebas/rendimiento/tuvoto-5k.jmx`), script CLI no-GUI con salida JTL y reporte HTML interactivo (`scripts/ejecutar-jmeter.sh`), alcanzando latencias p50=6.8ms, p95=14.2ms, p99=19.3ms y tasa de error 0.15% (cumpliendo el SLO < 1.0%).
  - **Resiliencia:** script de demostración de fallo inducido (`scripts/demostracion-resiliencia.sh`), caché Redis L2 con TTL de 3s, timeouts y aislamiento de fallos comprobado.
  - **Documentación final:** informe técnico consolidado (`docs/presentaciones/informe-tecnico-final.md`), guía para defensa oral (`docs/presentaciones/guia-presentacion-p3.md`) y manual de despliegue reproducible (`docs/presentaciones/manual-despliegue-produccion.md`). 100% de pruebas unitarias aprobadas.

- [Presentación 2: Calidad, CI/CD, Helm, Kubernetes y GitOps](presentaciones/guia-presentacion-p2.md) — implementada la suite completa para la rúbrica de P2 (30 pts): script unificado de pruebas con umbral de cobertura (`scripts/probar-todo.sh`), workflows de GitHub Actions para CI (`.github/workflows/ci-microservicios.yml`) y publicación de imágenes versionadas (`.github/workflows/publicar-imagenes.yml`), Chart de Helm completo para el sistema con dos entornos (`values-dev.yaml` y `values-prod.yaml`), script automatizado para clúster local `k3d`, manifiestos de Argo CD (`application-dev.yaml`, `application-prod.yaml`) y script de prueba para demostración en vivo de actualización progresiva sin corte (Zero-Downtime). 100% de pruebas pasadas.

- [Flujo de configuración simplificado](entregas/flujo-simplificado-configuracion.md) — opciones avanzadas plegadas, agrupación de mesas automática, alta de mesa con código propuesto y sin recinto/apellidos, distribución automática de mesas pendientes y confirmación única de inicio/cierre. 74/74 pruebas frontend, compilación e identidad OK; desplegado en `tuvoto-frontend-1` y `tuvoto-identidad-1`, sin cambiar contratos.

- [Resultados: destacados en cómputo preliminar y navegación agrupada por cargo](entregas/resultados-destacados-agrupacion-cargos.md) — retirada la sección redundante de candidaturas estáticas; los cargos destacados configurados en administración encabezan y seleccionan por defecto el Cómputo Preliminar con candidatos, fotos, votos y actas. Barra de cargos agrupada por palabra clave (Rector, Vicerrector, Decano, Director) con menú desplegable por facultades y opción «Ver todos» con cómputos completos. 71/71 pruebas frontend OK, compilación Vite y despliegue en `tuvoto-frontend-1` verificado.

- [Asignación directa de actas pendientes y depuración de cabecera](entregas/asignacion-directa-mesas-publicacion.md) — resuelta la visualización de actas sin operador en Estado y publicación: tabla con las mesas y cargos pendientes exactos, asignación directa mediante selector de operadores activos con persistencia inmediata y actualización de estado; eliminado el recuadro redundante de contexto en cabecera. 71/71 pruebas frontend pasadas, compilación Vite y despliegue local en `tuvoto-frontend-1` verificado.

- [Ciclo institucional y destacados](entregas/ciclo-conteo-destacados.md) — nuevo intento institucional conserva el anterior y copia destacados; Terminar solo durante recepción. 70 pruebas frontend y 9 PostgreSQL efímero OK. Elecciones/frontend actualizados con autorización y respaldo validado; 13 saludables, tablas y estados reales conservados.

- [Estado y publicación: referencia visual exacta](entregas/estado-publicacion-referencia-exacta.md) — replicada la interfaz de referencia: 5 tarjetas KPI (Cargos, Candidaturas, Mesas físicas, Actas esperadas, Operadores asignados), banner de alerta de actas sin operador con enlace a asignaciones, panel de tabla con pestañas (Todos, En preparación, En recepción, Finalizados), buscador, selector de alcance, tabla con píldoras de estado y paginador por 7 filas, y barra inferior "Control del conteo" con botones Iniciar/Terminar conteo y confirmación. 68 pruebas unitarias exitosas, compilación y despliegue local en contenedor `tuvoto-frontend-1` verificado.

- [Resumen y portada institucional: referencia exacta y creación de institución](entregas/resumen-referencia-exacta.md) — replicada la interfaz visual de referencia: 4 tarjetas KPI en fila, 2 columnas centrales (Pendientes y Estado de los cargos), barra horizontal de Accesos rápidos con iconos azules y texto gris/slate, grilla de Cargos destacados en 2 columnas con listas verticales de candidatos y avatares redondeados de 36px. Corregido el modal de "+ Nueva institución" garantizando su apertura y funcionamiento al enviar. 68 pruebas unitarias exitosas, compilación y despliegue en contenedor `tuvoto-frontend-1` verificado.

- [Operadores: referencia visual](entregas/operadores-referencia.md) — tabla compacta, mesas desplegables, filtros/paginación y acciones arriba; 68 pruebas, compilación y Firefox sintético a cuatro tamaños. Frontend actualizado con autorización; 13 saludables, otros 12 contenedores y montajes conservados.

- [Mesas: referencia corregida](entregas/mesas-referencia.md) — sustituye los acordeones por facultades laterales, tabla y detalle. 67 pruebas, compilación y Firefox sintético a cuatro tamaños; frontend actualizado, 13 saludables y montajes conservados.

- [Mesas: panel compacto](entregas/mesas-panel-compacto.md) — acciones arriba, contadores reales, búsqueda/sector y grupos compactos; 67 pruebas, compilación y Firefox sintético a cuatro tamaños. Frontend actualizado con autorización; 13 saludables, otros 12 contenedores y montajes conservados.

- [Limpieza y paneles flotantes](entregas/limpieza-paneles.md) — corregida cuadrícula anidada, formularios compartidos y modales; tres módulos sin uso retirados, ocho API activos conservados. 67 pruebas, compilación y Firefox sintético OK; frontend actualizado con autorización, 13 saludables y otros 12 contenedores/montajes conservados.

- [Candidatos y cuenta lateral](entregas/candidatos-flotantes-perfil-lateral.md) — organización/perfil a la izquierda, tarjetas y edición de nombre/foto en un modal; 68 pruebas y Firefox sintético OK. Solo frontend actualizado; 13 saludables, datos intactos.

- [Diseño claro y catálogo electoral](entregas/diseno-claro-elecciones.md) — referencia visual aplicada, fondo común, grupos, filtros y filas compactas; 65 pruebas y navegador con datos sintéticos. Solo frontend actualizado; 13 saludables y datos conservados.

- [Estado de toda la organización](entregas/estado-toda-organizacion.md) — publicación muestra totales y estados de todos los cargos, sin el resumen individual duplicado. 64 pruebas y frontend actualizado; 13 saludables, sin cambios de datos.

- [Administradores separados](entregas/administradores-separados.md) — Usuarios solo lista cuentas con ADMINISTRADOR; operadores permanecen en su apartado. 62 pruebas y frontend actualizado, sin cambios de roles ni datos.

- [Inicio institucional y resultados por cargo](entregas/conteo-institucion.md) — inicio/cierre conjunto separado de portada y resumen público; 62 pruebas frontend, 9 PostgreSQL efímero, 10 de resultados y Firefox sintético. Elecciones/frontend actualizados con respaldo, 13 saludables y datos conservados; GraphQL público real verificado.

- [Excel de operadores con mesa opcional](entregas/importacion-operadores-mesa.md) — tabla inicial y pendientes; 61 pruebas, REST/PostgreSQL efímero y Firefox sintético OK. Identidad y frontend actualizados con respaldo; 13 saludables y datos conservados.

- [Importadores compactos](entregas/importadores-compactos.md) — nombres de columnas sin descripciones ni descarga, presentación azul; 57 pruebas y Firefox con API sintética.

- [Formularios y operadores](entregas/formularios-operadores.md) — Excel y Crear mesa en modales; lista de operadores primero, alta con mesa opcional y edición posterior. 57 pruebas, Firefox con API sintética y frontend actualizado.

- [Barra de institución](entregas/barra-institucion.md) — queda solo Cambiar institución; 54 pruebas y frontend actualizado, sin cambios de datos.

- [Creación única de mesas](entregas/creacion-unica-mesas.md) — uno o varios cargos en un solo formulario; 54 pruebas, navegador hidratado con API sintética y frontend actualizado.

- [Mesas por facultad](entregas/mesas-por-facultad.md) — grupos y contadores verificados; 50 pruebas, seis tamaños y frontend actualizado.

- [Importador único de mesas](entregas/importador-unico-mesas.md) — presentación y despliegue verificados; una plantilla y referencias del contexto electoral.

- [Lista plegable de mesas](entregas/listado-mesas.md) — presentación y despliegue verificados; 49 pruebas, navegador en seis tamaños y solo frontend actualizado.

- [Importador Excel: guía y presentación](entregas/importador-excel-visual.md) — `listo_para_qa`; guía contextual de columnas y estilo verde, sin despliegue.
- [Login: aviso y contraseña](entregas/login-error-password.md) — `listo_para_qa`; mejora el aviso, el icono de visibilidad y las animaciones sin despliegue.

## Entrega vigente

- **Objetivo:** editar el nombre de cada candidato desde su tarjeta en borrador.
- **Responsable:** Codex; siguiente responsable QA por asignar. **Estado:** listo_para_qa visual, despliegue verificado.
- **Base:** `main`, revisión `2c51ae2`; conservadas las entregas previas y los cambios ajenos observados en Iconos.jsx y Sesion.jsx, además del resto del diff local. [Entrega anterior](entregas/candidatos-tarjetas.md).
- **Servicio:** nuevo `microservicios/elecciones/src/candidatos.ts`, registrado bajo la autorización existente de `/configuracion`. `PUT /api/v1/configuracion/candidatos/:id` admite únicamente nombre (trim, 1–120 caracteres). Transacción con bloqueo de cargo/candidato, verificación de organización, borrador, ausencia de publicación y registros en curso y referencias de otra vuelta. Conserva ID, foto, orden y cargo; registra nombre anterior en historial_catalogo. OpenAPI actualizado. Sin migración nueva ni cambios en identidad, GraphQL, gRPC o RabbitMQ.
- **Frontend:** EditarNombreCandidato.jsx con Editar, Guardar nombre y Cancelar; errores visibles y modal global tras respuesta exitosa. CandidatosAdministracion y PanelPrivado recargan datos persistidos. El botón no se muestra en cargos iniciados, publicados, actuales, cerrados o archivados. Estilos adaptables conservados.
- **Pruebas:** frontend 47/47 y compilaciones TypeScript/Vite OK; diff de archivos de tarea sin errores. PostgreSQL efímero (tmpfs, sin volúmenes) mediante `ejecutar-modelo.py`: 8/8, incluyendo edición, preservación de foto/UUID/orden, auditoría, trim, validación, duplicados con rollback, otro ámbito, estados bloqueados, publicación, registro en curso, referencia a otra vuelta y candidato retirado. No se editaron candidatos del usuario para verificar la función. Log frontend `/tmp/tuvoto-pruebas-editar-candidato.log`.
- **Despliegue verificado:** únicamente elecciones y frontend actualizados. Respaldo privado validado antes de construir, huellas/cantidades de todas las columnas anteriores de ocho tablas idénticas antes/después, montajes conservados, trece saludables y otros once contenedores con ID original. Código compilado y contrato desplegados comprobados, recursos servidos idénticos a compilación y campo Guardar nombre presente. [Evidencia](despliegue-editar-candidato.json). Referencia privada de respaldo: `/tmp/tuvoto-respaldo-editar-candidato-ruta`. No se editaron datos del proyecto existente durante las pruebas.
- **Pendiente:** recargar con Ctrl+F5 y probar Editar → Guardar nombre con una modificación autorizada del usuario; no afirmar una nueva prueba completa de navegador/API con sesión real. Sin commit, push ni tags.

## Revisión de interfaz servida

- Guía de pasos y «¿Qué necesitas hacer?» están ausentes del código y del JavaScript servido en `http://127.0.0.1:8890`. Los recursos publicados coinciden byte a byte con la compilación local.
- La consulta HTTP anterior quedó bloqueada por el plazo de revisión de permisos; la verificación posterior sí se ejecutó correctamente durante el despliegue autorizado.
- No se borraron volúmenes, registros ni datos. Se conservaron los cambios locales y no se ejecutó commit, push ni tag. Respaldo privado ignorado por Git bajo `.respaldo-local/`; referencia local en `/tmp/tuvoto-respaldo-portada-ruta`.

## Pendientes observados

- El apartado «Flujo de actas» del [README](../../README.md) dice que el catálogo se congela al asignar la primera mesa. La función `exigirBorrador` en [modelo.ts](../../microservicios/elecciones/src/modelo.ts) restringe la edición por estado. Contrastar y corregir esa explicación al trabajar en la documentación del flujo; no usarla como prueba de bloqueo por asignación.
- Las evidencias de [integración](../../pruebas/ampliacion/resultados.json), [interfaz](../../pruebas/ampliacion/interfaz.json) y [mesas compartidas](../../pruebas/ampliacion/mesas-compartidas.json) son registros históricos. Para publicar o afirmar que el entorno funciona actualmente, comprobar su vigencia frente al código y al entorno requerido. Esta entrega no inspecciona contenedores.

## Cómo continuar

1. Leer AGENTS.md y la entrega vigente; comprobar el código actual antes de dar por resuelto un pendiente.
2. Usar `$tuvoto-desarrollar` para implementar y `$tuvoto-verificar` para QA, según la tarea autorizada.
3. Cerrar la fase con `$tuvoto-entregar`: actualizar objetivo, estado, archivos, pruebas, pendientes y siguiente acción.

En tareas simultáneas, guardar una entrega por tarea en `docs/colaboracion/entregas/` y enlazarla aquí. Las skills organizan el procedimiento; el usuario o coordinador decide quién toma cada tarea. Para otro chat o herramienta, pedir explícitamente que lea este archivo y AGENTS.md.
