FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY microservicios/resultados/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY microservicios/resultados/app ./app
COPY compartido/contratos/eventos/voto.registrado.v1.schema.json ./evento.schema.json
COPY compartido/contratos/openapi/resultados.yaml ./contrato.yaml
RUN groupadd --system sigape && useradd --system --gid sigape --home-dir /app sigape
USER sigape
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s CMD ["python", "-m", "app.salud"]
CMD ["uvicorn", "app.servidor:app", "--host", "0.0.0.0", "--port", "8000"]
