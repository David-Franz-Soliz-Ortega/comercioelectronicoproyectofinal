# Resultados TUVOTO

Consulta pública de la elección actual. Proyección MongoDB por proceso/mesa, versionada: una corrección reemplaza un aporte, no incrementa un contador acumulativo. Votos válidos, blancos, nulos y avance por mesas tienen denominadores distintos. Redis almacena únicamente respuestas públicas durante tres segundos; si falla se consulta MongoDB.

Dos procesos independientes consumen `acta.actualizada.v1`: conteo y auditoría técnica. ACK manual, prefetch 1, deduplicación y DLQ por cola. Los eventos antiguos de SIGAPE no son resultados TUVOTO.

Contrato FastAPI: `/openapi.json`. Pruebas actuales: `pruebas-tuvoto/`; las anteriores están archivadas.
