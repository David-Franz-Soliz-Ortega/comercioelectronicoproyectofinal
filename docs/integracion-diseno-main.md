# Integración local del diseño de main

Rama de trabajo: `integracion-diseno-main`. Base local: `dda88cf`; diseño revisado: `origin/main` en `22cac99`. No se hicieron commits, merge commits, push ni cambios al puntero local de main. Los cambios están combinados en el árbol de trabajo; esto no equivale a fusionar todavía el historial Git remoto.

Respaldo de código previo, verificado por SHA-256: `.respaldo-local/antes-integrar-main-20261120-142827/codigo-actual.tar.gz`. No contiene entornos privados, bases de datos ni dependencias. Los respaldos PostgreSQL privados de la actualización se conservan también bajo `.respaldo-local/`, fuera de Git y Docker.

## Qué se incorporó

| Área | Integración |
| --- | --- |
| React | Separación de páginas, carga diferida del panel, diseño público, Manrope local con licencia, fotos, animación, filtros y estados de carga/error. |
| Panel | Conserva Excel, sectores, porcentajes configurables, referencia de fotografías, roles y cuatro estados; añade preparación de eventos con varios cargos. |
| Elecciones | Catálogo de eventos agrupado por nombre/organización, sin reemplazar modelo ampliado, reservas gRPC o controles de configuración. |
| GraphQL | Query `eventos`, conservando las queries locales, tipos ampliados, DataLoader y mutation autorizada. |
| Resultados | Respuesta 404 al retirarse un proceso antes de consultar la caché; conserva proyección, ponderación y reglas. |
| Contratos/pruebas | OpenAPI/SDL coordinados, catálogo, gateway HTTP, validación de cifras y regresión de clasificación ponderada. |

No se incorporó el botón remoto de ocultar/desactivar: cerrar y archivar siguen las transiciones verificadas. No se copiaron el volcado de conversación, los scripts de creación de administradores/datos demostrativos ni el arranque automático remoto. Esos scripts no son necesarios para presentar el diseño y podrían operar con una configuración distinta. No se ejecutaron.

## Validación

- 16 pruebas React y compilación Vite.
- 5 pruebas GraphQL, incluido servidor HTTP con dobles de servicios.
- 2 pruebas del catálogo y compilación TypeScript de Elecciones.
- 11 pruebas de Resultados; 8 de dominio/HTTP/reservas de Actas, sin bases reales en esas suites.
- Nueve grupos de comprobaciones HTTP/gRPC reales del entorno sintético: login, cuatro Excel, sectores/pesos, eventos, correcciones, organizaciones y estados. Ver `pruebas/ampliacion/resultados.json`.
- Firefox existente: login, guía, estados y confirmaciones, formulario ampliado y portada con API real; sin desbordamiento en 390/768/1440 px. Ver `pruebas/ampliacion/interfaz.json`.

Las siete pruebas SQL de Actas se ejecutaron en la fase anterior; no se cuentan como ejecutadas otra vez por esta integración. No se declara carga masiva de visitantes, OCR ni certificación electoral. La prueba visual usa datos sintéticos identificados, nunca datos simulados incrustados en la interfaz.

Despliegue local verificado: 13 contenedores saludables, cuatro cuentas activas conservadas y comparación íntegra de cantidades/huellas de datos, configuración y estados. Acceso: http://127.0.0.1:8890/#panel. Se actualizaron solo Elecciones, gateway, API de Resultados y frontend; bases y credenciales permanecieron intactas. Ver `pruebas/ampliacion/despliegue.json`.
