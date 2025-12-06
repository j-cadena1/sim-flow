import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    // Port 5173 matches docker-compose.dev.yaml frontend port mapping
    port: 5173,
    host: '0.0.0.0',
    // Proxy API requests to backend in development
    // Uses 'backend' service name when running in Docker, localhost for local dev
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://backend:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
