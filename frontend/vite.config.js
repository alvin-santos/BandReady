import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  preview: {
    host: true,
    port: Number(process.env.PORT) || 4173,
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
