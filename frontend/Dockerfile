FROM node:24-alpine AS construccion
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY frontend/index.html frontend/vite.config.js ./
COPY frontend/src ./src
COPY frontend/public ./public
RUN npm run compilar

FROM nginx:1.29-alpine
COPY frontend/nginx.conf /etc/nginx/nginx.conf
COPY --from=construccion /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s CMD wget -q -O /dev/null http://127.0.0.1:3000/salud || exit 1
ENTRYPOINT ["nginx", "-g", "daemon off;"]
