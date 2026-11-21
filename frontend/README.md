# Frontend TUVOTO

Portal público: elección actual, candidatos con fotografías, votos y avance por mesas, sin login. Panel privado: administración de organización/procesos/cuentas/asignaciones o registro de actas por operadores. Conserva cookies HttpOnly, CSRF, logout y revalidación de sesión.

El operador fotografía/sube JPEG/PNG y confirma manualmente números. No hay OCR simulado. Las actas observadas no incorporan votos nuevos. No se muestran cifras ficticias.

`npm run probar`, `npm run compilar`. Desarrollo: definir `URL_ENTRADA_DESARROLLO` con NGINX del proyecto TUVOTO en loopback y un puerto explícito; el proxy mantiene REST/GraphQL en un mismo origen. No apuntar al principal SIGAPE.

La portada incorpora una urna animada en SVG, un control para pausar el movimiento y adaptación a la preferencia de movimiento reducido. Los resultados provienen del contrato GraphQL vigente; las candidaturas se ordenan por votos recibidos y no se declaran ganadores.

Para comprobar la interfaz, iniciar Vite y ejecutar `npm run probar-interfaz`. `URL_BASE` permite cambiar la dirección de prueba (por defecto `http://127.0.0.1:5174`) y `CHROMIUM_EJECUTABLE` permite usar un Chromium instalado. Las capturas se guardan en `/tmp` o en `EVIDENCIA_FRONTEND`.

La prueba de navegador utiliza respuestas sintéticas interceptadas exclusivamente en el navegador: verifica filtros, estados vacíos y de error, movimiento reducido y anchos de 320 a 1440 px. No escribe datos ni acredita una integración completa con servicios desplegados.

## Integración del diseño publicado en main

`Aplicacion.jsx` ahora selecciona `paginas/PortalPublico.jsx` y carga `paginas/PanelPrivado.jsx` de forma diferida. El diseño público, la tipografía local y `privado.css` proceden de main; `ampliaciones.css` conserva Excel, sectores, ponderación y estados. Los clientes mantienen sesión, CSRF y errores 401/403.

El catálogo utiliza GraphQL `eventos`; el panel sigue las APIs reales de configuración, importación y estados. Ver `docs/portal-eventos.md`. Pruebas reales locales: `node pruebas/ampliacion/probar-interfaz.mjs` desde la raíz, únicamente después de preparar el entorno sintético documentado. No requiere instalar Chromium.

El estilo del administrador se define en `src/administracion.css`, limitado a `.administracion-tuvoto`: tipografía del observatorio, tarjetas azules/blancas, campos y selectores accesibles, formularios adaptables y estados de foco. El operador, auditor y portal conservan sus estilos. No modifica permisos ni contratos.

La selección administrativa está separada en **Institución → Evento electoral → Cargo**, usando únicamente el catálogo autorizado existente. Cambiar de evento limita sus cargos y reinicia el formulario pendiente; el estado y el indicador de portada se muestran aparte. No renombra ni divide registros existentes.

En Resumen las instituciones se muestran como tarjetas en una lista, con la ficha de la seleccionada al lado. «Crear nueva institución» usa el endpoint real de organizaciones y solo se ofrece al administrador global. Antes de seleccionar una institución existente no se muestran eventos ni cargos. La prueba Firefox crea exclusivamente una institución sintética en el proyecto aislado y comprueba su persistencia por API; no crea elecciones ni actas.

La selección de institución permanece en Resumen; eventos y cargos se eligen en Elección. La institución y el cargo se mantienen en el estado del panel al navegar; los demás módulos muestran una referencia compacta con «Cambiar en Resumen». La prueba Firefox comprueba que el bloque no se repite en Usuarios, Mesas y Candidatos y que los IDs seleccionados se conservan.

Resumen muestra totales reales de eventos, candidatos, mesas y operadores activos de la institución; excluye cargos archivados de los totales y los informa aparte. Los accesos solo navegan. Elección concentra el catálogo de eventos/cargos y su configuración: ámbito, vuelta, sectores, conteo normal o ponderado y regla opcional. Candidatos mantiene fotografías/Excel; Mesas, Asignar operadores, Usuarios y Estado conservan sus propias operaciones. No se duplican formularios de gestión en Resumen.

Resumen incluye una vista previa de hasta seis candidatos del cargo activo y «Ver resultados públicos» para los cargos publicados. El enlace usa `#resultados?proceso=UUID` y selecciona el cargo exacto, sin cambiar el destacado ni abrir la recepción. Los cargos retirados muestran un estado no disponible, sin sustituirlos por resultados ajenos. La edición permanece en Candidatos y la publicación en su módulo. Las fotografías de borradores no se solicitan al endpoint público.

En Resumen, «Tu espacio de trabajo» aparece antes de los indicadores y la vista previa. En Mesas, la importación Excel está desplegada antes del formulario manual: `codigo` único por cargo, `unidad` para facultad/carrera/comunidad y `sector` si está configurado. Las mesas se listan agrupadas por unidad. Se conserva el bloqueo de importación fuera de borrador. La prueba Firefox descarga la plantilla real y persiste dos mesas de facultades distintas exclusivamente en el entorno sintético; no crea actas ni escribe en el entorno habitual.

En Elección, el administrador puede Iniciar conteo, Terminar conteo y Preparar nuevo conteo. Iniciar requiere candidatos, mesas y al menos una asignación por mesa. Terminar bloquea escrituras; corregir configuración exige preparar el siguiente intento. Esa operación archiva el anterior, conserva sus actas y copia candidatos/fotos, mesas/sectores y asignaciones a IDs nuevos en borrador, sin votos. No limpia bases, Redis ni MongoDB. El inicio del nuevo borrador es una confirmación separada. Las pruebas reales usan exclusivamente el entorno sintético; esta función de demostración no equivale a habilitación para producción.
