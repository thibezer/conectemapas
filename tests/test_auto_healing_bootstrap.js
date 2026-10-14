import assert from 'node:assert';

const createMockEl = () => ({
  setAttribute: () => {},
  getAttribute: () => null,
  style: {},
  classList: { add: () => {}, remove: () => {} },
  textContent: '',
  addEventListener: () => {},
  removeEventListener: () => {}
});

globalThis.window = {
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  location: { hostname: 'localhost', search: '' },
  devicePixelRatio: 1,
  screen: {},
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.document = {
  createElement: createMockEl,
  documentElement: { style: {} },
  body: { appendChild: () => {}, classList: { toggle: () => {} } },
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: () => createMockEl(),
  querySelector: () => createMockEl(),
  querySelectorAll: () => []
};

globalThis.HTMLElement = class {};
globalThis.customElements = { define: () => {}, get: () => null };

const { AppBootstrapSync } = await import('../src/bootstrap/AppBootstrapSync.js');

console.log('--- Testando Auto-Cura de Boot e Hidratação de Nuvem (AppBootstrapSync) ---');

// Cenário 1: hydrateFromCloud hidrata feições e metadados quando fornecido payload
const mockApp = {
  projectId: 'test_proj',
  projectName: 'Projeto Antigo',
  currentBasemap: 'satelite',
  layers: [],
  features: [],
  refreshMapAndTable: () => {},
  mapEngine: {
    setBaseLayer: () => {},
    fitAllFeatures: () => {}
  },
  layerPanel: {
    updateLayers: () => {}
  }
};

const cloudPayload = {
  exists: true,
  rev: 42,
  project: {
    id: 'test_proj',
    name: 'Projeto Recuperado',
    basemap: 'google_satelite_puro',
    featureCount: 2
  },
  layers: [
    { id: 'layer-cad', name: 'AutoCAD', color: '#00E08A', visible: true }
  ],
  features: [
    { id: 'f-1', layerId: 'layer-cad', name: 'Lote 1', type: 'Point', coordinates: [-23.76, -53.32] },
    { id: 'f-2', layerId: 'layer-cad', name: 'Lote 2', type: 'LineString', coordinates: [[-23.76, -53.32], [-23.77, -53.33]] }
  ]
};

console.log('1. Executando hydrateFromCloud para auto-cura...');
const success = await AppBootstrapSync.hydrateFromCloud(mockApp, cloudPayload);

assert.strictEqual(success, true, 'hydrateFromCloud deve retornar true');
assert.strictEqual(mockApp.projectName, 'Projeto Recuperado', 'Nome do projeto deve ser atualizado');
assert.strictEqual(mockApp.features.length, 2, 'Deve ter recuperado as 2 feições da nuvem');
assert.strictEqual(mockApp.layers.length, 1, 'Deve ter recuperado a camada');
console.log('✔ Cenário 1 passou: auto-cura restaurou nome, camadas e feições!');

console.log('🎉 Todos os testes de auto-cura do bootstrap passaram com sucesso!');
