import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../server/public/dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: `asset-index-[name]-${Date.now()}.js`,
        chunkFileNames: `asset-[name]-${Date.now()}.js`,
        assetFileNames: `asset-[name]-${Date.now()}.[ext]`
      }
    }
  },
  define: {
    __APP_VERSION__: '"2.0.1"',
    'import.meta.env.VITE_API_URL': '"http://18.166.29.239:3000/api"'
  }
});
