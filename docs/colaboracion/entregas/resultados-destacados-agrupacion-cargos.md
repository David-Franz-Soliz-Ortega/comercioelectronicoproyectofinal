# Resultados: destacados en cómputo preliminar y navegación agrupada por cargo

Fecha: 2026-11-22  
Responsable: Antigravity  
Alcance: `frontend/src/paginas/PortalPublico.jsx`, `frontend/src/observatorio.css`

## Resumen del cambio

1. **Flujo de destacados directamente en Cómputo Preliminar**:
   - Retirado el bloque estático de «Candidaturas destacadas» que mostraba únicamente nombres y fotos con botones de redirección.
   - La selección de cargos destacados configurada en Administración (`destacadoPortada`) encabeza y determina de forma inmediata el cargo inicial mostrado en la sección «CÓMPUTO PRELIMINAR» al ingresar a Resultados (`#resultados`).
   - El cómputo preliminar presenta directamente los datos reales de los destacados configurados: tarjetas de candidatos, fotografías, porcentaje, votos válidos, barras de avance, actas contabilizadas y tabla por unidades.

2. **Navegación compacta y agrupada por palabra clave (Directores, Decanos, etc.)**:
   - Sustituida la barra horizontal plana de 34 botones por módulos agrupados por su familia o palabra clave («Rector», «Vicerrector», «Decano», «Director»).
   - Cargos únicos (Rector, Vicerrector) se seleccionan con un solo clic mostrando la insignia destacada.
   - Cargos múltiples (e.g. 25 Directores) muestran un solo botón con su contador (`Director (25) ▾`). Al presionarlo, se despliega una bandeja con:
     - Buscador rápido por facultad o ámbito.
     - Lista separada de directores por facultad/ámbito (`Ciencias y Tecnología · Sistemas`, `Derecho`, `Medicina`, etc.) para ver su cómputo preliminar individual.
     - Botón «Ver todos los directores con cómputos» que activa la vista agrupada con las tarjetas de cómputo completas de todos los directores del grupo (candidatos, votos y actas).
   - Botón «Ver todos los cargos» para consultar la panorámica global de cómputos.

## Verificación

- 71/71 pruebas unitarias frontend pasando (`npm run probar --prefix frontend`).
- Compilación de producción Vite completada exitosamente sin advertencias (`npm run compilar --prefix frontend`).
- Despliegue en caliente a contenedor local `tuvoto-frontend-1` (`/usr/share/nginx/html/`) verificado.
