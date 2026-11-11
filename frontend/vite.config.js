import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => {
  const destino = process.env.URL_ENTRADA_DESARROLLO;
  if (command === 'serve') {
    if (!destino) throw new Error('Define URL_ENTRADA_DESARROLLO con la URL del NGINX aislado.');
    const url = new URL(destino);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.port === '8080') {
      throw new Error('El desarrollo requiere NGINX aislado en http://127.0.0.1:PUERTO, distinto de 8080.');
    }
  }
  // Solo traducir el origen del navegador servido por este Vite local.
  // Orígenes ajenos conservan su cabecera y serán rechazados por identidad.
  const proxyAislado = () => ({
    target: destino, changeOrigin: true,
    configure(proxy) {
      proxy.on('proxyReq', (salida, entrada) => {
        const origenLocal = `http://127.0.0.1:${entrada.socket.localPort}`;
        if (entrada.headers.origin === origenLocal) salida.setHeader('Origin', new URL(destino).origin);
      });
    },
  });
  return {
    plugins: [react()],
    server: { host: '127.0.0.1', proxy: destino ? { '/graphql': proxyAislado(), '/api/v1': proxyAislado() } : {} },
  };
});
