import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    proxy: {
      '/api/ocado': {
        target: 'https://www.ocado.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ocado/, '')
      }
    }
  }
});
