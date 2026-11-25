# Contexto: raíz del repositorio (ver la excepción de infraestructura/mapa-vivo en .dockerignore).
FROM node:24-alpine
ENV NODE_ENV=production UV_THREADPOOL_SIZE=16
WORKDIR /app
COPY infraestructura/mapa-vivo/package.json infraestructura/mapa-vivo/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY infraestructura/mapa-vivo/src ./src
COPY infraestructura/mapa-vivo/publico ./publico
COPY frontend/src/recursos/fuentes/manrope-variable.ttf ./publico/fuentes/manrope-variable.ttf
COPY frontend/public/fuentes/Manrope-OFL.txt ./publico/fuentes/Manrope-OFL.txt
USER node
EXPOSE 8080 5140/udp
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s CMD wget -q -O /dev/null --header='Host: localhost' http://127.0.0.1:8080/api/salud || exit 1
CMD ["node", "src/servidor.mjs"]
