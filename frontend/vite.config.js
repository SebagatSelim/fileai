import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Backend (Flask) address used by the dev-server proxy. Override with
// `VITE_API_PROXY_TARGET=http://host:port npm run dev` if the API runs elsewhere.
const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
    include: ['src/**/*.test.{js,jsx}'],
  },
});
