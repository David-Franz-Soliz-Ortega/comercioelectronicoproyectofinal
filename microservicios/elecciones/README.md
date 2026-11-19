# Elecciones TUVOTO

Catálogo propio de procesos, candidatos con fotografía, unidades, mesas y asignaciones. No consulta otras bases. Verifica cuentas por API de identidad antes de asignar. El catálogo de candidaturas queda congelado al asignar mesas; configure primero todos los candidatos.

Público: elección actual y fotografías de sus candidatos. Administrador: configuración de su organización. Operador: únicamente sus mesas asignadas de la elección actual. Contrato activo: `compartido/contratos/openapi/elecciones.openapi.json`.

El cliente gRPC y las pruebas SIGAPE se trasladaron a `archivo/sigape-p1/`. No se migraron datos históricos automáticamente ni se elimina su persistencia.
