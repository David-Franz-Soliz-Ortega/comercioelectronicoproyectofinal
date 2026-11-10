FROM node:24-alpine AS verificacion
WORKDIR /app
COPY gateway/graphql/package.json gateway/graphql/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY gateway/graphql/src ./src
COPY gateway/graphql/pruebas ./pruebas
COPY compartido/contratos/graphql/esquema.graphql ./esquema.graphql
ENV CONTRATO_GRAPHQL=/app/esquema.graphql
RUN npm run verificar

FROM node:24-alpine
ENV NODE_ENV=production CONTRATO_GRAPHQL=/app/esquema.graphql
WORKDIR /app
COPY --from=verificacion /app/node_modules ./node_modules
COPY --from=verificacion /app/src ./src
COPY --from=verificacion /app/esquema.graphql ./esquema.graphql
COPY gateway/graphql/package.json ./package.json
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=4s --start-period=15s CMD node -e "fetch('http://127.0.0.1:4000/api/v1/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/servidor.js"]
