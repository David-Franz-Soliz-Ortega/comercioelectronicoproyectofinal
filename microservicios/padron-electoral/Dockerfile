FROM node:24-alpine AS compilacion
WORKDIR /app
COPY microservicios/padron-electoral/package.json microservicios/padron-electoral/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY microservicios/padron-electoral/tsconfig.json ./tsconfig.json
COPY microservicios/padron-electoral/src ./src
COPY compartido/contratos/openapi/padron-electoral.yaml ./contrato.yaml
COPY compartido/contratos/grpc/padron-v1.proto ./padron-v1.proto
ENV CONTRATO_GRPC=/app/padron-v1.proto
COPY microservicios/padron-electoral/pruebas ./pruebas
RUN npm run compilar && npm run probar-grpc

FROM node:24-alpine AS ejecucion
ENV NODE_ENV=production
WORKDIR /app
COPY microservicios/padron-electoral/package.json microservicios/padron-electoral/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=compilacion /app/dist ./dist
COPY --from=compilacion /app/contrato.yaml ./contrato.yaml
COPY --from=compilacion /app/padron-v1.proto ./padron-v1.proto
USER node
EXPOSE 3000 50051
CMD ["node", "dist/servidor.js"]