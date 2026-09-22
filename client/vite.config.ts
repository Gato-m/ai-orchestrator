import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    'process.env': {},
  },
  server: {
    port: 3001,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
        ws: true,
        // ⬇️ ŠĪS RINDIŅAS NOVĒRŠ VITE 502 BAD GATEWAY KĻŪDU ⬇️
        timeout: 120000,      // Gaidīt līdz 2 minūtēm
        proxyTimeout: 120000, // Gaidīt līdz 2 minūtēm
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('❌ Vite Proxy error:', err);
          });
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            console.log('🔄 Proxy sūta pieprasījumu:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('✅ Proxy saņēma atbildi:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
});