FROM tuvoto-actas:latest
USER root
RUN pip install --no-cache-dir httpx==0.28.1
COPY microservicios/actas/pruebas /app/pruebas
COPY frontend/public/ejemplos/acta-escrutinio-prueba.png /app/pruebas/acta-escrutinio-prueba.png
USER tuvoto
CMD ["python", "-m", "unittest", "discover", "-s", "pruebas", "-p", "test_lectura.py", "-v"]
