FROM python:3.12-slim AS compilacion
WORKDIR /app
COPY microservicios/resultados/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY microservicios/resultados/app ./app
COPY compartido/contratos/eventos/acta.actualizada.v1.schema.json ./evento.schema.json
FROM python:3.12-slim AS ejecucion
WORKDIR /app
COPY --from=compilacion /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=compilacion /usr/local/bin/uvicorn /usr/local/bin/uvicorn
COPY --from=compilacion /app/app ./app
COPY --from=compilacion /app/evento.schema.json ./evento.schema.json
RUN useradd --system --uid 10001 tuvoto
USER tuvoto
EXPOSE 8000
CMD ["uvicorn", "app.servidor:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
