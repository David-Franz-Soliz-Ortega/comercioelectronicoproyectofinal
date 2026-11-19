# Roles unificados de TUVOTO

Los únicos roles asignables son **ADMINISTRADOR**, **OPERADOR** y **AUDITOR**. El público consulta sin cuenta; no constituye un cuarto rol autenticado.

| Rol | Responsabilidad | Prohibición |
| --- | --- | --- |
| ADMINISTRADOR | Configurar procesos, candidatos, mesas y operadores; administrar cuentas según alcance | Registrar/publicar actas, aunque también tenga OPERADOR |
| OPERADOR | Registrar/corregir actas únicamente de sus mesas asignadas y consultar sus originales | Administrar cuentas, roles, organizaciones o procesos |
| AUDITOR | Consultar actas e informes autorizados de su organización | Modificar datos o publicar actas |

## Alcances conservados

Existe un solo nombre de rol administrativo. La organización sigue siendo una frontera de autorización, no un segundo rol. La cuenta inicial creada por CLI tiene ADMINISTRADOR con alcance global (`idOrganizacion=null`) y puede crear organizaciones y administradores de organización. Las nuevas cuentas administrativas creadas desde la interfaz pertenecen a una organización; no adquieren acceso a las demás ni pueden promover otras cuentas a administrador. Esto conserva los permisos previos y evita una escalada al fusionar nombres.

## Migración automática al arrancar Identidad

`migrarSeguridad`, en `microservicios/identidad/src/seguridad.ts`, realiza la conversión en una transacción protegida por bloqueo:

- SUPERADMIN pasa a ADMINISTRADOR, conservando su alcance global.
- ADMIN_ELECTORAL pasa a ADMINISTRADOR, conservando su organización.
- Se mantienen UUID, nombres, hashes, organizaciones, recuperaciones e historial.
- Se revocan las sesiones de las cuentas convertidas; deben iniciar sesión otra vez con su contraseña actual.
- Las siguientes ejecuciones son idempotentes: no vuelven a revocar sesiones si no hay roles antiguos.
- ELECTOR se admite únicamente como dato histórico para no eliminar asignaciones existentes; no se ofrece ni se acepta en nuevas asignaciones TUVOTO.

Los comandos antiguos `restablecer-superadmin*` se conservan para el entorno SIGAPE aislado para el que fueron escritos; no deben utilizarse para recuperar cuentas TUVOTO.

## Validación

`python3 microservicios/identidad/pruebas/ejecutar-fusion.py` compila Identidad y utiliza PostgreSQL efímero en tmpfs, sin volúmenes existentes. Verifica migración desde el esquema anterior, integridad de contraseñas y alcances, sesiones, idempotencia y rollback ante fallo inducido. Requiere Node, TypeScript/dependencias instaladas, Docker y la imagen local postgres:17-alpine.

También se ejecutaron las pruebas del PDP (incluidos rol antiguo rechazado, administración por alcance, auditor y cuentas con roles mezclados), compilación TypeScript de Identidad/Elecciones, pruebas y compilación React y pruebas de GraphQL.

## Estado de aplicación

Actualizado localmente el 19 de noviembre de 2026 mediante `docker compose --env-file .env.tuvoto -p tuvoto up -d --build`. Se reconstruyeron las imágenes y se recrearon Identidad, Elecciones y Frontend. La migración se aplicó al arrancar Identidad y los trece contenedores quedaron saludables.

Se preparó un respaldo privado de Identidad en `.respaldo-local/`, ignorado por Git/Docker. La comprobación posterior usó únicamente recuentos y huellas agregadas: usuarios, contraseñas, organizaciones y recuperaciones se conservaron; roles y revocación de sesiones coincidieron con lo previsto. No se exportaron filas sensibles al control de verificación.

Se verificaron portal, GraphQL y Swagger con respuestas correctas, el bundle React con ADMINISTRADOR sin los dos nombres anteriores y sesión anónima rechazada con 401. No se ejecutó login con contraseñas del usuario ni se crearon datos electorales. Los contenedores de bases no se recrearon y los otros proyectos conservaron su estado. No hubo commit ni push.

La cuenta convertida debe iniciar sesión otra vez con su usuario y contraseña habituales. Portal: http://127.0.0.1:8890; acceso privado: http://127.0.0.1:8890/#panel.
