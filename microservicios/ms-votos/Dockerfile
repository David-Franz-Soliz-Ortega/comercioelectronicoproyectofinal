FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY src ./src
COPY tests ./tests

ENV NODE_ENV=production
USER node

EXPOSE 3000

CMD ["node", "src/servidor.js"]
