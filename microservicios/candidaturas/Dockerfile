FROM python:3.12-slim AS dependencias
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY microservicios/candidaturas/requirements.txt ./requirements.txt
RUN python -m venv /opt/entorno && /opt/entorno/bin/pip install --no-cache-dir -r requirements.txt

FROM python:3.12-slim AS ejecucion
ENV PATH="/opt/entorno/bin:$PATH" PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY --from=dependencias /opt/entorno /opt/entorno
COPY microservicios/candidaturas/app ./app
COPY compartido/contratos/openapi/candidaturas.yaml ./contrato.yaml
RUN groupadd --system sigape && useradd --system --gid sigape --home-dir /app sigape
USER sigape
EXPOSE 8000
CMD ["uvicorn", "app.servidor:app", "--host", "0.0.0.0", "--port", "8000"]