import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    open: false,
    host: true
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/leaflet') || id.includes('node_modules/proj4')) {
            return 'vendor-gis';
          }
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/jszip') || id.includes('node_modules/html2canvas')) {
            return 'vendor-export';
          }
          if (id.includes('node_modules/ui-components-kit') || id.includes('node_modules/lucide')) {
            return 'vendor-ui';
          }
        }
      }
    }
  }
});
