import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  resolve: {
    alias: [
      { find: /^ui-components-kit\/(.*)/, replacement: '@thibezer/ui-components-kit/$1' },
      { find: 'ui-components-kit', replacement: '@thibezer/ui-components-kit' }
    ]
  },
  plugins: [],
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
          if (id.includes('ui-components-kit') || id.includes('vendor/ui-components-kit')) {
            return 'vendor-ui';
          }
        }
      }
    }
  }
});
