import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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
      '/socket.io': {
        target: process.env.VITE_API_URL || 'http://backend:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    // Increase chunk size warning limit to 1000kb (from default 500kb)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching and parallel loading
        manualChunks: {
          // Vendor chunks - libraries that rarely change
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-charts': ['recharts'],
          'vendor-ui': ['lucide-react'],

          // Feature-based chunks for code we wrote
          'settings': [
            './components/settings/SSOConfiguration',
            './components/settings/UserManagement',
            './components/settings/AuditLog',
          ],
          'analytics': [
            './components/analytics/MetricsCards',
            './components/analytics/StatusDistributionChart',
            './components/analytics/CompletionTimeTable',
            './components/analytics/HourAllocationTable',
          ],
          'projects': [
            './components/projects/ProjectTable',
            './components/projects/ProjectCard',
            './components/projects/ProjectForm',
          ],
        },
      },
    },
  },
});
