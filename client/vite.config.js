import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Every `import { toast } from 'react-toastify'` in the app renders the
      // themed NotifyHost pop-up instead of corner toasts.
      { find: /^react-toastify$/, replacement: fileURLToPath(new URL('./src/components/shared/NotifyHost.jsx', import.meta.url)) }
    ]
  },
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
        // Add hash to filenames for cache busting
        entryFileNames: 'app-[name]-[hash].js',
        chunkFileNames: 'chunk-[name]-[hash].js',
        assetFileNames: 'asset-[name]-[hash].[ext]'
      }
    }
  },
  define: {
    __APP_VERSION__: '"2.0.1"'
  }
});
