import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

const buildVersion = `v_${Date.now()}`;

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion)
  },
  plugins: [
    {
      name: 'cm-build-version-manifest',
      writeBundle(options) {
        try {
          const outDir = options?.dir || 'dist';
          fs.writeFileSync(path.join(outDir, '.cm_app_version'), buildVersion, 'utf8');
        } catch {}
      }
    }
  ],
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
          if (id.includes('node_modules/jszip')) {
            return 'vendor-zip';
          }
          if (id.includes('ui-components-kit') || id.includes('vendor/ui-components-kit')) {
            return 'vendor-ui';
          }
        }
      }
    }
  }
});
