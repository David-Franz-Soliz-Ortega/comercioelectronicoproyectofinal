# BFF TUVOTO

SDL activo `compartido/contratos/graphql/tuvoto.graphql`. Query pública `portal` agrega elección actual y resultados; `registrarActa` transmite la solicitud al productor, que verifica sesión, CSRF, rol y asignación. DataLoader deduplica las lecturas por operación. Sin elección publicada devuelve null; no genera datos de demostración.

No ofrece emisión de votos, acceso al padrón ni mutations de configuración. El panel administrativo utiliza REST. Las pruebas y agregación SIGAPE están en `archivo/sigape-p1/gateway/`.
