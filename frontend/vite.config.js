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
        target: 'https://bandready.onrender.com',
        changeOrigin: true,
      },
      '/storage': {
        target: 'https://bandready.onrender.com',
        changeOrigin: true,
      },
    },
  },
});
