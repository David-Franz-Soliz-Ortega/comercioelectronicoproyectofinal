FROM node:24-alpine AS compilacion
WORKDIR /app
COPY microservicios/elecciones/package.json microservicios/elecciones/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY microservicios/elecciones/tsconfig.json ./tsconfig.json
COPY microservicios/elecciones/src ./src
COPY compartido/contratos/openapi/elecciones.yaml ./contrato.yaml
RUN npm run compilar

FROM node:24-alpine AS ejecucion
ENV NODE_ENV=production
WORKDIR /app
COPY microservicios/elecciones/package.json microservicios/elecciones/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=compilacion /app/dist ./dist
COPY --from=compilacion /app/contrato.yaml ./contrato.yaml
USER node
EXPOSE 3000
CMD ["node", "dist/servidor.js"]