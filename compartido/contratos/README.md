# Contratos activos TUVOTO

- REST: archivos `openapi/*.openapi.json`. Identidad y Elecciones sirven sus contratos; FastAPI genera los de Actas y Resultados. Las escrituras requieren sesión, CSRF y autorización del productor.
- GraphQL: `graphql/tuvoto.graphql` (portal público y registro autorizado de actas).
- RabbitMQ: `eventos/acta.actualizada.v1.schema.json` (instantánea versionada por mesa).

Los YAML, el SDL `esquema.graphql`, el proto de padrón y el evento `voto.registrado.v1` restantes pertenecen a SIGAPE P1 y no se usan en el nuevo Compose. Se conservan como contratos históricos para no reinterpretar datos previos. Nunca consumir sus eventos como votos de actas TUVOTO.
