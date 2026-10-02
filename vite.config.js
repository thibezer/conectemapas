import { defineConfig } from 'vite';

const VENDOR_DIR = new URL('./src/vendor/ui-components-kit', import.meta.url).pathname
  // Corrige path no Windows (remove leading slash antes da letra do drive)
  .replace(/^\/([A-Za-z]:)/, '$1');

/**
 * Plugin que resolve qualquer importação de 'ui-components-kit' ou
 * seus subpaths ('ui-components-kit/camadas', etc.) para o vendor local
 * commitado em src/vendor/ui-components-kit/dist/
 */
function uiComponentsKitVendorPlugin() {
  const PKG = 'ui-components-kit';
  const DIST = `${VENDOR_DIR}/dist`;

  // Mapeamento de subpaths para seus bundles ES no dist/
  const subpathMap = {
    '': 'ui-kit.es.js',
    '/camadas': 'camadas.es.js',
    '/feedback': 'feedback.es.js',
    '/forms': 'forms.es.js',
    '/data': 'data.es.js',
    '/tools': 'tools.es.js',
    '/mapa': 'mapa.es.js',
    '/canvas': 'canvas.es.js',
    '/tabela': 'tabela.es.js',
    '/botao': 'botao.es.js',
    '/campo-texto': 'campo-texto.es.js',
    '/modal': 'modal.es.js',
    '/card': 'card.es.js',
    '/register': 'register.es.js',
    '/core': 'core.es.js',
    '/style.css': 'ui-kit.css',
  };

  return {
    name: 'vite-plugin-ui-components-kit-vendor',
    resolveId(source) {
      if (source === PKG || source.startsWith(PKG + '/')) {
        const sub = source.slice(PKG.length) || '';
        const file = subpathMap[sub];
        if (file) return `${DIST}/${file}`;
      }
      return null;
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [uiComponentsKitVendorPlugin()],
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
