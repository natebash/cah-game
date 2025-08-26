
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: '.', 
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: 'index.html',
      },
    },
  },
  server: {
    proxy: {
      '/socket.io': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
