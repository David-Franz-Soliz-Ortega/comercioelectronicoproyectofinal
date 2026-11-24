FROM python:3.12-slim AS compilacion
WORKDIR /app
COPY microservicios/actas/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY microservicios/actas/app ./app
COPY compartido/contratos/grpc/mesa-v1.proto ./contratos/mesa-v1.proto
RUN mkdir -p app/generado && python -m grpc_tools.protoc -Icontratos --python_out=app/generado --grpc_python_out=app/generado contratos/mesa-v1.proto
FROM python:3.12-slim AS ejecucion
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-spa && rm -rf /var/lib/apt/lists/*
COPY --from=compilacion /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=compilacion /usr/local/bin/uvicorn /usr/local/bin/uvicorn
COPY --from=compilacion /app/app ./app
RUN useradd --system --uid 10001 tuvoto
USER tuvoto
EXPOSE 8000
CMD ["uvicorn", "app.servidor:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
