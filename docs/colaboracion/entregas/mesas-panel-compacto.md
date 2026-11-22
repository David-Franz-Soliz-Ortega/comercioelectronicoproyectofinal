# Mesas: panel compacto

Fecha: 2026-11-22. Responsable: Codex; QA por asignar. Estado: listo_para_qa visual; despliegue verificado. Base observada: main, a5ee8e2, con cambios locales anteriores conservados.

## Cambios

MesasCompartidas.jsx coloca Crear mesa e Importar Excel juntos en la cabecera y conserva los modales y endpoints existentes. ListadoMesas.jsx muestra cantidades reales de mesas físicas, facultades/unidades y actas esperadas; conserva la distinción entre mesa compartida y actas por cargo. Añade filtro por sector, búsqueda existente y expansión/contracción de grupos. Facultades en superficies blancas compactas con sombra, detalles y acciones alineadas; adaptación móvil. Estilos en administracion.css y tema-claro.css.

Retirado el prop ayuda de ImportarExcel que no era consumido y sus cuatro reglas CSS sin referencias. No se añadieron componentes ni APIs paralelos. Ningún cambio de permisos, datos, contratos o reglas de eliminación/registro.

## Pruebas ejecutadas

- npm --prefix frontend run probar: 67/67.
- npm --prefix frontend run compilar: OK.
- node frontend/pruebas/diseno-claro-interfaz.mjs: Firefox instalado, API completamente sintética; catálogo, modales de cargo/administrador y Mesas. Verifica exclusión de archivados, contadores 34/33/34 de la muestra, búsqueda válida/vacía, sector, expandir/contraer, apertura de mesa y modales Crear/Excel. Anchos 390/768/1440/2560, sin desbordamiento y grupos compactos; ninguna escritura de API. Capturas /tmp/tuvoto-mesas-claro-ANCHO.png. No equivale a probar persistencia con servicios reales.
- git diff --check: OK.

## Siguiente acción

Actualización autorizada posteriormente por el usuario y ejecutada únicamente sobre frontend, con build y up --no-deps. Trece contenedores saludables; los otros doce conservan IDs y todos los montajes permanecen idénticos. Index y recursos servidos por http://127.0.0.1:8890 coinciden byte a byte con la compilación local; comprobados los nuevos indicadores y controles de Mesas. [Evidencia](../despliegue-mesas-panel-compacto.json). Sin escrituras de prueba en bases de datos ni migraciones. Siguiente acción: recargar con Ctrl+F5 y revisar Mesas con la sesión del usuario. Sin commit, push ni tags.
