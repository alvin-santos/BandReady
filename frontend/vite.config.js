import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  preview: {
    host: true,
    port: Number(process.env.PORT) || 4173,
    // Render (and other proxies) send a public Host header; Vite blocks unknown hosts by default.
    allowedHosts: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://api.band-ready.com',
        // target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/storage': {
        target: 'https://api.band-ready.com',
        // target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Must not proxy /auth — the SPA serves /auth/google for Google token (#fragment).
      '/oauth': {
        target: 'https://api.band-ready.com',
        // target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
