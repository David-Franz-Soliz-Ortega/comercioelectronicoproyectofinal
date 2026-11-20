# Elecciones TUVOTO

Catálogo propio de procesos, candidatos con fotografía, unidades, mesas y asignaciones. No consulta otras bases. Verifica cuentas por API de identidad antes de asignar. El catálogo de candidaturas queda congelado al asignar mesas; configure primero todos los candidatos.

Público: catálogo de eventos y configuración/fotografías de cargos publicados. Administrador: configuración de su organización. Operador: únicamente sus mesas asignadas de la elección actual. Contrato activo: `compartido/contratos/openapi/elecciones.openapi.json`.

El cliente gRPC y las pruebas SIGAPE se trasladaron a `archivo/sigape-p1/`. No se migraron datos históricos automáticamente ni se elimina su persistencia.

La columna aditiva `publicado` comienza en `false`; al migrar, únicamente el proceso ya marcado `actual` se conserva público. Los borradores anteriores no se publican. El evento se agrupa por organización y nombre exacto de proceso; debe repetirse el nombre para cada cargo del mismo evento. No se añade otro microservicio ni se cruzan bases.

`GET /api/v1/publico/eventos` devuelve solo cargos publicados y no archivados. El evento con proceso `actual` aparece primero y Rectorado precede a Vicerrectorado, Decanato y Dirección. `GET /api/v1/publico/procesos/:id` devuelve 404 para cargos no publicados. `PUT /api/v1/configuracion/procesos/:id/publicacion` publica/oculta dentro de la organización autorizada. `POST .../:id/actual` publica y destaca; los otros cargos publicados permanecen visibles. Ocultar el actual también desactiva su recepción de actas.

La recepción de actas conserva el proceso `actual` único y las reglas de asignación existentes; publicar varios cargos amplía la consulta pública, no habilita simultáneamente todas sus mesas para registro. La evolución a recepción simultánea requiere una decisión adicional del dominio.

Pruebas: `npm run compilar`, `node --test --test-isolation=none pruebas/catalogo-publico.test.mjs`. Desde la raíz: `node microservicios/elecciones/pruebas/publicacion-http.mjs` crea un PostgreSQL efímero con datos sintéticos y usa un doble de Identidad; lo retira al finalizar, sin volúmenes ni cambios en despliegues. `CONTRATO_OPENAPI` permite ejecutar el servidor fuera de Docker; por defecto usa `/app/contrato.json`.

## Catálogo universitario para desarrollo local

Con los servicios iniciados y una cuenta administradora con alcance global, ejecutar desde la raíz:

```sh
python3 microservicios/elecciones/desarrollo/crear-evento-demostracion.py
```

Solicita usuario y contraseña en la terminal. También acepta `--credenciales-locales` con un JSON privado de permisos 600 (`usuario` y `contrasena`); mantenerlo fuera de Git y del contexto Docker, por ejemplo con nombre `.env.tuvoto-administrador.json`. Nunca se incluyen credenciales en el código ni en la salida.

Crea una organización «Universidad de demostración · TUVOTO» y el evento «Elecciones universitarias · Demostración» con cuatro cargos, dos candidaturas por cargo y trece mesas distribuidas entre facultades, carreras y cursos. Todo está identificado como prueba. Publica los cargos y destaca Rectorado solo si no existe otro proceso actual. Al repetirlo, reutiliza el catálogo existente sin duplicarlo.

Usa las API autenticadas de Identidad y Elecciones, con cookies y CSRF; no accede directamente a bases ni modifica permisos. Solo admite una URL HTTP local. No crea actas, votos, fotografías, operadores ni asignaciones, y nunca se ejecuta automáticamente al arrancar. La portada muestra los ceros derivados de la ausencia de actas.
